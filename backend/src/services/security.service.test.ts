/**
 * Property-Based Tests for Security Service
 */

import * as fc from 'fast-check';
import { securityService } from './security.service';

describe('Security Service - Property Tests', () => {
  /**
   * Feature: network-domain-analyzer, Property 33: Input Sanitization
   * Validates: Requirements 14.3
   * 
   * For any request containing potentially malicious input patterns (SQL injection, XSS),
   * the system should sanitize or reject the input.
   */
  describe('Property 33: Input Sanitization', () => {
    // Generator for malicious patterns
    const maliciousPatterns = fc.oneof(
      fc.constant('<script>alert("xss")</script>'),
      fc.constant('<iframe src="evil.com"></iframe>'),
      fc.constant("'; DROP TABLE users; --"),
      fc.constant('javascript:alert(1)'),
      fc.constant('<img onerror="alert(1)" src=x>'),
      fc.constant('../../etc/passwd'),
      fc.constant('eval(malicious_code)'),
      fc.constant('<script src="evil.js"></script>'),
      fc.constant("' OR '1'='1"),
      fc.constant('onload=alert(1)'),
      fc.constant('%27%20OR%20%271%27%3D%271'),
      fc.constant('<body onload=alert(1)>'),
    );

    it('should detect malicious patterns in input', () => {
      fc.assert(
        fc.property(maliciousPatterns, (maliciousInput) => {
          const result = securityService.detectMaliciousPatterns(maliciousInput);
          
          // Should detect at least one malicious pattern
          expect(result.detected).toBe(true);
          expect(result.patterns.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });

    it('should sanitize malicious input by removing dangerous content', () => {
      fc.assert(
        fc.property(maliciousPatterns, (maliciousInput) => {
          const sanitized = securityService.sanitizeInput(maliciousInput);
          
          // Sanitized output should not contain script tags
          expect(sanitized).not.toMatch(/<script[^>]*>/i);
          expect(sanitized).not.toMatch(/<\/script>/i);
          
          // Should not contain event handlers
          expect(sanitized).not.toMatch(/on\w+\s*=/i);
          
          // Should not contain javascript: protocol
          expect(sanitized).not.toMatch(/javascript:/i);
          
          // Should not contain SQL comment patterns
          expect(sanitized).not.toMatch(/--\s/);
          
          // Should not contain path traversal
          expect(sanitized).not.toMatch(/\.\.\//);
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve safe input unchanged', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.domain(),
            fc.emailAddress(),
            fc.string({ minLength: 1, maxLength: 50 }).filter(s => 
              /^[a-zA-Z0-9\s\-_.]+$/.test(s)
            ),
          ),
          (safeInput) => {
            const detection = securityService.detectMaliciousPatterns(safeInput);
            
            // Safe input should not be detected as malicious
            expect(detection.detected).toBe(false);
            expect(detection.patterns.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should sanitize nested malicious content', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }),
          maliciousPatterns,
          fc.string({ minLength: 1, maxLength: 20 }),
          (prefix, malicious, suffix) => {
            const input = `${prefix}${malicious}${suffix}`;
            const sanitized = securityService.sanitizeInput(input);
            
            // After sanitization, most malicious patterns should be removed
            // Note: Some patterns might still be detected if they're part of the prefix/suffix
            // but the actual malicious content should be removed
            expect(sanitized).not.toContain('<script>');
            expect(sanitized).not.toContain('</script>');
            expect(sanitized).not.toContain('javascript:');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle empty and whitespace-only strings', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(''),
            fc.constant('   '),
            fc.constant('\t\n'),
          ),
          (input) => {
            const sanitized = securityService.sanitizeInput(input);
            
            // Should return empty or whitespace-trimmed string
            expect(sanitized.trim()).toBe('');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should sanitize input regardless of case variations', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            '<SCRIPT>alert(1)</SCRIPT>',
            '<ScRiPt>alert(1)</ScRiPt>',
            'JAVASCRIPT:alert(1)',
            'JaVaScRiPt:alert(1)',
            '<IMG ONERROR="alert(1)" SRC=X>',
          ),
          (input) => {
            const sanitized = securityService.sanitizeInput(input);
            
            // Should remove malicious content regardless of case
            expect(sanitized.toLowerCase()).not.toContain('script');
            expect(sanitized.toLowerCase()).not.toContain('javascript:');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: network-domain-analyzer, Property 34: API Key Validation
   * Validates: Requirements 14.5, 14.6
   * 
   * For any request to protected endpoints without valid API key,
   * the system should reject with HTTP 401 status code.
   */
  describe('Property 34: API Key Validation', () => {
    it('should generate valid API keys with correct format', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100 }), (count) => {
          const keys = new Set<string>();
          
          for (let i = 0; i < count; i++) {
            const key = securityService.generateAPIKey();
            
            // Should start with prefix
            expect(key).toMatch(/^nda_/);
            
            // Should have correct length (prefix + 32 hex chars)
            expect(key.length).toBe(4 + 32); // 'nda_' + 32 chars
            
            // Should be hexadecimal after prefix
            const keyBody = key.substring(4);
            expect(keyBody).toMatch(/^[0-9a-f]{32}$/);
            
            // Should be unique
            expect(keys.has(key)).toBe(false);
            keys.add(key);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should validate correct API key format', () => {
      fc.assert(
        fc.property(fc.hexaString({ minLength: 32, maxLength: 32 }), (hexString) => {
          const apiKey = `nda_${hexString}`;
          const isValid = securityService.isValidAPIKeyFormat(apiKey);
          
          expect(isValid).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should reject invalid API key formats', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.startsWith('nda_')),
            fc.constant(''),
            fc.constant('nda_'),
            fc.constant('nda_tooshort'),
            fc.constant('nda_' + 'x'.repeat(32)), // non-hex characters
            fc.constant('wrong_' + 'a'.repeat(32)),
          ),
          (invalidKey) => {
            const isValid = securityService.isValidAPIKeyFormat(invalidKey);
            
            expect(isValid).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should hash and validate API keys correctly', async () => {
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 1, max: 3 }), async (count) => {
          for (let i = 0; i < count; i++) {
            const apiKey = securityService.generateAPIKey();
            const hash = await securityService.hashAPIKey(apiKey);
            
            // Hash should be different from original key
            expect(hash).not.toBe(apiKey);
            
            // Should validate correctly
            const isValid = await securityService.validateAPIKey(apiKey, hash);
            expect(isValid).toBe(true);
            
            // Wrong key should not validate
            const wrongKey = securityService.generateAPIKey();
            const isInvalid = await securityService.validateAPIKey(wrongKey, hash);
            expect(isInvalid).toBe(false);
          }
        }),
        { numRuns: 10, timeout: 30000 }
      );
    }, 60000);

    it('should reject API keys with invalid format during validation', async () => {
      // Pre-generate hash once to avoid repeated hashing
      const hash = await securityService.hashAPIKey('nda_' + 'a'.repeat(32));
      
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.string({ minLength: 1, maxLength: 50 }),
            fc.constant(''),
            fc.constant('invalid_key'),
          ),
          async (invalidKey) => {
            const isValid = await securityService.validateAPIKey(invalidKey, hash);
            
            expect(isValid).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);

    it('should handle empty or null hashes gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(fc.constant(securityService.generateAPIKey()), async (apiKey) => {
          // Empty hash should not validate
          const isValid1 = await securityService.validateAPIKey(apiKey, '');
          expect(isValid1).toBe(false);
        }),
        { numRuns: 20 }
      );
    });
  });
});
