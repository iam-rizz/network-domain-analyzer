/**
 * Host Service
 * Provides host monitoring functionality including ping, HTTP checks, and availability monitoring
 */

import axios, { AxiosError } from 'axios';
import * as ping from 'ping';
import * as net from 'net';
import * as tls from 'tls';
import * as forge from 'node-forge';
import { PingResult, HTTPResult, PortScanResult, PortInfo, SSLResult } from '../models/host.types';
import { AppError } from '../models/error.types';
import { validatePort } from '../utils/validation';

// Probe locations for multi-location availability checks
const PROBE_LOCATIONS = [
  { name: 'Primary', endpoint: 'local' },
  { name: 'Secondary', endpoint: 'local' },
  { name: 'Tertiary', endpoint: 'local' },
];

// Timeout configurations (in milliseconds)
const TIMEOUTS = {
  PING: 5000,
  HTTP: 10000,
  PORT_SCAN: 3000, // Timeout per port
  SSL_CHECK: 10000, // Timeout for SSL certificate check
};

// Slow response threshold (in milliseconds)
const SLOW_RESPONSE_THRESHOLD = 5000;

// Common ports to scan by default (Requirement 4.1)
const COMMON_PORTS = [21, 22, 25, 80, 443, 3306, 5432, 8080];

// Service name mapping for common ports (Requirement 4.3)
const PORT_SERVICE_MAP: Record<number, string> = {
  20: 'FTP Data',
  21: 'FTP',
  22: 'SSH',
  23: 'Telnet',
  25: 'SMTP',
  53: 'DNS',
  80: 'HTTP',
  110: 'POP3',
  143: 'IMAP',
  443: 'HTTPS',
  465: 'SMTPS',
  587: 'SMTP (Submission)',
  993: 'IMAPS',
  995: 'POP3S',
  3306: 'MySQL',
  3389: 'RDP',
  5432: 'PostgreSQL',
  5900: 'VNC',
  6379: 'Redis',
  8080: 'HTTP Proxy',
  8443: 'HTTPS Alt',
  27017: 'MongoDB',
};

