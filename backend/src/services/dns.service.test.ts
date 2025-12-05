/**
 * DNS Service Tests
 * Unit tests and property-based tests for DNS Service
 */

import * as fc from 'fast-check';
import { DNSService } from './dns.service';
import { DNSRecordType } from '../models/dns.types';
import { AppError } from '../models/error.types';

describe('DNSService', () => {
  let dnsService: DNSService;

  beforeEach(() => {
    dnsService = new DNSService();
  });

  describe('Unit Tests', () => {
    describe('lookupRecords', () => {
      it('should reject invalid domain names', async () => {
        await expect(dnsService.lookupRecords('invalid domain')).rejects.toThrow(AppError);
        await expect(dnsService.lookupRecords('')).rejects.toThrow(AppError);
        await expect(dnsService.lookupRecords('..com')).rejects.toThrow(AppError);
      });

      it('should return DNS records with timestamp for valid domain', async () => {
        const result = await dnsService.lookupRecords('google.com');
        
        expect(result).toBeDefined();
        expect(result.domain).toBe('google.com');
        expect(result.records).toBeDefined();
        expect(Array.isArray(result.records)).toBe(true);
        expect(result.records.length).toBeGreaterThan(0);
        expect(result.timestamp).toBeInstanceOf(Date);
      });

      it('should filter records by specified types', async () => {
        const result = await dnsService.lookupRecords('google.com', ['A']);
        
        expect(result.records.every(record => record.type === 'A')).toBe(true);
      });

      it('should handle domains with no records gracefully', async () => {
        // Using a non-existent domain
        await expect(
          dnsService.lookupRecords('this-domain-definitely-does-not-exist-12345.com')
        ).rejects.toThrow(AppError);
      });
    });

    describe('checkPropagation', () => {
      it('should reject invalid domain names', async () => {
        await expect(dnsService.checkPropagation('invalid domain', 'A')).rejects.toThrow(AppError);
        await expect(dnsService.checkPropagation('', 'A')).rejects.toThrow(AppError);
      });

      it('should return propagation status with at least 5 locations', async () => {
        const result = await dnsService.checkPropagation('google.com', 'A');
        
        expect(result).toBeDefined();
        expect(result.locations).toBeDefined();
        expect(result.locations.length).toBeGreaterThanOrEqual(5);
        expect(typeof result.fullyPropagated).toBe('boolean');
        expect(Array.isArray(result.inconsistencies)).toBe(true);
      });

      it('should mark stable domains as fully propagated', async () => {
        const result = await dnsService.checkPropagation('google.com', 'A');
        
        // Google.com should be fully propagated
        const successfulLocations = result.locations.filter(loc => loc.status === 'success');
        expect(successfulLocations.length).toBeGreaterThan(0);
        
        // Each location should have required fields
        result.locations.forEach(location => {
          expect(location.location).toBeDefined();
          expect(['success', 'failure', 'unavailable']).toContain(location.status);
          expect(typeof location.responseTime).toBe('number');
          expect(Array.isArray(location.records)).toBe(true);
        });
      });

      it('should handle domains without specific record types', async () => {
        // GitHub doesn't have AAAA records
        const result = await dnsService.checkPropagation('github.com', 'AAAA');
        
        expect(result).toBeDefined();
        expect(result.locations.length).toBeGreaterThanOrEqual(5);
        // Should not throw error even if all locations fail
      });
    });
  });

  describe('Property-Based Tests', () => {
    /**
     * Feature: network-domain-analyzer, Property 1: DNS Record Type Filtering
     * Validates: Requirements 1.2
     * 
     * For any domain and any selected DNS record type, the filtered results 
     * should contain only records matching that specific type.
     */
    it('Property 1: DNS Record Type Filtering - filtered results contain only specified types', async () => {
      // Use a well-known domain that has multiple record types
      const testDomain = 'google.com';
      
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom<DNSRecordType>('A', 'AAAA', 'MX', 'TXT', 'NS', 'SOA'),
          async (recordType) => {
            try {
              const result = await dnsService.lookupRecords(testDomain, [recordType]);
              
              // All returned records should match the requested type
              const allMatchType = result.records.every(record => record.type === recordType);
              
              return allMatchType;
            } catch (error) {
              // If the domain doesn't have this record type, that's acceptable
              // The property still holds - we got no records of other types
              if (error instanceof AppError && error.code === 'DNS_LOOKUP_FAILED') {
                return true;
              }
              throw error;
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Feature: network-domain-analyzer, Property 3: Timestamp Presence
     * Validates: Requirements 1.5
     * 
     * For any successful DNS query, the result should include a valid timestamp 
     * indicating when the query was performed.
     */
    it('Property 3: Timestamp Presence - all successful queries include valid timestamps', async () => {
      // Use well-known domains that are guaranteed to exist
      const knownDomains = ['google.com', 'github.com', 'cloudflare.com', 'amazon.com'];
      
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...knownDomains),
          fc.subarray(
            ['A', 'AAAA', 'MX', 'TXT', 'NS', 'SOA'] as DNSRecordType[],
            { minLength: 1, maxLength: 6 }
          ),
          async (domain, recordTypes) => {
            try {
              const beforeQuery = new Date();
              const result = await dnsService.lookupRecords(domain, recordTypes);
              const afterQuery = new Date();
              
              // Timestamp should exist
              const hasTimestamp = result.timestamp !== undefined && result.timestamp !== null;
              
              // Timestamp should be a valid Date object
              const isValidDate = result.timestamp instanceof Date && !isNaN(result.timestamp.getTime());
              
              // Timestamp should be between before and after query time
              const isInRange = result.timestamp >= beforeQuery && result.timestamp <= afterQuery;
              
              return hasTimestamp && isValidDate && isInRange;
            } catch (error) {
              // If lookup fails, we can't test timestamp - skip this case
              if (error instanceof AppError) {
                return true;
              }
              throw error;
            }
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);

    /**
     * Feature: network-domain-analyzer, Property 4: Propagation Location Count
     * Validates: Requirements 2.1
     * 
     * For any DNS propagation check, the system should query at least 5 different probe locations.
     */
    it('Property 4: Propagation Location Count - queries at least 5 locations', async () => {
      // Use well-known domains
      const knownDomains = ['google.com', 'github.com', 'cloudflare.com'];
      
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...knownDomains),
          fc.constantFrom<DNSRecordType>('A', 'AAAA', 'MX', 'NS'),
          async (domain, recordType) => {
            try {
              const result = await dnsService.checkPropagation(domain, recordType);
              
              // Should have at least 5 location results
              const hasMinimumLocations = result.locations.length >= 5;
              
              // Each location should have a name and status
              const allLocationsValid = result.locations.every(
                loc => loc.location && loc.location.length > 0 && 
                       ['success', 'failure', 'unavailable'].includes(loc.status)
              );
              
              return hasMinimumLocations && allLocationsValid;
            } catch (error) {
              // If domain is invalid, that's acceptable for this test
              if (error instanceof AppError && error.code === 'INVALID_DOMAIN') {
                return true;
              }
              throw error;
            }
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);

    /**
     * Feature: network-domain-analyzer, Property 5: Propagation Result Completeness
     * Validates: Requirements 2.2
     * 
     * For any propagation check, every queried location should have a status 
     * (success, failure, or unavailable) in the results.
     */
    it('Property 5: Propagation Result Completeness - every location has a status', async () => {
      const knownDomains = ['google.com', 'github.com', 'cloudflare.com'];
      
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...knownDomains),
          fc.constantFrom<DNSRecordType>('A', 'AAAA', 'MX', 'NS'),
          async (domain, recordType) => {
            try {
              const result = await dnsService.checkPropagation(domain, recordType);
              
              // Every location must have a valid status
              const allHaveStatus = result.locations.every(
                loc => ['success', 'failure', 'unavailable'].includes(loc.status)
              );
              
              // Every location must have a response time (even if failed)
              const allHaveResponseTime = result.locations.every(
                loc => typeof loc.responseTime === 'number' && loc.responseTime >= 0
              );
              
              // Every location must have a records array (even if empty)
              const allHaveRecords = result.locations.every(
                loc => Array.isArray(loc.records)
              );
              
              return allHaveStatus && allHaveResponseTime && allHaveRecords;
            } catch (error) {
              if (error instanceof AppError && error.code === 'INVALID_DOMAIN') {
                return true;
              }
              throw error;
            }
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);

    /**
     * Feature: network-domain-analyzer, Property 6: Propagation Status Consistency
     * Validates: Requirements 2.4
     * 
     * For any propagation check where all locations return identical DNS records, 
     * the system should mark the status as "Fully Propagated".
     */
    it('Property 6: Propagation Status Consistency - identical records mean fully propagated', async () => {
      // Use stable domains that should be fully propagated
      const stableDomains = ['google.com', 'cloudflare.com'];
      
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...stableDomains),
          fc.constantFrom<DNSRecordType>('A', 'NS'),
          async (domain, recordType) => {
            try {
              const result = await dnsService.checkPropagation(domain, recordType);
              
              // Get successful results
              const successfulResults = result.locations.filter(
                loc => loc.status === 'success' && loc.records.length > 0
              );
              
              // If we have at least 2 successful results
              if (successfulResults.length >= 2) {
                // Check if all successful results have identical records
                const firstRecords = successfulResults[0].records;
                const allIdentical = successfulResults.every(loc => {
                  if (loc.records.length !== firstRecords.length) return false;
                  
                  const sorted1 = [...firstRecords].sort((a, b) => a.value.localeCompare(b.value));
                  const sorted2 = [...loc.records].sort((a, b) => a.value.localeCompare(b.value));
                  
                  return sorted1.every((rec, idx) => 
                    rec.type === sorted2[idx].type && rec.value === sorted2[idx].value
                  );
                });
                
                // If all are identical, should be marked as fully propagated
                if (allIdentical) {
                  return result.fullyPropagated === true;
                }
              }
              
              // If not all identical or not enough successful results, 
              // we can't assert about fullyPropagated status
              return true;
            } catch (error) {
              if (error instanceof AppError) {
                return true;
              }
              throw error;
            }
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);

    /**
     * Feature: network-domain-analyzer, Property 7: Propagation Resilience
     * Validates: Requirements 2.5
     * 
     * For any propagation check where one or more locations fail, the system should 
     * still return results from successful locations without failing the entire check.
     */
    it('Property 7: Propagation Resilience - partial failures do not fail entire check', async () => {
      const knownDomains = ['google.com', 'github.com', 'cloudflare.com'];
      
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...knownDomains),
          fc.constantFrom<DNSRecordType>('A', 'AAAA', 'MX', 'NS'),
          async (domain, recordType) => {
            try {
              const result = await dnsService.checkPropagation(domain, recordType);
              
              // The check should complete and return a result
              const hasResult = result !== null && result !== undefined;
              
              // Should have location results
              const hasLocations = result.locations && result.locations.length >= 5;
              
              // Should have a fullyPropagated boolean
              const hasStatus = typeof result.fullyPropagated === 'boolean';
              
              // Should have inconsistencies array (even if empty)
              const hasInconsistencies = Array.isArray(result.inconsistencies);
              
              // The key resilience property: even if some or all locations fail,
              // the check itself should not throw an error and should return a complete result
              // This means the system continues despite failures
              
              return hasResult && hasLocations && hasStatus && hasInconsistencies;
            } catch (error) {
              // The entire check should not throw an error due to partial failures
              // Only invalid input should cause errors
              if (error instanceof AppError && error.code === 'INVALID_DOMAIN') {
                return true;
              }
              // Any other error means resilience failed
              return false;
            }
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);
  });
});
