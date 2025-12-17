/**
 * DNS Service
 * Provides DNS lookup and record fetching functionality
 */

import { promises as dns, Resolver } from 'dns';
import { promisify } from 'util';
import { DNSRecord, DNSRecordType, DNSResult, PropagationStatus, LocationResult } from '../models/dns.types';
import { AppError } from '../models/error.types';
import { validateDomain } from '../utils/validation';

/**
 * DNS Probe Location interface
 */
export interface ProbeLocation {
  name: string;
  server: string;
  region: 'americas' | 'europe' | 'asia' | 'oceania' | 'global';
  country?: string;
}

/**
 * Available regions for DNS propagation check
 */
export type ProbeRegion = 'americas' | 'europe' | 'asia' | 'oceania' | 'global' | 'all';

/**
 * Public DNS servers for propagation checking, organized by region
 * These are reliable public DNS servers from various providers worldwide
 */
export const DNS_PROBE_LOCATIONS: ProbeLocation[] = [
  // === AMERICAS ===
  { name: 'Google (USA)', server: '8.8.8.8', region: 'americas', country: 'USA' },
  { name: 'Google Secondary (USA)', server: '8.8.4.4', region: 'americas', country: 'USA' },
  { name: 'Cloudflare (USA)', server: '1.1.1.1', region: 'americas', country: 'USA' },
  { name: 'Cloudflare Secondary (USA)', server: '1.0.0.1', region: 'americas', country: 'USA' },
  { name: 'OpenDNS (USA)', server: '208.67.222.222', region: 'americas', country: 'USA' },
  { name: 'OpenDNS Secondary (USA)', server: '208.67.220.220', region: 'americas', country: 'USA' },
  { name: 'Quad9 (USA)', server: '9.9.9.9', region: 'americas', country: 'USA' },
  { name: 'Level3 (USA)', server: '4.2.2.1', region: 'americas', country: 'USA' },
  { name: 'Comodo (USA)', server: '8.26.56.26', region: 'americas', country: 'USA' },
  { name: 'Verisign (USA)', server: '64.6.64.6', region: 'americas', country: 'USA' },
  { name: 'CleanBrowsing (USA)', server: '185.228.168.9', region: 'americas', country: 'USA' },
  
  // === EUROPE ===
  { name: 'DNS.Watch (Germany)', server: '84.200.69.80', region: 'europe', country: 'Germany' },
  { name: 'DNS.Watch Secondary (Germany)', server: '84.200.70.40', region: 'europe', country: 'Germany' },
  { name: 'Freenom (Netherlands)', server: '80.80.80.80', region: 'europe', country: 'Netherlands' },
  { name: 'Freenom Secondary (Netherlands)', server: '80.80.81.81', region: 'europe', country: 'Netherlands' },
  { name: 'UncensoredDNS (Denmark)', server: '91.239.100.100', region: 'europe', country: 'Denmark' },
  { name: 'AdGuard (Cyprus)', server: '94.140.14.14', region: 'europe', country: 'Cyprus' },
  { name: 'AdGuard Secondary (Cyprus)', server: '94.140.15.15', region: 'europe', country: 'Cyprus' },
  { name: 'Mullvad (Sweden)', server: '194.242.2.2', region: 'europe', country: 'Sweden' },
  
  // === ASIA ===
  { name: 'Yandex (Russia)', server: '77.88.8.8', region: 'asia', country: 'Russia' },
  { name: 'Yandex Secondary (Russia)', server: '77.88.8.1', region: 'asia', country: 'Russia' },
  { name: 'AliDNS (China)', server: '223.5.5.5', region: 'asia', country: 'China' },
  { name: 'AliDNS Secondary (China)', server: '223.6.6.6', region: 'asia', country: 'China' },
  { name: 'DNSPod (China)', server: '119.29.29.29', region: 'asia', country: 'China' },
  { name: '114DNS (China)', server: '114.114.114.114', region: 'asia', country: 'China' },
  { name: 'TWNIC (Taiwan)', server: '101.101.101.101', region: 'asia', country: 'Taiwan' },
  { name: 'IIJ (Japan)', server: '210.130.0.1', region: 'asia', country: 'Japan' },
  { name: 'KT (South Korea)', server: '168.126.63.1', region: 'asia', country: 'South Korea' },
  { name: 'SingNet (Singapore)', server: '165.21.83.88', region: 'asia', country: 'Singapore' },
  
  // === OCEANIA ===
  { name: 'Cloudflare APAC (Australia)', server: '1.1.1.1', region: 'oceania', country: 'Australia' },
  { name: 'Telstra (Australia)', server: '139.130.4.5', region: 'oceania', country: 'Australia' },
  
  // === GLOBAL (Anycast - multiple locations) ===
  { name: 'Cloudflare Anycast', server: '1.1.1.1', region: 'global' },
  { name: 'Google Anycast', server: '8.8.8.8', region: 'global' },
  { name: 'Quad9 Anycast', server: '9.9.9.9', region: 'global' },
];

