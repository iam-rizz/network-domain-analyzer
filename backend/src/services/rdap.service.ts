/**
 * RDAP Service
 * Provides RDAP (Registration Data Access Protocol) lookup functionality
 * with fallback to WHOIS when RDAP is not available
 */

import axios, { AxiosError } from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as whois from 'whois';
import { promisify } from 'util';
import { RDAPBootstrapData, RDAPResult, WHOISResult } from '../models/whois.types';
import { AppError } from '../models/error.types';
import { validateDomain } from '../utils/validation';

const whoisLookup = promisify(whois.lookup);

// Timeout for RDAP queries (10 seconds as per requirement 13.7)
const RDAP_TIMEOUT = 10000;

export class RDAPService {
  private bootstrapData: RDAPBootstrapData | null = null;
  private bootstrapFilePath: string;

  constructor(bootstrapFilePath: string = '../dns.json') {
    this.bootstrapFilePath = bootstrapFilePath;
  }

  /**
   * Initialize the service by loading RDAP bootstrap data
   * @throws AppError if bootstrap file cannot be loaded
   */
  async initialize(): Promise<void> {
    try {
      // Load bootstrap data from dns.json file (Requirement 13.1)
      const absolutePath = path.resolve(process.cwd(), this.bootstrapFilePath);
      const fileContent = await fs.readFile(absolutePath, 'utf-8');
      this.bootstrapData = JSON.parse(fileContent);

      // Validate bootstrap data structure
      if (!this.bootstrapData || !this.bootstrapData.services || !Array.isArray(this.bootstrapData.services)) {
        throw new Error('Invalid bootstrap data structure');
      }
    } catch (error: any) {
      throw new AppError(
        'BOOTSTRAP_LOAD_FAILED',
        `Failed to load RDAP bootstrap data: ${error.message}`,
        500,
        { filePath: this.bootstrapFilePath, error: error.message }
      );
    }
  }

  /**
   * Lookup domain information using RDAP with fallback to WHOIS
   * @param domain - Domain name to lookup
   * @returns RDAPResult with domain information
   */
  async lookupDomain(domain: string): Promise<RDAPResult> {
    // Validate domain
    const validation = validateDomain(domain);
    if (!validation.valid) {
      throw new AppError(
        'INVALID_DOMAIN',
        validation.errors[0]?.message || 'Invalid domain format',
        400,
        { errors: validation.errors }
      );
    }

    const normalizedDomain = validation.domain!;

    // Ensure bootstrap data is loaded
    if (!this.bootstrapData) {
      await this.initialize();
    }

    // Extract TLD from domain (Requirement 13.2)
    const tld = this.extractTLD(normalizedDomain);

    // Find RDAP server for this TLD (Requirement 13.3)
    const rdapServer = this.findRDAPServer(tld);

    // If RDAP server found, try RDAP query first
    if (rdapServer) {
      try {
        // Query RDAP server (Requirement 13.3, 13.4)
        const rdapResult = await this.queryRDAPServer(rdapServer, normalizedDomain);
        return rdapResult;
      } catch (error: any) {
        // If RDAP fails, fallback to WHOIS (Requirement 13.6)
        console.warn(`RDAP query failed for ${normalizedDomain}, falling back to WHOIS:`, error.message);
        return await this.fallbackToWHOIS(normalizedDomain);
      }
    } else {
      // TLD not found in bootstrap data, fallback to WHOIS (Requirement 13.5)
      return await this.fallbackToWHOIS(normalizedDomain);
    }
  }

  /**
   * Extract TLD from domain name
   * @param domain - Domain name
   * @returns TLD (e.g., "com", "co.uk", "xn--p1ai")
   */
  extractTLD(domain: string): string {
    const parts = domain.toLowerCase().split('.');
    
    // Handle multi-part TLDs (e.g., co.uk, com.au)
    // For simplicity, we'll try the last part first, then last two parts
    if (parts.length >= 2) {
      // Try last two parts for country-code second-level domains
      const twoPartTLD = parts.slice(-2).join('.');
      if (this.isTLDInBootstrap(twoPartTLD)) {
        return twoPartTLD;
      }
    }
    
    // Return last part as TLD
    return parts[parts.length - 1];
  }