export class HostService {
  /**
   * Ping a host using ICMP packets from multiple locations
   * @param host - Hostname or IP address to ping
   * @param locations - Optional array of location names (defaults to 3 locations)
   * @returns Array of PingResult from each location
   */
  async ping(host: string, locations?: string[]): Promise<PingResult[]> {
    if (!host || host.trim().length === 0) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Host is required',
        400,
        { host }
      );
    }

    const normalizedHost = host.trim();
    
    // Use at least 3 probe locations as per requirement 3.4
    const locationsToProbe = locations && locations.length >= 3 
      ? locations.slice(0, 3).map(name => ({ name, endpoint: 'local' }))
      : PROBE_LOCATIONS;

    // Ping from all locations in parallel
    const pingPromises = locationsToProbe.map(location =>
      this.pingFromLocation(normalizedHost, location.name)
    );

    const results = await Promise.all(pingPromises);
    return results;
  }

  /**
   * Ping a host from a specific location
   * @param host - Hostname or IP address to ping
   * @param locationName - Name of the probe location
   * @returns PingResult with status and response time
   */
  private async pingFromLocation(
    host: string,
    locationName: string
  ): Promise<PingResult> {
    try {
      // Configure ping with timeout
      const config = {
        timeout: TIMEOUTS.PING / 1000, // Convert to seconds for ping library
      };

      const startTime = Date.now();
      const response = await ping.promise.probe(host, config);
      const responseTime = Date.now() - startTime;

      // Parse response time from ping library
      let actualResponseTime = responseTime;
      if (response.alive && response.time !== 'unknown') {
        const parsedTime = parseFloat(String(response.time));
        if (!isNaN(parsedTime)) {
          actualResponseTime = parsedTime;
        }
      }

      return {
        alive: response.alive,
        responseTime: actualResponseTime,
        location: locationName,
      };
    } catch (error: any) {
      // If ping fails, return result with alive=false
      return {
        alive: false,
        responseTime: TIMEOUTS.PING,
        location: locationName,
      };
    }
  }

  /**
   * Check HTTP/HTTPS endpoint
   * @param url - Full URL to check (must include protocol)
   * @returns HTTPResult with status code, response time, and headers
   */
  async checkHTTP(url: string): Promise<HTTPResult> {
    if (!url || url.trim().length === 0) {
      throw new AppError(
        'VALIDATION_ERROR',
        'URL is required',
        400,
        { url }
      );
    }

    const normalizedUrl = url.trim();

    // Validate URL format
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      throw new AppError(
        'VALIDATION_ERROR',
        'URL must start with http:// or https://',
        400,
        { url: normalizedUrl }
      );
    }

    try {
      const startTime = Date.now();
      
      const response = await axios.get(normalizedUrl, {
        timeout: TIMEOUTS.HTTP,
        validateStatus: () => true, // Accept any status code
        maxRedirects: 5,
        headers: {
          'User-Agent': 'Network-Domain-Analyzer/1.0',
        },
      });

      const responseTime = Date.now() - startTime;

      // Convert headers to plain object
      const headers: Record<string, string> = {};
      Object.entries(response.headers).forEach(([key, value]) => {
        headers[key] = String(value);
      });

      return {
        statusCode: response.status,
        responseTime,
        headers,
      };
    } catch (error: any) {
      // Handle timeout errors
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        throw new AppError(
          'TIMEOUT_ERROR',
          `HTTP check timeout after ${TIMEOUTS.HTTP}ms`,
          408,
          { url: normalizedUrl, timeout: TIMEOUTS.HTTP }
        );
      }

      // Handle connection errors
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        throw new AppError(
          'HOST_UNREACHABLE',
          `Host unreachable: ${error.message}`,
          503,
          { url: normalizedUrl, error: error.message }
        );
      }

      // Handle other axios errors
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        
        // If we got a response, return it
        if (axiosError.response) {
          // Calculate response time (fallback to 0 if not available)
          const responseTime = 0;
          
          const headers: Record<string, string> = {};
          Object.entries(axiosError.response.headers).forEach(([key, value]) => {
            headers[key] = String(value);
          });

          return {
            statusCode: axiosError.response.status,
            responseTime,
            headers,
          };
        }
      }

      // Generic error
      throw new AppError(
        'HTTP_CHECK_FAILED',
        `HTTP check failed: ${error.message}`,
        500,
        { url: normalizedUrl, error: error.message }
      );
    }
  }

  /**
   * Check if a response time is considered slow
   * @param responseTime - Response time in milliseconds
   * @returns true if response is slow (> 5000ms), false otherwise
   */
  isSlowResponse(responseTime: number): boolean {
    return responseTime > SLOW_RESPONSE_THRESHOLD;
  }

  /**
   * Get the slow response threshold
   * @returns Slow response threshold in milliseconds
   */
  getSlowResponseThreshold(): number {
    return SLOW_RESPONSE_THRESHOLD;
  }

  /**
   * Scan ports on a host
   * @param host - Hostname or IP address to scan
   * @param ports - Optional array of port numbers to scan (defaults to common ports)
   * @returns PortScanResult with scanned ports, open ports, and scan summary
   */
  async scanPorts(host: string, ports?: number[]): Promise<PortScanResult> {
    if (!host || host.trim().length === 0) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Host is required',
        400,
        { host }
      );
    }

    const normalizedHost = host.trim();

    // Use provided ports or default to common ports (Requirement 4.1, 4.2)
    let portsToScan = ports && ports.length > 0 ? ports : COMMON_PORTS;

    // Validate all port numbers (Requirement 4.5)
    for (const port of portsToScan) {
      const validation = validatePort(port);
      if (!validation.valid) {
        throw new AppError(
          'VALIDATION_ERROR',
          validation.errors[0].message,
          400,
          { port, errors: validation.errors }
        );
      }
    }

    // Remove duplicates and sort
    portsToScan = [...new Set(portsToScan)].sort((a, b) => a - b);

    const startTime = Date.now();

    // Scan all ports in parallel with individual timeouts
    const scanPromises = portsToScan.map(port =>
      this.checkPort(normalizedHost, port)
    );

    const portResults = await Promise.all(scanPromises);

    // Separate open and closed ports
    const openPorts: PortInfo[] = [];
    const closedPorts: number[] = [];

    portResults.forEach((result) => {
      if (result.state === 'open') {
        openPorts.push(result);
      } else {
        closedPorts.push(result.port);
      }
    });

    const scanDuration = Date.now() - startTime;

    // Return scan summary (Requirement 4.4)
    return {
      host: normalizedHost,
      scannedPorts: portsToScan,
      openPorts,
      closedPorts,
      scanDuration,
    };
  }

  /**
   * Check if a specific port is open on a host
   * @param host - Hostname or IP address
   * @param port - Port number to check
   * @returns PortInfo with port state and service name
   */
  private async checkPort(host: string, port: number): Promise<PortInfo> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let isResolved = false;

      // Set timeout for connection attempt
      socket.setTimeout(TIMEOUTS.PORT_SCAN);

      socket.on('connect', () => {
        if (!isResolved) {
          isResolved = true;
          socket.destroy();
          resolve({
            port,
            service: this.getServiceName(port),
            state: 'open',
          });
        }
      });

      socket.on('timeout', () => {
        if (!isResolved) {
          isResolved = true;
          socket.destroy();
          resolve({
            port,
            service: this.getServiceName(port),
            state: 'closed',
          });
        }
      });

      socket.on('error', () => {
        if (!isResolved) {
          isResolved = true;
          socket.destroy();
          resolve({
            port,
            service: this.getServiceName(port),
            state: 'closed',
          });
        }
      });

      try {
        socket.connect(port, host);
      } catch (error) {
        if (!isResolved) {
          isResolved = true;
          resolve({
            port,
            service: this.getServiceName(port),
            state: 'closed',
          });
        }
      }
    });
  }

  /**
   * Get service name for a port number (Requirement 4.3)
   * @param port - Port number
   * @returns Service name or 'Unknown' if not in mapping
   */
  private getServiceName(port: number): string {
    return PORT_SERVICE_MAP[port] || 'Unknown';
  }

  /**
   * Check SSL certificate for a domain
   * @param domain - Domain name to check (without protocol)
   * @returns SSLResult with certificate details and validation status
   */
  async checkSSL(domain: string): Promise<SSLResult> {
    if (!domain || domain.trim().length === 0) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Domain is required',
        400,
        { domain }
      );
    }

    const normalizedDomain = domain.trim().toLowerCase();

    // Remove protocol if provided
    let cleanDomain = normalizedDomain;
    if (cleanDomain.startsWith('https://')) {
      cleanDomain = cleanDomain.substring(8);
    } else if (cleanDomain.startsWith('http://')) {
      // HTTP domains don't have SSL (Requirement 5.5)
      throw new AppError(
        'SSL_NOT_AVAILABLE',
        'SSL is not available for HTTP domains. Please use HTTPS or provide domain without protocol.',
        400,
        { domain: normalizedDomain }
      );
    }

    // Remove trailing slash and path
    cleanDomain = cleanDomain.split('/')[0];

    // First, check if the domain supports HTTPS by attempting a connection
    try {
      // Try to connect to the domain on port 443
      const certificate = await this.fetchSSLCertificate(cleanDomain);

      // Parse certificate details (Requirement 5.1)
      // Try node-forge first, fall back to raw certificate data for non-RSA keys (ECDSA/EC)
      let issuer: string;
      let subject: string;
      let validFrom: Date;
      let validTo: Date;
      let valid = true;

      try {
        const cert = forge.pki.certificateFromPem(certificate);

        // Extract certificate information using forge
        issuer = this.extractCertificateField(cert.issuer.attributes, 'CN') || 
                 this.extractCertificateField(cert.issuer.attributes, 'O') || 
                 'Unknown Issuer';
        
        subject = this.extractCertificateField(cert.subject.attributes, 'CN') || 
                  cleanDomain;

        validFrom = cert.validity.notBefore;
        validTo = cert.validity.notAfter;

        // Check if self-signed (Requirement 5.4)
        const issuerCN = this.extractCertificateField(cert.issuer.attributes, 'CN') || '';
        const subjectCN = this.extractCertificateField(cert.subject.attributes, 'CN') || '';
        if (issuerCN === subjectCN && issuerCN !== '') {
          valid = false;
        }
      } catch (forgeError: any) {
        // node-forge doesn't support ECDSA/EC keys, use raw certificate data
        // Fetch certificate info directly from TLS connection
        const certInfo = await this.fetchSSLCertificateInfo(cleanDomain);
        issuer = certInfo.issuer;
        subject = certInfo.subject;
        validFrom = certInfo.validFrom;
        validTo = certInfo.validTo;
        
        // Check if self-signed
        if (certInfo.issuer === certInfo.subject) {
          valid = false;
        }
      }

      // Calculate days until expiry
      const now = new Date();
      const expiryDate = new Date(validTo);
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // Check if expired (Requirement 5.3)
      if (expiryDate < now) {
        valid = false;
      }

      // Check if not yet valid
      if (new Date(validFrom) > now) {
        valid = false;
      }

      return {
        valid,
        issuer,
        subject,
        validFrom,
        validTo,
        daysUntilExpiry,
      };

    } catch (error: any) {
      // Handle various SSL errors
      if (error.code === 'ENOTFOUND') {
        throw new AppError(
          'DOMAIN_NOT_FOUND',
          `Domain not found: ${cleanDomain}`,
          404,
          { domain: cleanDomain }
        );
      }

      if (error.code === 'ECONNREFUSED') {
        throw new AppError(
          'SSL_NOT_AVAILABLE',
          `SSL is not available for this domain. The domain may not support HTTPS.`,
          400,
          { domain: cleanDomain }
        );
      }

      if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
        throw new AppError(
          'TIMEOUT_ERROR',
          `SSL check timeout after ${TIMEOUTS.SSL_CHECK}ms`,
          408,
          { domain: cleanDomain, timeout: TIMEOUTS.SSL_CHECK }
        );
      }

      // Handle certificate validation errors (Requirement 5.4)
      if (error.message && error.message.includes('certificate')) {
        throw new AppError(
          'INVALID_CERTIFICATE',
          `Invalid or self-signed certificate: ${error.message}`,
          400,
          { domain: cleanDomain, error: error.message }
        );
      }

      // Generic SSL check error
      throw new AppError(
        'SSL_CHECK_FAILED',
        `SSL check failed: ${error.message}`,
        500,
        { domain: cleanDomain, error: error.message }
      );
    }
  }

  /**
   * Fetch SSL certificate from a domain
   * @param domain - Domain name
   * @returns PEM-encoded certificate string
   */
  private async fetchSSLCertificate(domain: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const options = {
        host: domain,
        port: 443,
        servername: domain,
        rejectUnauthorized: false, // Accept self-signed certificates for inspection
      };

      const socket = tls.connect(options, () => {
        const certificate = socket.getPeerCertificate(true);
        
        if (!certificate || Object.keys(certificate).length === 0) {
          socket.destroy();
          reject(new Error('No certificate found'));
          return;
        }

        // Get the raw certificate in PEM format
        const cert = socket.getPeerCertificate(true);
        const pemCert = this.convertToPEM(cert.raw);
        
        socket.destroy();
        resolve(pemCert);
      });

      socket.setTimeout(TIMEOUTS.SSL_CHECK);

      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error('Connection timeout'));
      });

      socket.on('error', (error) => {
        socket.destroy();
        reject(error);
      });
    });
  }

  /**
   * Convert raw certificate buffer to PEM format
   * @param raw - Raw certificate buffer
   * @returns PEM-encoded certificate string
   */
  private convertToPEM(raw: Buffer): string {
    const base64Cert = raw.toString('base64');
    const pemCert = `-----BEGIN CERTIFICATE-----\n${base64Cert.match(/.{1,64}/g)?.join('\n')}\n-----END CERTIFICATE-----`;
    return pemCert;
  }

  /**
   * Extract a specific field from certificate subject or issuer
   * @param attributes - Certificate subject or issuer attributes array
   * @param fieldName - Field name to extract (e.g., 'CN', 'O', 'OU')
   * @returns Field value or null if not found
   */
  private extractCertificateField(
    attributes: forge.pki.CertificateField[],
    fieldName: string
  ): string | null {
    const field = attributes.find(
      (attr) => attr.shortName === fieldName || attr.name === fieldName
    );
    return field && typeof field.value === 'string' ? field.value : null;
  }

  /**
   * Fetch SSL certificate info directly from TLS connection
   * Used as fallback for non-RSA certificates (ECDSA/EC keys)
   * @param domain - Domain name
   * @returns Certificate info object
   */
  private async fetchSSLCertificateInfo(domain: string): Promise<{
    issuer: string;
    subject: string;
    validFrom: Date;
    validTo: Date;
  }> {
    return new Promise((resolve, reject) => {
      const options = {
        host: domain,
        port: 443,
        servername: domain,
        rejectUnauthorized: false,
      };

      const socket = tls.connect(options, () => {
        const cert = socket.getPeerCertificate();
        
        if (!cert || Object.keys(cert).length === 0) {
          socket.destroy();
          reject(new Error('No certificate found'));
          return;
        }

        // Extract issuer CN or O
        const issuer = cert.issuer?.CN || cert.issuer?.O || 'Unknown Issuer';
        
        // Extract subject CN
        const subject = cert.subject?.CN || domain;

        // Parse validity dates
        const validFrom = new Date(cert.valid_from);
        const validTo = new Date(cert.valid_to);

        socket.destroy();
        resolve({ issuer, subject, validFrom, validTo });
      });

      socket.setTimeout(TIMEOUTS.SSL_CHECK);

      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error('Connection timeout'));
      });

      socket.on('error', (error) => {
        socket.destroy();
        reject(error);
      });
    });
  }

  /**
   * Check if a certificate is expiring soon (within 30 days)
   * @param daysUntilExpiry - Number of days until certificate expires
   * @returns true if expiring within 30 days, false otherwise
   */
  isExpiringWithin30Days(daysUntilExpiry: number): boolean {
    return daysUntilExpiry > 0 && daysUntilExpiry <= 30;
  }

  /**
   * Check if a certificate is expired
   * @param daysUntilExpiry - Number of days until certificate expires
   * @returns true if expired (negative days), false otherwise
   */
  isCertificateExpired(daysUntilExpiry: number): boolean {
    return daysUntilExpiry < 0;
  }
}
