/**
 * Property-based tests for validation utilities
 * Using fast-check for property-based testing
 */

import * as fc from 'fast-check';
import {
  validateDomain,
  validateIP,
  validatePort,
  isPrivateIP,
  sanitizeInput,
  detectMaliciousPatterns,
} from './validation';

describe('Validation Utilities - Property-Based Tests', () => {
  /**
   * Feature: network-domain-analyzer, Property 2: Invalid Domain Rejection
   * Validates: Requirements 1.4, 10.1
   * 
   * For any string that does not match valid domain format,
   * the system should reject the input and return a validation error.
   */
  describe('Property 2: Invalid Domain Rejection', () => {
    it('should reject empty or whitespace-only strings', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(''),
            fc.constant('   '),
            fc.constant('\t'),
            fc.constant('\n'),
            fc.stringOf(fc.constantFrom(' ', '\t', '\n'))
          ),
          (invalidDomain) => {
            const result = validateDomain(invalidDomain);
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.domain).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject strings without TLD', () => {
      fc.assert(
        fc.property(
          fc.stringOf(fc.constantFrom('a', 'b', 'c', '1', '2', '3'), { minLength: 1, maxLength: 20 }),
          (invalidDomain) => {
            // Ensure no dots in the string
            const noDotDomain = invalidDomain.replace(/\./g, '');
            if (noDotDomain.length > 0) {
              const result = validateDomain(noDotDomain);
              expect(result.valid).toBe(false);
              expect(result.errors.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject domains with invalid characters', () => {
      fc.assert(
        fc.property(
          fc.string().filter(s => /[^a-zA-Z0-9.-]/.test(s) && s.length > 0),
          (invalidDomain) => {
            const result = validateDomain(invalidDomain);
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject domains starting or ending with hyphen', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.string().map(s => `-${s}.com`),
            fc.string().map(s => `${s}-.com`),
            fc.string().map(s => `example.-${s}`)
          ),
          (invalidDomain) => {
            const result = validateDomain(invalidDomain);
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject domains with consecutive dots', () => {
      fc.assert(
        fc.property(
          fc.string().map(s => `example..${s}.com`),
          (invalidDomain) => {
            const result = validateDomain(invalidDomain);
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject domains exceeding 255 characters', () => {
      fc.assert(
        fc.property(
          fc.stringOf(fc.constantFrom('a', 'b', 'c'), { minLength: 256, maxLength: 300 }),
          (longString) => {
            const invalidDomain = `${longString}.com`;
            const result = validateDomain(invalidDomain);
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject domains with labels exceeding 63 characters', () => {
      fc.assert(
        fc.property(
          fc.stringOf(fc.constantFrom('a', 'b', 'c'), { minLength: 64, maxLength: 100 }),
          (longLabel) => {
            const invalidDomain = `${longLabel}.com`;
            const result = validateDomain(invalidDomain);
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept valid domains', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant('example.com'),
            fc.constant('sub.example.com'),
            fc.constant('test-domain.org'),
            fc.constant('my-site123.co.uk'),
            fc.constant('a.b.c.d.example.com')
          ),
          (validDomain) => {
            const result = validateDomain(validDomain);
            expect(result.valid).toBe(true);
            expect(result.errors.length).toBe(0);
            expect(result.domain).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: network-domain-analyzer, Property 24: IP Address Validation
   * Validates: Requirements 12.7
   * 
   * For any string that does not match valid IPv4 or IPv6 format,
   * the system should reject the input with a validation error.
   */
  describe('Property 24: IP Address Validation', () => {
    it('should reject empty or whitespace-only strings', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(''),
            fc.constant('   '),
            fc.constant('\t'),
            fc.constant('\n')
          ),
          (invalidIP) => {
            const result = validateIP(invalidIP);
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.ip).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject IPv4 addresses with octets > 255', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 256, max: 999 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          (a, b, c, d) => {
            const invalidIP = `${a}.${b}.${c}.${d}`;
            const result = validateIP(invalidIP);
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject IPv4 addresses with wrong number of octets', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant('192.168.1'),
            fc.constant('192.168'),
            fc.constant('192'),
            fc.constant('192.168.1.1.1')
          ),
          (invalidIP) => {
            const result = validateIP(invalidIP);
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject strings with invalid characters', () => {
      fc.assert(
        fc.property(
          fc.string().filter(s => !/^[0-9a-fA-F:.]+$/.test(s) && s.length > 0),
          (invalidIP) => {
            const result = validateIP(invalidIP);
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept valid IPv4 addresses', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          (a, b, c, d) => {
            const validIP = `${a}.${b}.${c}.${d}`;
            const result = validateIP(validIP);
            expect(result.valid).toBe(true);
            expect(result.errors.length).toBe(0);
            expect(result.ip).toBe(validIP);
            expect(result.type).toBe('IPv4');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept valid IPv6 addresses', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant('2001:0db8:85a3:0000:0000:8a2e:0370:7334'),
            fc.constant('2001:db8:85a3::8a2e:370:7334'),
            fc.constant('::1'),
            fc.constant('fe80::1'),
            fc.constant('::')
          ),
          (validIP) => {
            const result = validateIP(validIP);
            expect(result.valid).toBe(true);
            expect(result.errors.length).toBe(0);
            expect(result.ip).toBe(validIP);
            expect(result.type).toBe('IPv6');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: network-domain-analyzer, Property 11: Port Number Validation
   * Validates: Requirements 4.5
   * 
   * For any port number greater than 65535 or less than 1,
   * the system should reject the input with a validation error.
   */
  describe('Property 11: Port Number Validation', () => {
    it('should reject ports less than 1', () => {
      fc.assert(
        fc.property(
          fc.integer({ max: 0 }),
          (invalidPort) => {
            const result = validatePort(invalidPort);
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0].code).toBe('PORT_OUT_OF_RANGE');
            expect(result.port).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject ports greater than 65535', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 65536, max: 100000 }),
          (invalidPort) => {
            const result = validatePort(invalidPort);
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0].code).toBe('PORT_OUT_OF_RANGE');
            expect(result.port).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject non-integer values', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 1.1, max: 65535.9, noNaN: true }),
          (invalidPort) => {
            const result = validatePort(invalidPort);
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject non-numeric strings', () => {
      fc.assert(
        fc.property(
          fc.string().filter(s => {
            // Filter strings that are truly non-numeric
            // parseInt can parse partial numbers, so we need to be more strict
            const parsed = parseInt(s, 10);
            return isNaN(parsed) && s.length > 0;
          }),
          (invalidPort) => {
            const result = validatePort(invalidPort);
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0].code).toBe('INVALID_PORT_FORMAT');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept valid ports (1-65535)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 65535 }),
          (validPort) => {
            const result = validatePort(validPort);
            expect(result.valid).toBe(true);
            expect(result.errors.length).toBe(0);
            expect(result.port).toBe(validPort);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept valid ports as strings', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 65535 }).map(n => n.toString()),
          (validPort) => {
            const result = validatePort(validPort);
            expect(result.valid).toBe(true);
            expect(result.errors.length).toBe(0);
            expect(result.port).toBe(Number(validPort));
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: network-domain-analyzer, Property 23: Private IP Detection
   * Validates: Requirements 12.5
   * 
   * For any IP address in private ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16),
   * the system should identify it as private and not attempt geolocation lookup.
   */
  describe('Property 23: Private IP Detection', () => {
    it('should detect 10.0.0.0/8 as private', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          (b, c, d) => {
            const privateIP = `10.${b}.${c}.${d}`;
            expect(isPrivateIP(privateIP)).toBe(true);
            
            const result = validateIP(privateIP);
            expect(result.isPrivate).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should detect 172.16.0.0/12 as private', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 16, max: 31 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          (b, c, d) => {
            const privateIP = `172.${b}.${c}.${d}`;
            expect(isPrivateIP(privateIP)).toBe(true);
            
            const result = validateIP(privateIP);
            expect(result.isPrivate).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should detect 192.168.0.0/16 as private', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          (c, d) => {
            const privateIP = `192.168.${c}.${d}`;
            expect(isPrivateIP(privateIP)).toBe(true);
            
            const result = validateIP(privateIP);
            expect(result.isPrivate).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should detect 127.0.0.0/8 (loopback) as private', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          (b, c, d) => {
            const loopbackIP = `127.${b}.${c}.${d}`;
            expect(isPrivateIP(loopbackIP)).toBe(true);
            
            const result = validateIP(loopbackIP);
            expect(result.isPrivate).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should detect IPv6 loopback ::1 as private', () => {
      expect(isPrivateIP('::1')).toBe(true);
      
      const result = validateIP('::1');
      expect(result.isPrivate).toBe(true);
    });

    it('should detect IPv6 link-local fe80::/10 as private', () => {
      fc.assert(
        fc.property(
          fc.hexaString({ minLength: 1, maxLength: 4 }),
          (suffix) => {
            const linkLocalIP = `fe80::${suffix}`;
            expect(isPrivateIP(linkLocalIP)).toBe(true);
            
            const result = validateIP(linkLocalIP);
            expect(result.isPrivate).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not detect public IPs as private', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 9 }).chain(a =>
            fc.record({
              a: fc.constant(a),
              b: fc.integer({ min: 0, max: 255 }),
              c: fc.integer({ min: 0, max: 255 }),
              d: fc.integer({ min: 0, max: 255 })
            })
          ),
          ({ a, b, c, d }) => {
            const publicIP = `${a}.${b}.${c}.${d}`;
            expect(isPrivateIP(publicIP)).toBe(false);
            
            const result = validateIP(publicIP);
            expect(result.isPrivate).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Additional unit tests for sanitization
  describe('Input Sanitization', () => {
    it('should remove HTML tags', () => {
      expect(sanitizeInput('<script>alert("xss")</script>')).not.toContain('<script>');
      expect(sanitizeInput('<div>test</div>')).toBe('test');
    });

    it('should remove event handlers', () => {
      expect(sanitizeInput('onclick="alert(1)"')).not.toContain('onclick');
      expect(sanitizeInput('onerror="alert(1)"')).not.toContain('onerror');
    });

    it('should remove javascript protocol', () => {
      expect(sanitizeInput('javascript:alert(1)')).not.toContain('javascript:');
    });

    it('should remove SQL injection patterns', () => {
      expect(sanitizeInput("'; DROP TABLE users--")).not.toContain("'");
      expect(sanitizeInput("1' OR '1'='1")).not.toContain("'");
    });

    it('should remove path traversal patterns', () => {
      expect(sanitizeInput('../../../etc/passwd')).not.toContain('../');
    });
  });

  describe('Malicious Pattern Detection', () => {
    it('should detect SQL injection patterns', () => {
      expect(detectMaliciousPatterns("'; DROP TABLE users--")).toBe(true);
      expect(detectMaliciousPatterns("1' OR '1'='1")).toBe(true);
    });

    it('should detect XSS patterns', () => {
      expect(detectMaliciousPatterns('<script>alert("xss")</script>')).toBe(true);
      expect(detectMaliciousPatterns('onclick="alert(1)"')).toBe(true);
    });

    it('should detect path traversal', () => {
      expect(detectMaliciousPatterns('../../../etc/passwd')).toBe(true);
    });

    it('should not flag clean input', () => {
      expect(detectMaliciousPatterns('example.com')).toBe(false);
      expect(detectMaliciousPatterns('192.168.1.1')).toBe(false);
      expect(detectMaliciousPatterns('test domain')).toBe(false);
    });
  });
});