  /**
   * Check if a TLD exists in bootstrap data
   * @param tld - TLD to check
   * @returns true if TLD is in bootstrap data
   */
  private isTLDInBootstrap(tld: string): boolean {
    if (!this.bootstrapData) {
      return false;
    }

    for (const service of this.bootstrapData.services) {
      const tlds = service[0];
      if (tlds.includes(tld)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Find RDAP server URL for a given TLD
   * @param tld - TLD to lookup
   * @returns RDAP server URL or null if not found
   */
  findRDAPServer(tld: string): string | null {
    if (!this.bootstrapData) {
      return null;
    }

    // Search through bootstrap services
    for (const service of this.bootstrapData.services) {
      const tlds = service[0];
      const servers = service[1];

      // Check if this service handles the TLD
      if (tlds.includes(tld)) {
        // Return the first server URL
        return servers.length > 0 ? servers[0] : null;
      }
    }

    return null;
  }

  /**
   * Query RDAP server for domain information
   * @param serverUrl - RDAP server base URL
   * @param domain - Domain name to query
   * @returns RDAPResult with parsed domain information
   */
  async queryRDAPServer(serverUrl: string, domain: string): Promise<RDAPResult> {
    try {
      // Construct RDAP query URL
      // RDAP domain query format: {server}/domain/{domain}
      const queryUrl = `${serverUrl.replace(/\/$/, '')}/domain/${domain}`;

      // Make RDAP query with timeout (Requirement 13.7)
      const response = await axios.get(queryUrl, {
        timeout: RDAP_TIMEOUT,
        headers: {
          'Accept': 'application/rdap+json',
          'User-Agent': 'Network-Domain-Analyzer/1.0',
        },
      });

      // Parse RDAP response (Requirement 13.4, 13.7)
      return this.parseRDAPResponse(response.data, domain);
    } catch (error: any) {
      // Handle timeout errors
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        throw new AppError(
          'RDAP_TIMEOUT',
          `RDAP query timeout after ${RDAP_TIMEOUT}ms`,
          408,
          { domain, serverUrl, timeout: RDAP_TIMEOUT }
        );
      }

      // Handle HTTP errors
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        if (axiosError.response) {
          throw new AppError(
            'RDAP_QUERY_FAILED',
            `RDAP query failed with status ${axiosError.response.status}`,
            axiosError.response.status,
            { domain, serverUrl, status: axiosError.response.status }
          );
        }
      }

      // Generic error
      throw new AppError(
        'RDAP_QUERY_FAILED',
        `RDAP query failed: ${error.message}`,
        500,
        { domain, serverUrl, error: error.message }
      );
    }
  }

  /**
   * Parse RDAP JSON response into RDAPResult
   * @param data - RDAP response data
   * @param domain - Domain name
   * @returns RDAPResult with structured domain information
   */
  parseRDAPResponse(data: any, domain: string): RDAPResult {
    try {
      // Extract registrar information
      let registrar = 'Unknown';
      if (data.entities && Array.isArray(data.entities)) {
        const registrarEntity = data.entities.find((entity: any) =>
          entity.roles && entity.roles.includes('registrar')
        );
        if (registrarEntity && registrarEntity.vcardArray) {
          // Parse vCard data for registrar name
          const vcard = registrarEntity.vcardArray[1];
          if (Array.isArray(vcard)) {
            const fnField = vcard.find((field: any) => field[0] === 'fn');
            if (fnField && fnField[3]) {
              registrar = fnField[3];
            }
          }
        }
      }

      // Extract dates
      let registrationDate = new Date();
      let expirationDate = new Date();

      if (data.events && Array.isArray(data.events)) {
        const registrationEvent = data.events.find((event: any) =>
          event.eventAction === 'registration'
        );
        if (registrationEvent && registrationEvent.eventDate) {
          registrationDate = new Date(registrationEvent.eventDate);
        }

        const expirationEvent = data.events.find((event: any) =>
          event.eventAction === 'expiration'
        );
        if (expirationEvent && expirationEvent.eventDate) {
          expirationDate = new Date(expirationEvent.eventDate);
        }
      }

      // Extract nameservers
      const nameServers: string[] = [];
      if (data.nameservers && Array.isArray(data.nameservers)) {
        for (const ns of data.nameservers) {
          if (ns.ldhName) {
            nameServers.push(ns.ldhName);
          }
        }
      }

      // Extract status
      const status: string[] = [];
      if (data.status && Array.isArray(data.status)) {
        status.push(...data.status);
      }

      return {
        domain,
        registrar,
        registrationDate,
        expirationDate,
        nameServers,
        status,
        source: 'rdap',
        timestamp: new Date(),
      };
    } catch (error: any) {
      throw new AppError(
        'RDAP_PARSE_FAILED',
        `Failed to parse RDAP response: ${error.message}`,
        500,
        { domain, error: error.message }
      );
    }
  }

  /**
   * Fallback to traditional WHOIS lookup
   * @param domain - Domain name to lookup
   * @returns RDAPResult with WHOIS data (marked as 'whois' source)
   */
  private async fallbackToWHOIS(domain: string): Promise<RDAPResult> {
    try {
      // Perform WHOIS lookup
      const whoisData = await whoisLookup(domain);

      // Parse WHOIS data
      const parsed = this.parseWHOISData(String(whoisData), domain);

      // Convert WHOISResult to RDAPResult format
      return {
        domain: parsed.domain,
        registrar: parsed.registrar,
        registrationDate: parsed.registrationDate,
        expirationDate: parsed.expirationDate,
        nameServers: parsed.nameServers,
        status: parsed.status,
        source: 'whois',
        timestamp: parsed.timestamp,
      };
    } catch (error: any) {
      throw new AppError(
        'WHOIS_LOOKUP_FAILED',
        `WHOIS lookup failed: ${error.message}`,
        500,
        { domain, error: error.message }
      );
    }
  }

  /**
   * Parse raw WHOIS data into structured format
   * @param rawData - Raw WHOIS response string
   * @param domain - Domain name
   * @returns WHOISResult with parsed information
   */
  private parseWHOISData(rawData: string, domain: string): WHOISResult {
    const lines = rawData.split('\n');
    
    let registrar = 'Unknown';
    let registrationDate = new Date();
    let expirationDate = new Date();
    const nameServers: string[] = [];
    const status: string[] = [];

    // Parse WHOIS data line by line
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith('%') || trimmedLine.startsWith('#')) {
        continue;
      }

      // Parse registrar
      if (trimmedLine.match(/^Registrar:/i)) {
        registrar = trimmedLine.split(':')[1]?.trim() || registrar;
      }

      // Parse registration date
      if (trimmedLine.match(/^Creation Date:/i) || trimmedLine.match(/^Created:/i)) {
        const dateStr = trimmedLine.split(':').slice(1).join(':').trim();
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) {
          registrationDate = parsed;
        }
      }

