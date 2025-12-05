/**
 * Cache Service Usage Examples
 * 
 * This file demonstrates how to integrate the cache service
 * into other services for improved performance.
 */

import { cacheService } from './cache.service';
import { DNSResult } from '../models/dns.types';
import { WHOISResult } from '../models/whois.types';
import { IPResult } from '../models/ip.types';

/**
 * Example: Caching DNS lookup results
 */
export async function cachedDNSLookup(domain: string): Promise<DNSResult | null> {
  // Generate cache key
  const cacheKey = cacheService.generateKey('dns', domain);
  
  // Try to get from cache first
  const cached = await cacheService.get<DNSResult>(cacheKey);
  if (cached) {
    console.log(`Cache hit for DNS lookup: ${domain}`);
    return cached;
  }
  
  // Cache miss - perform actual lookup
  console.log(`Cache miss for DNS lookup: ${domain}`);
  
  // Simulate DNS lookup (replace with actual DNSService call)
  const result: DNSResult = {
    domain,
    records: [],
    timestamp: new Date(),
  };
  
  // Store in cache with DNS TTL (5 minutes)
  await cacheService.set(cacheKey, result, cacheService.getTTL('DNS'));
  
  return result;
}

/**
 * Example: Caching WHOIS lookup results
 */
export async function cachedWHOISLookup(domain: string): Promise<WHOISResult | null> {
  // Generate cache key
  const cacheKey = cacheService.generateKey('whois', domain);
  
  // Try to get from cache first
  const cached = await cacheService.get<WHOISResult>(cacheKey);
  if (cached) {
    console.log(`Cache hit for WHOIS lookup: ${domain}`);
    return cached;
  }
  
  // Cache miss - perform actual lookup
  console.log(`Cache miss for WHOIS lookup: ${domain}`);
  
  // Simulate WHOIS lookup (replace with actual WHOISService call)
  const result: WHOISResult = {
    domain,
    registrar: 'Example Registrar',
    registrationDate: new Date(),
    expirationDate: new Date(),
    nameServers: [],
    status: [],
    timestamp: new Date(),
  };
  
  // Store in cache with WHOIS TTL (24 hours)
  await cacheService.set(cacheKey, result, cacheService.getTTL('WHOIS'));
  
  return result;
}

/**
 * Example: Caching IP geolocation results
 */
export async function cachedIPLookup(ip: string): Promise<IPResult | null> {
  // Generate cache key
  const cacheKey = cacheService.generateKey('ip', ip);
  
  // Try to get from cache first
  const cached = await cacheService.get<IPResult>(cacheKey);
  if (cached) {
    console.log(`Cache hit for IP lookup: ${ip}`);
    return cached;
  }
  
  // Cache miss - perform actual lookup
  console.log(`Cache miss for IP lookup: ${ip}`);
  
  // Simulate IP lookup (replace with actual IPService call)
  const result: IPResult = {
    ip,
    type: 'IPv4',
    country: 'US',
    city: 'Mountain View',
    region: 'California',
    isp: 'Google LLC',
    timezone: 'America/Los_Angeles',
    organization: 'Google LLC',
    timestamp: new Date(),
  };
  
  // Store in cache with IP TTL (1 hour)
  await cacheService.set(cacheKey, result, cacheService.getTTL('IP'));
  
  return result;
}

/**
 * Example: Caching with custom TTL
 */
export async function cachedWithCustomTTL(key: string, value: any, ttlSeconds: number): Promise<void> {
  await cacheService.set(key, value, ttlSeconds);
}

/**
 * Example: Invalidating cache for a specific domain
 */
export async function invalidateDomainCache(domain: string): Promise<void> {
  // Delete all cache entries for this domain
  await cacheService.delete(cacheService.generateKey('dns', domain));
  await cacheService.delete(cacheService.generateKey('whois', domain));
  await cacheService.delete(cacheService.generateKey('rdap', domain));
  
  console.log(`Cache invalidated for domain: ${domain}`);
}

/**
 * Example: Caching DNS records by type
 */
export async function cachedDNSRecordsByType(
  domain: string,
  recordType: string
): Promise<any> {
  // Generate cache key with suffix for record type
  const cacheKey = cacheService.generateKey('dns', domain, recordType);
  
  // Try to get from cache
  const cached = await cacheService.get(cacheKey);
  if (cached) {
    return cached;
  }
  
  // Perform lookup and cache
  const result = { /* DNS records */ };
  await cacheService.set(cacheKey, result, cacheService.getTTL('DNS'));
  
  return result;
}

/**
 * Example: Getting cache statistics
 */
export async function getCacheInfo(): Promise<void> {
  const stats = await cacheService.getStats();
  const usingRedis = cacheService.isUsingRedis();
  
  console.log('Cache Statistics:');
  console.log(`- Type: ${stats.type}`);
  console.log(`- Size: ${stats.size} entries`);
  console.log(`- Using Redis: ${usingRedis}`);
}

/**
 * Example: Batch caching multiple domains
 */
export async function cacheBatchDomains(domains: string[]): Promise<void> {
  for (const domain of domains) {
    const cacheKey = cacheService.generateKey('dns', domain);
    
    // Check if already cached
    const cached = await cacheService.get(cacheKey);
    if (!cached) {
      // Perform lookup and cache
      const result = { /* DNS lookup result */ };
      await cacheService.set(cacheKey, result, cacheService.getTTL('DNS'));
    }
  }
}
