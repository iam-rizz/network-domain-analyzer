/**
 * DNS Service
 * Provides DNS lookup and record fetching functionality
 */

import { promises as dns, Resolver } from 'dns';
import { promisify } from 'util';
import { DNSRecord, DNSRecordType, DNSResult, PropagationStatus, LocationResult } from '../models/dns.types';
import { AppError } from '../models/error.types';
import { validateDomain } from '../utils/validation';

// Public DNS servers for propagation checking (probe locations)
const PROBE_LOCATIONS = [
  { name: 'Google Primary', server: '8.8.8.8' },
  { name: 'Google Secondary', server: '8.8.4.4' },
  { name: 'Cloudflare Primary', server: '1.1.1.1' },
  { name: 'Cloudflare Secondary', server: '1.0.0.1' },
  { name: 'Quad9', server: '9.9.9.9' },
  { name: 'OpenDNS Primary', server: '208.67.222.222' },
  { name: 'OpenDNS Secondary', server: '208.67.220.220' },
];

export class DNSService {
  /**
   * Lookup DNS records for a domain
   * @param domain - Domain name to lookup
   * @param types - Optional array of record types to fetch (defaults to all)
   * @returns DNSResult with records and timestamp
   */
  async lookupRecords(
    domain: string,
    types?: DNSRecordType[]
  ): Promise<DNSResult> {
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
    const recordTypes: DNSRecordType[] = types || ['A', 'AAAA', 'MX', 'TXT', 'CNAME', 'NS', 'SOA'];
    const records: DNSRecord[] = [];
    const timestamp = new Date();

    // Fetch each record type
    for (const type of recordTypes) {
      try {
        const typeRecords = await this.fetchRecordsByType(normalizedDomain, type);
        records.push(...typeRecords);
      } catch (error) {
        // Continue with other record types if one fails
        // Some domains may not have all record types
        continue;
      }
    }

    // If no records found at all, throw error
    if (records.length === 0) {
      throw new AppError(
        'DNS_LOOKUP_FAILED',
        `No DNS records found for domain: ${normalizedDomain}`,
        404,
        { domain: normalizedDomain }
      );
    }

    return {
      domain: normalizedDomain,
      records,
      timestamp,
    };
  }

  /**
   * Fetch DNS records by specific type
   * @param domain - Domain name
   * @param type - DNS record type
   * @returns Array of DNS records
   */
  private async fetchRecordsByType(
    domain: string,
    type: DNSRecordType
  ): Promise<DNSRecord[]> {
    const records: DNSRecord[] = [];

    try {
      switch (type) {
        case 'A':
          const aRecords = await dns.resolve4(domain, { ttl: true });
          for (const record of aRecords) {
            records.push({
              type: 'A',
              value: record.address,
              ttl: record.ttl,
            });
          }
          break;

        case 'AAAA':
          const aaaaRecords = await dns.resolve6(domain, { ttl: true });
          for (const record of aaaaRecords) {
            records.push({
              type: 'AAAA',
              value: record.address,
              ttl: record.ttl,
            });
          }
          break;

        case 'MX':
          const mxRecords = await dns.resolveMx(domain);
          for (const record of mxRecords) {
            records.push({
              type: 'MX',
              value: `${record.priority} ${record.exchange}`,
              ttl: 0, // MX records don't return TTL in Node.js dns module
            });
          }
          break;

        case 'TXT':
          const txtRecords = await dns.resolveTxt(domain);
          for (const record of txtRecords) {
            records.push({
              type: 'TXT',
              value: record.join(''),
              ttl: 0, // TXT records don't return TTL in Node.js dns module
            });
          }
          break;

        case 'CNAME':
          const cnameRecords = await dns.resolveCname(domain);
          for (const record of cnameRecords) {
            records.push({
              type: 'CNAME',
              value: record,
              ttl: 0, // CNAME records don't return TTL in Node.js dns module
            });
          }
          break;

        case 'NS':
          const nsRecords = await dns.resolveNs(domain);
          for (const record of nsRecords) {
            records.push({
              type: 'NS',
              value: record,
              ttl: 0, // NS records don't return TTL in Node.js dns module
            });
          }
          break;

        case 'SOA':
          const soaRecord = await dns.resolveSoa(domain);
          records.push({
            type: 'SOA',
            value: `${soaRecord.nsname} ${soaRecord.hostmaster} ${soaRecord.serial}`,
            ttl: soaRecord.minttl,
          });
          break;

        default:
          throw new Error(`Unsupported DNS record type: ${type}`);
      }
    } catch (error: any) {
      // Re-throw with more context
      if (error.code === 'ENOTFOUND') {
        throw new AppError(
          'DNS_LOOKUP_FAILED',
          `DNS lookup failed: Domain not found`,
          404,
          { domain, type }
        );
      } else if (error.code === 'ENODATA') {
        // No data for this record type - this is normal, just return empty
        return [];
      } else if (error.code === 'ETIMEOUT') {
        throw new AppError(
          'TIMEOUT_ERROR',
          `DNS lookup timeout for ${type} records`,
          408,
          { domain, type }
        );
      } else {
        throw new AppError(
          'DNS_LOOKUP_FAILED',
          `DNS lookup failed: ${error.message}`,
          500,
          { domain, type, originalError: error.message }
        );
      }
    }

    return records;
  }