      // Parse expiration date
      if (trimmedLine.match(/^Registry Expiry Date:/i) || 
          trimmedLine.match(/^Expiration Date:/i) ||
          trimmedLine.match(/^Expires:/i)) {
        const dateStr = trimmedLine.split(':').slice(1).join(':').trim();
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) {
          expirationDate = parsed;
        }
      }

      // Parse nameservers
      if (trimmedLine.match(/^Name Server:/i) || trimmedLine.match(/^Nameserver:/i)) {
        const ns = trimmedLine.split(':')[1]?.trim().toLowerCase();
        if (ns && !nameServers.includes(ns)) {
          nameServers.push(ns);
        }
      }

      // Parse status
      if (trimmedLine.match(/^Domain Status:/i) || trimmedLine.match(/^Status:/i)) {
        const statusValue = trimmedLine.split(':')[1]?.trim();
        if (statusValue && !status.includes(statusValue)) {
          status.push(statusValue);
        }
      }
    }

    return {
      domain,
      registrar,
      registrationDate,
      expirationDate,
      nameServers,
      status,
      timestamp: new Date(),
    };
  }

  /**
   * Get bootstrap data information
   * @returns Object with TLD count and server count
   */
  getBootstrapInfo(): { tlds: string[], serverCount: number } {
    if (!this.bootstrapData) {
      return { tlds: [], serverCount: 0 };
    }

    const allTLDs: string[] = [];
    const uniqueServers = new Set<string>();

    for (const service of this.bootstrapData.services) {
      const tlds = service[0];
      const servers = service[1];

      allTLDs.push(...tlds);
      servers.forEach(server => uniqueServers.add(server));
    }

    return {
      tlds: allTLDs,
      serverCount: uniqueServers.size,
    };
  }
}
