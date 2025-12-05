/**
 * Security Service
 * Provides security-related functionality including API key management,
 * input sanitization, and malicious pattern detection
 */

import bcrypt from 'bcrypt';
import crypto from 'crypto';

interface MaliciousPattern {
  pattern: RegExp;
  description: string;
}

export class SecurityService {
  private readonly SALT_ROUNDS = 10;
  private readonly API_KEY_PREFIX = 'nda_';
  private readonly API_KEY_LENGTH = 32;

  // Malicious patterns to detect
  private readonly MALICIOUS_PATTERNS: MaliciousPattern[] = [
    {
      pattern: /(\%27)|(\%23)/i,
      description: 'SQL injection attempt',
    },
    {
      pattern: /(\'|%27)\s*(OR|AND|UNION|SELECT|DROP|INSERT|UPDATE|DELETE)/i,
      description: 'SQL injection with keywords',
    },
    {
      pattern: /'\s*=\s*'/i,
      description: 'SQL injection equality check',
    },
    {
      pattern: /--\s*$/,
      description: 'SQL comment at end',
    },
    {
      pattern: /<script/i,
      description: 'XSS script tag',
    },
    {
      pattern: /<\/script>/i,
      description: 'XSS script closing tag',
    },
    {
      pattern: /<[^>]*(on\w+)\s*=/i,
      description: 'HTML tag with event handler',
    },
    {
      pattern: /javascript:/i,
      description: 'JavaScript protocol',
    },
    {
      pattern: /on\w+\s*=/i,
      description: 'Event handler injection',
    },
    {
      pattern: /\.\.\//,
      description: 'Path traversal attempt',
    },
    {
      pattern: /<iframe[^>]*>/i,
      description: 'Iframe injection',
    },
    {
      pattern: /eval\s*\(/i,
      description: 'Eval function call',
    },
  ];

  /**
   * Generate a secure API key
   * @returns Generated API key with prefix
   */
  generateAPIKey(): string {
    const randomBytes = crypto.randomBytes(this.API_KEY_LENGTH);
    const keyBody = randomBytes.toString('hex').substring(0, this.API_KEY_LENGTH);
    return `${this.API_KEY_PREFIX}${keyBody}`;
  }

  /**
   * Hash an API key for storage
   * @param apiKey - Plain text API key
   * @returns Hashed API key
   */
  async hashAPIKey(apiKey: string): Promise<string> {
    return bcrypt.hash(apiKey, this.SALT_ROUNDS);
  }

  /**
   * Validate an API key against a hash
   * @param apiKey - Plain text API key to validate
   * @param hash - Stored hash to compare against
   * @returns True if valid, false otherwise
   */
  async validateAPIKey(apiKey: string, hash: string): Promise<boolean> {
    try {
      // Check format first
      if (!apiKey || !apiKey.startsWith(this.API_KEY_PREFIX)) {
        return false;
      }

      // Compare with hash
      return await bcrypt.compare(apiKey, hash);
    } catch (error) {
      console.error('API key validation error:', error);
      return false;
    }
  }

  /**
   * Detect malicious patterns in input
   * @param input - Input string to check
   * @returns Object with detection result and matched patterns
   */
  detectMaliciousPatterns(input: string): {
    detected: boolean;
    patterns: string[];
  } {
    const matchedPatterns: string[] = [];

    for (const { pattern, description } of this.MALICIOUS_PATTERNS) {
      if (pattern.test(input)) {
        matchedPatterns.push(description);
      }
    }

    return {
      detected: matchedPatterns.length > 0,
      patterns: matchedPatterns,
    };
  }

  /**
   * Sanitize input by removing potentially malicious content
   * @param input - Input string to sanitize
   * @returns Sanitized string
   */
  sanitizeInput(input: string): string {
    if (typeof input !== 'string') {
      return '';
    }

    let sanitized = input;

    // Remove HTML tags
    sanitized = sanitized.replace(/<[^>]*>/g, '');

    // Remove script tags and content
    sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gi, '');

    // Remove event handlers (with or without quotes)
    sanitized = sanitized.replace(/on\w+\s*=\s*["']?[^"'\s>]+["']?/gi, '');

    // Remove javascript: protocol
    sanitized = sanitized.replace(/javascript:/gi, '');

    // Remove SQL injection patterns
    sanitized = sanitized.replace(/(\%27)|(\%23)/gi, '');
    // Remove -- followed by space (SQL comment) but not -- in emails
    sanitized = sanitized.replace(/--\s/g, '');
    // Remove SQL keywords with quotes
    sanitized = sanitized.replace(/(\'|%27)\s*(OR|AND|UNION|SELECT|DROP|INSERT|UPDATE|DELETE)\s/gi, '');
    // Remove single quotes when followed by SQL-like patterns
    sanitized = sanitized.replace(/'\s*;/g, ';');

    // Remove path traversal
    sanitized = sanitized.replace(/\.\.\//g, '');

    // Trim whitespace
    sanitized = sanitized.trim();

    return sanitized;
  }

  /**
   * Validate and sanitize domain name
   * @param domain - Domain name to validate
   * @returns Sanitized domain or null if invalid
   */
  validateDomain(domain: string): string | null {
    if (!domain || typeof domain !== 'string') {
      return null;
    }

    // Sanitize first
    const sanitized = this.sanitizeInput(domain).toLowerCase();

    // Check for malicious patterns
    const detection = this.detectMaliciousPatterns(sanitized);
    if (detection.detected) {
      return null;
    }

    // Validate domain format (RFC 1035 compliant)
    const domainRegex = /^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]?(\.[a-z]{2,})+$/;
    if (!domainRegex.test(sanitized)) {
      return null;
    }

    return sanitized;
  }

  /**
   * Validate and sanitize IP address
   * @param ip - IP address to validate
   * @returns Sanitized IP or null if invalid
   */
  validateIP(ip: string): string | null {
    if (!ip || typeof ip !== 'string') {
      return null;
    }

    // Sanitize first
    const sanitized = this.sanitizeInput(ip).trim();

    // Check for malicious patterns
    const detection = this.detectMaliciousPatterns(sanitized);
    if (detection.detected) {
      return null;
    }

    // Validate IPv4
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipv4Regex.test(sanitized)) {
      const parts = sanitized.split('.');
      const valid = parts.every(part => {
        const num = parseInt(part, 10);
        return num >= 0 && num <= 255;
      });
      return valid ? sanitized : null;
    }

    // Validate IPv6 (simplified)
    const ipv6Regex = /^([0-9a-f]{0,4}:){2,7}[0-9a-f]{0,4}$/i;
    if (ipv6Regex.test(sanitized)) {
      return sanitized;
    }

    return null;
  }

  /**
   * Check if API key format is valid (without checking hash)
   * @param apiKey - API key to check
   * @returns True if format is valid
   */
  isValidAPIKeyFormat(apiKey: string): boolean {
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }

    // Check prefix
    if (!apiKey.startsWith(this.API_KEY_PREFIX)) {
      return false;
    }

    // Check length (prefix + key body)
    const expectedLength = this.API_KEY_PREFIX.length + this.API_KEY_LENGTH;
    if (apiKey.length !== expectedLength) {
      return false;
    }

    // Check that key body is hexadecimal
    const keyBody = apiKey.substring(this.API_KEY_PREFIX.length);
    const hexRegex = /^[0-9a-f]+$/i;
    return hexRegex.test(keyBody);
  }
}

// Export singleton instance
export const securityService = new SecurityService();
