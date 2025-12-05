/**
 * WHOIS Service Tests
 * Unit tests and property-based tests for WHOIS functionality
 */

import * as fc from 'fast-check';
import { WHOISService } from './whois.service';

// Mock the whois module
jest.mock('whois', () => ({
  lookup: jest.fn(),
}));

import * as whois from 'whois';

describe('WHOISService', () => {
  let service: WHOISService;

  beforeEach(() => {
    service = new WHOISService();
    jest.clearAllMocks();
  });

  describe('Unit Tests', () => {
    it('should successfully lookup a valid domain', async () => {
      const mockWhoisData = `
Domain Name: example.com
Registrar: Example Registrar Inc.
Creation Date: 2020-01-15T10:00:00Z
Registry Expiry Date: 2025-01-15T10:00:00Z
Name Server: ns1.example.com
Name Server: ns2.example.com
Domain Status: clientTransferProhibited
      `.trim();

      (whois.lookup as jest.Mock).mockImplementation((_domain, callback) => {
        callback(null, mockWhoisData);
      });

      const result = await service.lookup('example.com');

      expect(result.domain).toBe('example.com');
      expect(result.registrar).toBe('Example Registrar Inc.');
      expect(result.registrationDate).toBeInstanceOf(Date);
      expect(result.expirationDate).toBeInstanceOf(Date);
      expect(result.nameServers).toHaveLength(2);
      expect(result.nameServers).toContain('ns1.example.com');
      expect(result.status).toContain('clientTransferProhibited');
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should handle unregistered domains', async () => {
      const mockWhoisData = `
No match for domain "unregistered-domain-12345.com".
      `.trim();

      (whois.lookup as jest.Mock).mockImplementation((_domain, callback) => {
        callback(null, mockWhoisData);
      });

      const result = await service.lookup('unregistered-domain-12345.com');

      expect(result.status).toContain('Available for Registration');
    });

    it('should handle privacy-protected domains', async () => {
      const mockWhoisData = `
Domain Name: privacy-protected.com
Registrar: REDACTED FOR PRIVACY
Creation Date: 2020-01-15T10:00:00Z
Registry Expiry Date: 2025-01-15T10:00:00Z
Registrant Name: REDACTED FOR PRIVACY
Registrant Email: REDACTED FOR PRIVACY
      `.trim();

      (whois.lookup as jest.Mock).mockImplementation((_domain, callback) => {
        callback(null, mockWhoisData);
      });

      const result = await service.lookup('privacy-protected.com');

      expect(result.registrar).toBeTruthy();
    });

    it('should reject invalid domain formats', async () => {
      await expect(service.lookup('invalid domain')).rejects.toThrow();
      await expect(service.lookup('http://example.com')).rejects.toThrow();
      await expect(service.lookup('')).rejects.toThrow();
    });

    it('should identify domains needing renewal reminder', () => {
      const now = new Date();
      
      // Domain expiring in 30 days
      const expiringDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      expect(service.needsRenewalReminder(expiringDate)).toBe(true);

      // Domain expiring in 59 days
      const expiringDate59 = new Date(now.getTime() + 59 * 24 * 60 * 60 * 1000);
      expect(service.needsRenewalReminder(expiringDate59)).toBe(true);

      // Domain expiring in 61 days
      const notExpiringDate = new Date(now.getTime() + 61 * 24 * 60 * 60 * 1000);
      expect(service.needsRenewalReminder(notExpiringDate)).toBe(false);

      // Domain already expired
      const expiredDate = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
      expect(service.needsRenewalReminder(expiredDate)).toBe(false);
    });

    it('should calculate days until expiry correctly', () => {
      const now = new Date();
      
      // 30 days in the future
      const futureDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const days = service.getDaysUntilExpiry(futureDate);
      expect(days).toBeGreaterThanOrEqual(29);
      expect(days).toBeLessThanOrEqual(30);

      // 10 days in the past
      const pastDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
      const negativeDays = service.getDaysUntilExpiry(pastDate);
      expect(negativeDays).toBeLessThan(0);
    });
  });

  describe('Property-Based Tests', () => {
    /**
     * Feature: network-domain-analyzer, Property 14: WHOIS Data Completeness
     * Validates: Requirements 6.1
     * 
     * For any successful WHOIS lookup, the result should include registrar name,
     * registration date, and expiration date.
     */
    it('Property 14: WHOIS Data Completeness - all successful lookups contain required fields', async () => {
      // Generator for valid domain names
      const domainArbitrary = fc.tuple(
        fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')), { minLength: 1, maxLength: 63 }),
        fc.constantFrom('com', 'net', 'org', 'io', 'dev')
      ).map(([name, tld]) => {
        // Ensure domain doesn't start or end with hyphen
        const cleanName = name.replace(/^-+|-+$/g, '') || 'a';
        return `${cleanName}.${tld}`;
      });

      await fc.assert(
        fc.asyncProperty(domainArbitrary, async (domain) => {
          // Mock WHOIS data with all required fields
          const mockWhoisData = `
Domain Name: ${domain}
Registrar: Test Registrar ${Math.random().toString(36).substring(7)}
Creation Date: 2020-01-15T10:00:00Z
Registry Expiry Date: 2025-01-15T10:00:00Z
Name Server: ns1.${domain}
Domain Status: ok
          `.trim();

          (whois.lookup as jest.Mock).mockImplementation((_d, callback) => {
            callback(null, mockWhoisData);
          });

          const result = await service.lookup(domain);

          // Property: Result must contain registrar, registration date, and expiration date
          expect(result.registrar).toBeTruthy();
          expect(result.registrar).not.toBe('');
          expect(result.registrationDate).toBeInstanceOf(Date);
          expect(result.expirationDate).toBeInstanceOf(Date);
          expect(result.timestamp).toBeInstanceOf(Date);
          
          // Additional completeness checks
          expect(result.domain).toBe(domain);
          expect(result.nameServers).toBeInstanceOf(Array);
          expect(result.status).toBeInstanceOf(Array);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Feature: network-domain-analyzer, Property 15: Domain Expiration Reminder
     * Validates: Requirements 6.3
     * 
     * For any domain where expiration date is within 60 days from current date,
     * the system should display a renewal reminder.
     */
    it('Property 15: Domain Expiration Reminder - domains expiring within 60 days trigger reminder', () => {
      // Generator for days until expiry (testing range from -10 to 100 days)
      const daysArbitrary = fc.integer({ min: -10, max: 100 });

      fc.assert(
        fc.property(daysArbitrary, (daysUntilExpiry) => {
          const now = new Date();
          const expirationDate = new Date(now.getTime() + daysUntilExpiry * 24 * 60 * 60 * 1000);

          const needsReminder = service.needsRenewalReminder(expirationDate);

          // Property: Reminder should be shown if and only if 0 < days <= 60
          if (daysUntilExpiry > 0 && daysUntilExpiry <= 60) {
            expect(needsReminder).toBe(true);
          } else {
            expect(needsReminder).toBe(false);
          }
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Additional property: Days calculation consistency
     * For any expiration date, getDaysUntilExpiry should return consistent values
     */
    it('Property: Days until expiry calculation is consistent', () => {
      const daysArbitrary = fc.integer({ min: -365, max: 365 });

      fc.assert(
        fc.property(daysArbitrary, (daysOffset) => {
          const now = new Date();
          const expirationDate = new Date(now.getTime() + daysOffset * 24 * 60 * 60 * 1000);

          const calculatedDays = service.getDaysUntilExpiry(expirationDate);

          // Property: Calculated days should be within 1 day of the offset (accounting for time precision)
          expect(Math.abs(calculatedDays - daysOffset)).toBeLessThanOrEqual(1);
        }),
        { numRuns: 100 }
      );
    });
  });
});
