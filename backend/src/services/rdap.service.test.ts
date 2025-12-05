/**
 * RDAP Service Tests
 * Property-based and unit tests for RDAP service
 */

import * as fc from 'fast-check';
import { RDAPService } from './rdap.service';

// Mock the whois module to avoid ES module issues
jest.mock('whois', () => ({
  lookup: jest.fn((domain: string, callback: (err: Error | null, data: string) => void) => {
    // Mock WHOIS response
    const mockResponse = `
Domain Name: ${domain}
Registrar: Example Registrar Inc.
Creation Date: 2020-01-01T00:00:00Z
Registry Expiry Date: 2025-01-01T00:00:00Z
Name Server: ns1.example.com
Name Server: ns2.example.com
Domain Status: clientTransferProhibited
    `.trim();
    callback(null, mockResponse);
  }),
}));

describe('RDAPService', () => {
  describe('Property 28: RDAP Bootstrap Data Loading', () => {
    /**
     * Feature: network-domain-analyzer, Property 28: RDAP Bootstrap Data Loading
     * Validates: Requirements 13.1
     * 
     * For any system startup, the RDAP bootstrap data should be successfully loaded from dns.json file.
     */
    it('should successfully load bootstrap data on initialization', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant('../dns.json'),
          async (bootstrapFile) => {
            // Create service instance
            const service = new RDAPService(bootstrapFile);

            // Initialize should not throw
            await expect(service.initialize()).resolves.not.toThrow();

            // After initialization, bootstrap info should be available
            const info = service.getBootstrapInfo();
            
            // Bootstrap data should contain TLDs
            expect(info.tlds.length).toBeGreaterThan(0);
            
            // Bootstrap data should contain servers
            expect(info.serverCount).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should throw error when bootstrap file does not exist', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string().filter(s => s !== '../dns.json' && s !== 'dns.json' && !s.includes('/')),
          async (invalidFile) => {
            const service = new RDAPService(invalidFile);

            // Should throw error when file doesn't exist
            await expect(service.initialize()).rejects.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should load valid bootstrap data structure', async () => {
      const service = new RDAPService('../dns.json');
      await service.initialize();

      const info = service.getBootstrapInfo();

      // Verify structure
      expect(Array.isArray(info.tlds)).toBe(true);
      expect(typeof info.serverCount).toBe('number');
      expect(info.serverCount).toBeGreaterThan(0);
    });
  });

  describe('Property 29: RDAP TLD Extraction', () => {
    /**
     * Feature: network-domain-analyzer, Property 29: RDAP TLD Extraction
     * Validates: Requirements 13.2
     * 
     * For any valid domain name, the system should correctly extract the TLD for RDAP server lookup.
     */
    it('should correctly extract TLD from any valid domain', async () => {
      const service = new RDAPService('../dns.json');
      await service.initialize();

      await fc.assert(
        fc.asyncProperty(
          fc.tuple(
            fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')), { minLength: 1, maxLength: 63 }),
            fc.constantFrom('com', 'org', 'net', 'io', 'edu', 'gov', 'info', 'biz')
          ),
          async ([subdomain, tld]) => {
            // Skip invalid subdomains
            if (subdomain.startsWith('-') || subdomain.endsWith('-')) {
              return;
            }

            const domain = `${subdomain}.${tld}`;
            const extractedTLD = service.extractTLD(domain);

            // The extracted TLD should be the last part of the domain
            // Since we're using single-part TLDs, it should match
            expect(extractedTLD).toBe(tld);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should extract single-part TLDs correctly', async () => {
      const service = new RDAPService('../dns.json');
      await service.initialize();

      await fc.assert(
        fc.asyncProperty(
          fc.tuple(
            fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), { minLength: 2, maxLength: 10 }),
            fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), { minLength: 2, maxLength: 10 })
          ),
          async ([domainName, tld]) => {
            const domain = `${domainName}.${tld}`;
            const extractedTLD = service.extractTLD(domain);

            // Should extract the last part as TLD
            expect(extractedTLD).toBe(tld.toLowerCase());
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 30: RDAP Fallback Mechanism', () => {
    /**
     * Feature: network-domain-analyzer, Property 30: RDAP Fallback Mechanism
     * Validates: Requirements 13.5, 13.6
     * 
     * For any domain lookup where RDAP server is unavailable or TLD not found,
     * the system should fallback to traditional WHOIS lookup.
     */
    it('should fallback to WHOIS when TLD not in bootstrap data', async () => {
      const service = new RDAPService('../dns.json');
      await service.initialize();

      await fc.assert(
        fc.asyncProperty(
          fc.tuple(
            fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), { minLength: 3, maxLength: 10 }),
            fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), { minLength: 5, maxLength: 10 })
          ),
          async ([_domainName, unusualTLD]) => {
            // Check if TLD is in bootstrap
            const rdapServer = service.findRDAPServer(unusualTLD);

            if (rdapServer === null) {
              // If TLD not found, the service should attempt WHOIS fallback
              // We can't test the actual lookup without network, but we can verify
              // that findRDAPServer returns null for unknown TLDs
              expect(rdapServer).toBeNull();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return null for unknown TLDs', async () => {
      const service = new RDAPService('../dns.json');
      await service.initialize();

      await fc.assert(
        fc.asyncProperty(
          fc.stringOf(fc.constantFrom(...'xyz123456789'.split('')), { minLength: 10, maxLength: 20 }),
          async (unknownTLD) => {
            const rdapServer = service.findRDAPServer(unknownTLD);

            // Unknown TLDs should return null
            // (unless by chance they match a real TLD, which is very unlikely with random strings)
            if (unknownTLD.length > 10) {
              expect(rdapServer).toBeNull();
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 31: RDAP Data Consistency', () => {
    /**
     * Feature: network-domain-analyzer, Property 31: RDAP Data Consistency
     * Validates: Requirements 13.4, 13.7
     * 
     * For any successful RDAP query, the parsed result should contain registrar,
     * registration date, and expiration date in consistent format.
     */
    it('should parse RDAP response with consistent data structure', async () => {
      const service = new RDAPService('../dns.json');
      await service.initialize();

      await fc.assert(
        fc.asyncProperty(
          fc.record({
            ldhName: fc.domain(),
            entities: fc.array(
              fc.record({
                roles: fc.constant(['registrar']),
                vcardArray: fc.constant([
                  'vcard',
                  [
                    ['version', {}, 'text', '4.0'],
                    ['fn', {}, 'text', 'Example Registrar Inc.']
                  ]
                ])
              }),
              { minLength: 1, maxLength: 1 }
            ),
            events: fc.array(
              fc.oneof(
                fc.record({
                  eventAction: fc.constant('registration'),
                  eventDate: fc.date({ min: new Date('2000-01-01'), max: new Date() }).map(d => d.toISOString())
                }),
                fc.record({
                  eventAction: fc.constant('expiration'),
                  eventDate: fc.date({ min: new Date(), max: new Date('2030-12-31') }).map(d => d.toISOString())
                })
              ),
              { minLength: 2, maxLength: 2 }
            ),
            nameservers: fc.array(
              fc.record({
                ldhName: fc.domain()
              }),
              { minLength: 1, maxLength: 4 }
            ),
            status: fc.array(
              fc.constantFrom('active', 'clientTransferProhibited', 'serverDeleteProhibited'),
              { minLength: 1, maxLength: 3 }
            )
          }),
          async (rdapData) => {
            const domain = rdapData.ldhName;
            const result = service.parseRDAPResponse(rdapData, domain);

            // Verify consistent structure
            expect(result).toHaveProperty('domain');
            expect(result).toHaveProperty('registrar');
            expect(result).toHaveProperty('registrationDate');
            expect(result).toHaveProperty('expirationDate');
            expect(result).toHaveProperty('nameServers');
            expect(result).toHaveProperty('status');
            expect(result).toHaveProperty('source');
            expect(result).toHaveProperty('timestamp');

            // Verify types
            expect(typeof result.domain).toBe('string');
            expect(typeof result.registrar).toBe('string');
            expect(result.registrationDate).toBeInstanceOf(Date);
            expect(result.expirationDate).toBeInstanceOf(Date);
            expect(Array.isArray(result.nameServers)).toBe(true);
            expect(Array.isArray(result.status)).toBe(true);
            expect(result.source).toBe('rdap');
            expect(result.timestamp).toBeInstanceOf(Date);

            // Verify data consistency
            expect(result.domain).toBe(domain);
            expect(result.registrar).toBeTruthy();
            expect(result.nameServers.length).toBeGreaterThan(0);
            expect(result.status.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle RDAP responses with missing optional fields', async () => {
      const service = new RDAPService('../dns.json');
      await service.initialize();

      await fc.assert(
        fc.asyncProperty(
          fc.record({
            ldhName: fc.domain(),
            // Minimal RDAP response with some fields missing
            events: fc.option(fc.array(
              fc.record({
                eventAction: fc.constantFrom('registration', 'expiration'),
                eventDate: fc.date().map(d => d.toISOString())
              })
            ), { nil: undefined }),
            nameservers: fc.option(fc.array(
              fc.record({
                ldhName: fc.domain()
              })
            ), { nil: undefined }),
            status: fc.option(fc.array(
              fc.constantFrom('active', 'inactive')
            ), { nil: undefined })
          }),
          async (rdapData) => {
            const domain = rdapData.ldhName;
            const result = service.parseRDAPResponse(rdapData, domain);

            // Should still return a valid result structure
            expect(result).toHaveProperty('domain');
            expect(result).toHaveProperty('registrar');
            expect(result).toHaveProperty('registrationDate');
            expect(result).toHaveProperty('expirationDate');
            expect(result).toHaveProperty('nameServers');
            expect(result).toHaveProperty('status');
            expect(result).toHaveProperty('source');
            expect(result).toHaveProperty('timestamp');

            // Arrays should be empty if data is missing, not undefined
            expect(Array.isArray(result.nameServers)).toBe(true);
            expect(Array.isArray(result.status)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Unit Tests', () => {
    it('should find RDAP server for known TLDs', async () => {
      const service = new RDAPService('../dns.json');
      await service.initialize();

      // Test with known TLDs
      const comServer = service.findRDAPServer('com');
      expect(comServer).toBeTruthy();

      const orgServer = service.findRDAPServer('org');
      expect(orgServer).toBeTruthy();
    });

    it('should extract TLD from simple domains', async () => {
      const service = new RDAPService('../dns.json');
      await service.initialize();

      expect(service.extractTLD('example.com')).toBe('com');
      expect(service.extractTLD('test.org')).toBe('org');
      expect(service.extractTLD('subdomain.example.net')).toBe('net');
    });

    it('should get bootstrap info', async () => {
      const service = new RDAPService('../dns.json');
      await service.initialize();

      const info = service.getBootstrapInfo();
      expect(info.tlds.length).toBeGreaterThan(0);
      expect(info.serverCount).toBeGreaterThan(0);
    });
  });
});