/**
 * Get probe locations by region
 * @param regions - Array of regions to include, or 'all' for all regions
 * @returns Filtered probe locations
 */
export function getProbeLocationsByRegion(regions: ProbeRegion | ProbeRegion[]): ProbeLocation[] {
  const regionArray = Array.isArray(regions) ? regions : [regions];
  
  if (regionArray.includes('all')) {
    // Return unique servers (avoid duplicates from global/regional overlap)
    const seen = new Set<string>();
    return DNS_PROBE_LOCATIONS.filter(loc => {
      if (seen.has(loc.server)) return false;
      seen.add(loc.server);
      return true;
    });
  }
  
  const seen = new Set<string>();
  return DNS_PROBE_LOCATIONS.filter(loc => {
    if (seen.has(loc.server)) return false;
    if (regionArray.includes(loc.region)) {
      seen.add(loc.server);
      return true;
    }
    return false;
  });
}

/**
 * Parse custom DNS servers from environment variable
 * Format: "Name1:IP1,Name2:IP2" or just "IP1,IP2"
 * @returns Array of custom probe locations
 */
function parseCustomDNSServers(): ProbeLocation[] {
  const customServers = process.env.DNS_PROBE_SERVERS;
  if (!customServers) return [];
  
  const locations: ProbeLocation[] = [];
  const entries = customServers.split(',').map(s => s.trim()).filter(Boolean);
  
  for (const entry of entries) {
    if (entry.includes(':')) {
      const [name, server] = entry.split(':').map(s => s.trim());
      if (name && server) {
        locations.push({ name, server, region: 'global' });
      }
    } else {
      // Just IP address
      locations.push({ name: `Custom (${entry})`, server: entry, region: 'global' });
    }
  }
  
  return locations;
}

/**
 * Get default probe locations (from env or defaults)
 * @returns Array of probe locations to use
 */
function getDefaultProbeLocations(): ProbeLocation[] {
  // Check for custom servers first
  const customServers = parseCustomDNSServers();
  if (customServers.length > 0) {
    return customServers;
  }
  
  // Check for region preference from env
  const regionPref = process.env.DNS_PROBE_REGIONS;
  if (regionPref) {
    const regions = regionPref.split(',').map(r => r.trim().toLowerCase()) as ProbeRegion[];
    return getProbeLocationsByRegion(regions);
  }
  
  // Default: use a balanced mix from all regions
  return getProbeLocationsByRegion(['americas', 'europe', 'asia']);
}