  /**
   * Check DNS propagation across multiple locations
   * @param domain - Domain name to check
   * @param recordType - DNS record type to check
   * @returns PropagationStatus with results from all locations
   */
  async checkPropagation(
    domain: string,
    recordType: DNSRecordType
  ): Promise<PropagationStatus> {
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
    
    // Use at least 5 probe locations as per requirement 2.1
    const locationsToProbe = PROBE_LOCATIONS.slice(0, 5);
    
    // Query all locations in parallel
    const locationPromises = locationsToProbe.map(location =>
      this.queryLocationWithResilience(normalizedDomain, recordType, location.name, location.server)
    );

    const locationResults = await Promise.all(locationPromises);

    // Detect inconsistencies
    const inconsistencies = this.detectInconsistencies(locationResults);

    // Determine if fully propagated
    const fullyPropagated = this.isFullyPropagated(locationResults);

    return {
      fullyPropagated,
      locations: locationResults,
      inconsistencies,
    };
  }

  /**
   * Query a specific DNS location with error resilience
   * @param domain - Domain name
   * @param recordType - DNS record type
   * @param locationName - Name of the probe location
   * @param dnsServer - DNS server IP address
   * @returns LocationResult with status and records
   */
  private async queryLocationWithResilience(
    domain: string,
    recordType: DNSRecordType,
    locationName: string,
    dnsServer: string
  ): Promise<LocationResult> {
    const startTime = Date.now();

    try {
      // Create a custom resolver for this specific DNS server
      const resolver = new Resolver();
      resolver.setServers([dnsServer]);

      const records = await this.fetchRecordsByTypeWithResolver(
        domain,
        recordType,
        resolver
      );

      const responseTime = Date.now() - startTime;

      return {
        location: locationName,
        status: 'success',
        records,
        responseTime,
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;

      // If the location fails, mark it as unavailable but don't fail the entire check
      if (error.code === 'ENOTFOUND' || error.code === 'ENODATA') {
        return {
          location: locationName,
          status: 'failure',
          records: [],
          responseTime,
        };
      } else if (error.code === 'ETIMEOUT' || error.code === 'ECONNREFUSED') {
        return {
          location: locationName,
          status: 'unavailable',
          records: [],
          responseTime,
        };
      } else {
        return {
          location: locationName,
          status: 'unavailable',
          records: [],
          responseTime,
        };
      }
    }
  }

  /**
   * Fetch DNS records using a custom resolver
   * @param domain - Domain name
   * @param type - DNS record type
   * @param resolver - Custom DNS resolver
   * @returns Array of DNS records
   */
  private async fetchRecordsByTypeWithResolver(
    domain: string,
    type: DNSRecordType,
    resolver: Resolver
  ): Promise<DNSRecord[]> {
    const records: DNSRecord[] = [];

    // Promisify resolver methods
    const resolve4 = promisify(resolver.resolve4.bind(resolver));
    const resolve6 = promisify(resolver.resolve6.bind(resolver));
    const resolveMx = promisify(resolver.resolveMx.bind(resolver));
    const resolveTxt = promisify(resolver.resolveTxt.bind(resolver));
    const resolveCname = promisify(resolver.resolveCname.bind(resolver));
    const resolveNs = promisify(resolver.resolveNs.bind(resolver));
    const resolveSoa = promisify(resolver.resolveSoa.bind(resolver));

    switch (type) {
      case 'A':
        const aRecords = await resolve4(domain, { ttl: true }) as any[];
        for (const record of aRecords) {
          records.push({
            type: 'A',
            value: record.address,
            ttl: record.ttl,
          });
        }
        break;

      case 'AAAA':
        const aaaaRecords = await resolve6(domain, { ttl: true }) as any[];
        for (const record of aaaaRecords) {
          records.push({
            type: 'AAAA',
            value: record.address,
            ttl: record.ttl,
          });
        }
        break;

      case 'MX':
        const mxRecords = await resolveMx(domain) as any[];
        for (const record of mxRecords) {
          records.push({
            type: 'MX',
            value: `${record.priority} ${record.exchange}`,
            ttl: 0,
          });
        }
        break;

      case 'TXT':
        const txtRecords = await resolveTxt(domain) as string[][];
        for (const record of txtRecords) {
          records.push({
            type: 'TXT',
            value: record.join(''),
            ttl: 0,
          });
        }
        break;

      case 'CNAME':
        const cnameRecords = await resolveCname(domain) as string[];
        for (const record of cnameRecords) {
          records.push({
            type: 'CNAME',
            value: record,
            ttl: 0,
          });
        }
        break;

      case 'NS':
        const nsRecords = await resolveNs(domain) as string[];
        for (const record of nsRecords) {
          records.push({
            type: 'NS',
            value: record,
            ttl: 0,
          });
        }
        break;

      case 'SOA':
        const soaRecord = await resolveSoa(domain) as any;
        records.push({
          type: 'SOA',
          value: `${soaRecord.nsname} ${soaRecord.hostmaster} ${soaRecord.serial}`,
          ttl: soaRecord.minttl,
        });
        break;

      default:
        throw new Error(`Unsupported DNS record type: ${type}`);
    }

    return records;
  }

  /**
   * Detect inconsistencies between location results
   * @param locationResults - Results from all probe locations
   * @returns Array of inconsistency descriptions
   */
  private detectInconsistencies(locationResults: LocationResult[]): string[] {
    const inconsistencies: string[] = [];
    
    // Get successful results only
    const successfulResults = locationResults.filter(
      result => result.status === 'success' && result.records.length > 0
    );

    if (successfulResults.length === 0) {
      return inconsistencies;
    }

    // Compare each location's records with the first successful location
    const referenceRecords = successfulResults[0].records;
    const referenceLocation = successfulResults[0].location;

    for (let i = 1; i < successfulResults.length; i++) {
      const currentResult = successfulResults[i];
      
      if (!this.areRecordSetsEqual(referenceRecords, currentResult.records)) {
        inconsistencies.push(
          `Records differ between ${referenceLocation} and ${currentResult.location}`
        );
      }
    }

    return inconsistencies;
  }

  /**
   * Check if DNS is fully propagated (all locations return same results)
   * @param locationResults - Results from all probe locations
   * @returns True if fully propagated, false otherwise
   */
  private isFullyPropagated(locationResults: LocationResult[]): boolean {
    // Get successful results only
    const successfulResults = locationResults.filter(
      result => result.status === 'success' && result.records.length > 0
    );

    // Need at least 2 successful results to determine propagation
    if (successfulResults.length < 2) {
      return false;
    }

    // All successful results should have identical records
    const referenceRecords = successfulResults[0].records;

    for (let i = 1; i < successfulResults.length; i++) {
      if (!this.areRecordSetsEqual(referenceRecords, successfulResults[i].records)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Compare two sets of DNS records for equality
   * @param records1 - First set of records
   * @param records2 - Second set of records
   * @returns True if record sets are equal, false otherwise
   */
  private areRecordSetsEqual(records1: DNSRecord[], records2: DNSRecord[]): boolean {
    if (records1.length !== records2.length) {
      return false;
    }

    // Sort records by value for comparison
    const sorted1 = [...records1].sort((a, b) => a.value.localeCompare(b.value));
    const sorted2 = [...records2].sort((a, b) => a.value.localeCompare(b.value));

    for (let i = 0; i < sorted1.length; i++) {
      if (
        sorted1[i].type !== sorted2[i].type ||
        sorted1[i].value !== sorted2[i].value
      ) {
        return false;
      }
    }

    return true;
  }
}
