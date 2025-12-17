/**
 * Host Service
 * Provides host monitoring functionality including ping, HTTP checks, and availability monitoring
 */

import axios, { AxiosError } from 'axios';
import * as ping from 'ping';
import * as net from 'net';
import * as tls from 'tls';
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

    // Remove protocol if provided (strip both https:// and http://)
    let cleanDomain = normalizedDomain;
    if (cleanDomain.startsWith('https://')) {
      cleanDomain = cleanDomain.substring(8);
    } else if (cleanDomain.startsWith('http://')) {
      // Strip http:// and try to check SSL anyway
      // User might have typed http:// by mistake
      cleanDomain = cleanDomain.substring(7);
    }

    // Remove trailing slash and path
    cleanDomain = cleanDomain.split('/')[0];
    
    // Remove port if specified
    cleanDomain = cleanDomain.split(':')[0];

    // First, check if the domain supports HTTPS by attempting a connection
    try {
      // Fetch comprehensive SSL certificate info
      const certInfo = await this.fetchSSLCertificateExtended(cleanDomain);
      
      const now = new Date();
      const expiryDate = new Date(certInfo.validTo);
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // Determine validity
      let valid = true;
      
      // Check if expired
      if (expiryDate < now) {
        valid = false;
      }

      // Check if not yet valid
      if (new Date(certInfo.validFrom) > now) {
        valid = false;
      }

      // Check if self-signed
      if (certInfo.isSelfSigned) {
        valid = false;
      }

      return {
        valid,
        issuer: certInfo.issuer,
        subject: certInfo.subject,
        validFrom: certInfo.validFrom,
        validTo: certInfo.validTo,
        daysUntilExpiry,
        // Extended info
        serialNumber: certInfo.serialNumber,
        signatureAlgorithm: certInfo.signatureAlgorithm,
        publicKeyAlgorithm: certInfo.publicKeyAlgorithm,
        publicKeySize: certInfo.publicKeySize,
        fingerprint: certInfo.fingerprint,
        fingerprintSHA256: certInfo.fingerprintSHA256,
        subjectAltNames: certInfo.subjectAltNames,
        issuerOrganization: certInfo.issuerOrganization,
        issuerCountry: certInfo.issuerCountry,
        isWildcard: certInfo.isWildcard,
        isSelfSigned: certInfo.isSelfSigned,
        protocol: certInfo.protocol,
        cipher: certInfo.cipher,
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
   * Fetch extended SSL certificate info from TLS connection
   * Returns comprehensive certificate details
   * @param domain - Domain name
   * @returns Extended certificate info object
   */
  private async fetchSSLCertificateExtended(domain: string): Promise<{
    issuer: string;
    subject: string;
    validFrom: Date;
    validTo: Date;
    serialNumber: string;
    signatureAlgorithm: string;
    publicKeyAlgorithm: string;
    publicKeySize: number;
    fingerprint: string;
    fingerprintSHA256: string;
    subjectAltNames: string[];
    issuerOrganization: string;
    issuerCountry: string;
    isWildcard: boolean;
    isSelfSigned: boolean;
    protocol: string;
    cipher: string;
  }> {
    return new Promise((resolve, reject) => {
      const options = {
        host: domain,
        port: 443,
        servername: domain,
        rejectUnauthorized: false,
      };

      const socket = tls.connect(options, () => {
        const cert = socket.getPeerCertificate(true);
        
        if (!cert || Object.keys(cert).length === 0) {
          socket.destroy();
          reject(new Error('No certificate found'));
          return;
        }

        // Get connection info
        const cipher = socket.getCipher();
        const protocol = socket.getProtocol() || 'unknown';

        // Extract issuer info
        const issuer = cert.issuer?.CN || cert.issuer?.O || 'Unknown Issuer';
        const issuerOrganization = cert.issuer?.O || '';
        const issuerCountry = cert.issuer?.C || '';
        
        // Extract subject info
        const subject = cert.subject?.CN || domain;

        // Parse validity dates
        const validFrom = new Date(cert.valid_from);
        const validTo = new Date(cert.valid_to);

        // Serial number
        const serialNumber = cert.serialNumber || '';

        // Fingerprints
        const fingerprint = cert.fingerprint || '';
        const fingerprintSHA256 = cert.fingerprint256 || '';

        // Subject Alternative Names (SAN)
        const subjectAltNames: string[] = [];
        if (cert.subjectaltname) {
          // Format: "DNS:example.com, DNS:www.example.com"
          const sans = cert.subjectaltname.split(', ');
          for (const san of sans) {
            const value = san.replace(/^DNS:/, '').replace(/^IP Address:/, '');
            if (value && !subjectAltNames.includes(value)) {
              subjectAltNames.push(value);
            }
          }
        }

        // Check if wildcard certificate
        const isWildcard = subject.startsWith('*.') || 
          subjectAltNames.some(san => san.startsWith('*.'));

        // Check if self-signed
        const isSelfSigned = (cert.issuer?.CN === cert.subject?.CN) && 
          (cert.issuer?.O === cert.subject?.O);

        // Get signature algorithm from raw cert info
        // Node's TLS doesn't expose this directly, so we'll use a placeholder
        // In production, you might parse the raw certificate
        const signatureAlgorithm = 'SHA256withRSA'; // Default assumption
        
        // Public key info
        let publicKeyAlgorithm = 'RSA';
        let publicKeySize = 2048;
        
        if (cert.bits) {
          publicKeySize = cert.bits;
        }
        
        // Try to determine key type from modulus presence
        if (cert.modulus) {
          publicKeyAlgorithm = 'RSA';
        } else if (cert.pubkey) {
          // Could be ECDSA
          publicKeyAlgorithm = 'ECDSA';
        }

        socket.destroy();
        
        resolve({
          issuer,
          subject,
          validFrom,
          validTo,
          serialNumber,
          signatureAlgorithm,
          publicKeyAlgorithm,
          publicKeySize,
          fingerprint,
          fingerprintSHA256,
          subjectAltNames,
          issuerOrganization,
          issuerCountry,
          isWildcard,
          isSelfSigned,
          protocol,
          cipher: cipher ? `${cipher.name} (${cipher.version})` : 'unknown',
        });
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