// Legacy export for backward compatibility
export const PROBE_LOCATIONS = getDefaultProbeLocations().slice(0, 7);

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
   * @param options - Optional configuration for probe locations
   * @returns PropagationStatus with results from all locations
   */
  async checkPropagation(
    domain: string,
    recordType: DNSRecordType,
    options?: {
      regions?: ProbeRegion[];
      maxLocations?: number;
      customServers?: Array<{ name: string; server: string }>;
    }
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
    
    // Determine which locations to probe
    let locationsToProbe: ProbeLocation[];
    
    if (options?.customServers && options.customServers.length > 0) {
      // Use custom servers if provided
      locationsToProbe = options.customServers.map(s => ({
        name: s.name,
        server: s.server,
        region: 'global' as const,
      }));
    } else if (options?.regions && options.regions.length > 0) {
      // Use specified regions
      locationsToProbe = getProbeLocationsByRegion(options.regions);
    } else {
      // Use default locations
      locationsToProbe = getDefaultProbeLocations();
    }
    
    // Limit number of locations if specified (default from env or 20)
    const defaultMaxLocations = parseInt(process.env.DNS_PROBE_MAX_LOCATIONS || '20', 10);
    const maxLocations = options?.maxLocations || defaultMaxLocations;
    locationsToProbe = locationsToProbe.slice(0, maxLocations);
    
    // Ensure at least 5 probe locations as per requirement 2.1
    if (locationsToProbe.length < 5) {
      // Fill with defaults if not enough
      const defaults = getProbeLocationsByRegion('all');
      const existingServers = new Set(locationsToProbe.map(l => l.server));
      for (const loc of defaults) {
        if (!existingServers.has(loc.server)) {
          locationsToProbe.push(loc);
          if (locationsToProbe.length >= 5) break;
        }
      }
    }
    
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
   * Get available probe locations grouped by region
   * @returns Object with regions and their probe locations
   */
  getAvailableProbeLocations(): Record<ProbeRegion, ProbeLocation[]> {
    return {
      americas: getProbeLocationsByRegion('americas'),
      europe: getProbeLocationsByRegion('europe'),
      asia: getProbeLocationsByRegion('asia'),
      oceania: getProbeLocationsByRegion('oceania'),
      global: getProbeLocationsByRegion('global'),
      all: getProbeLocationsByRegion('all'),
    };
  }

  /**
   * Get probe locations for propagation check based on options
   * @param options - Configuration options
   * @returns Array of probe locations to use
   */
  getProbeLocationsForCheck(options?: {
    regions?: ProbeRegion[];
    maxLocations?: number;
    customServers?: Array<{ name: string; server: string }>;
  }): ProbeLocation[] {
    let locationsToProbe: ProbeLocation[];
    
    if (options?.customServers && options.customServers.length > 0) {
      locationsToProbe = options.customServers.map(s => ({
        name: s.name,
        server: s.server,
        region: 'global' as const,
      }));
    } else if (options?.regions && options.regions.length > 0) {
      locationsToProbe = getProbeLocationsByRegion(options.regions);
    } else {
      locationsToProbe = getDefaultProbeLocations();
    }
    
    const defaultMaxLocations = parseInt(process.env.DNS_PROBE_MAX_LOCATIONS || '20', 10);
    const maxLocations = options?.maxLocations || defaultMaxLocations;
    locationsToProbe = locationsToProbe.slice(0, maxLocations);
    
    // Ensure at least 5 probe locations
    if (locationsToProbe.length < 5) {
      const defaults = getProbeLocationsByRegion('all');
      const existingServers = new Set(locationsToProbe.map(l => l.server));
      for (const loc of defaults) {
        if (!existingServers.has(loc.server)) {
          locationsToProbe.push(loc);
          if (locationsToProbe.length >= 5) break;
        }
      }
    }
    
    return locationsToProbe;
  }

  /**
   * Query a specific DNS location with error resilience
   * Made public for streaming propagation check
   * @param domain - Domain name
   * @param recordType - DNS record type
   * @param locationName - Name of the probe location
   * @param dnsServer - DNS server IP address
   * @returns LocationResult with status and records
   */
  async queryLocationWithResilience(
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
