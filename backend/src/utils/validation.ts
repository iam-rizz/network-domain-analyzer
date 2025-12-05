/**
 * Input validation utilities for Network & Domain Analysis Tool
 * Provides validation functions for domains, IPs, ports, and input sanitization
 */

import {
  DomainValidationResult,
  IPValidationResult,
  PortValidationResult,
  ValidationError,
} from '../models/validation.types';

/**
 * Validates domain name format according to RFC 1035
 * @param domain - Domain name to validate
 * @returns DomainValidationResult with validation status and errors
 */
export function validateDomain(domain: string): DomainValidationResult {
  const errors: ValidationError[] = [];

  // Check if domain is empty
  if (!domain || domain.trim().length === 0) {
    errors.push({
      field: 'domain',
      message: 'Domain name is required',
      code: 'DOMAIN_REQUIRED',
    });
    return { valid: false, errors };
  }

  const trimmedDomain = domain.trim().toLowerCase();

  // Check length constraints
  if (trimmedDomain.length > 255) {
    errors.push({
      field: 'domain',
      message: 'Domain name exceeds maximum length of 255 characters',
      code: 'DOMAIN_TOO_LONG',
    });
  }

  // RFC 1035 compliant domain regex
  // - Must start with alphanumeric
  // - Can contain alphanumeric and hyphens
  // - Must end with alphanumeric
  // - Must have at least one dot followed by TLD
  // - Each label max 63 characters
  const domainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,}$/i;

  if (!domainRegex.test(trimmedDomain)) {
    errors.push({
      field: 'domain',
      message: 'Invalid domain format. Example: example.com',
      code: 'INVALID_DOMAIN_FORMAT',
    });
  }

  // Check for consecutive dots
  if (trimmedDomain.includes('..')) {
    errors.push({
      field: 'domain',
      message: 'Domain cannot contain consecutive dots',
      code: 'INVALID_DOMAIN_FORMAT',
    });
  }

  // Check for leading/trailing dots or hyphens
  if (trimmedDomain.startsWith('.') || trimmedDomain.endsWith('.') ||
      trimmedDomain.startsWith('-') || trimmedDomain.endsWith('-')) {
    errors.push({
      field: 'domain',
      message: 'Domain cannot start or end with dot or hyphen',
      code: 'INVALID_DOMAIN_FORMAT',
    });
  }

  // Check each label length (max 63 characters per label)
  const labels = trimmedDomain.split('.');
  for (const label of labels) {
    if (label.length > 63) {
      errors.push({
        field: 'domain',
        message: 'Each domain label must be 63 characters or less',
        code: 'DOMAIN_LABEL_TOO_LONG',
      });
      break;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    domain: errors.length === 0 ? trimmedDomain : undefined,
  };
}

/**
 * Validates IP address format (IPv4 and IPv6)
 * @param ip - IP address to validate
 * @returns IPValidationResult with validation status, type, and errors
 */
export function validateIP(ip: string): IPValidationResult {
  const errors: ValidationError[] = [];

  // Check if IP is empty
  if (!ip || ip.trim().length === 0) {
    errors.push({
      field: 'ip',
      message: 'IP address is required',
      code: 'IP_REQUIRED',
    });
    return { valid: false, errors };
  }

  const trimmedIP = ip.trim();

  // Try IPv4 validation first
  const ipv4Regex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  
  if (ipv4Regex.test(trimmedIP)) {
    const isPrivate = isPrivateIPv4(trimmedIP);
    return {
      valid: true,
      errors: [],
      ip: trimmedIP,
      type: 'IPv4',
      isPrivate,
    };
  }

  // Try IPv6 validation
  const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;

  if (ipv6Regex.test(trimmedIP)) {
    const isPrivate = isPrivateIPv6(trimmedIP);
    return {
      valid: true,
      errors: [],
      ip: trimmedIP,
      type: 'IPv6',
      isPrivate,
    };
  }

  // Neither IPv4 nor IPv6
  errors.push({
    field: 'ip',
    message: 'Invalid IP address format. Must be valid IPv4 or IPv6',
    code: 'INVALID_IP_FORMAT',
  });

  return { valid: false, errors };
}

/**
 * Validates port number (1-65535)
 * @param port - Port number to validate
 * @returns PortValidationResult with validation status and errors
 */
export function validatePort(port: number | string): PortValidationResult {
  const errors: ValidationError[] = [];

  // Convert to number if string
  const portNum = typeof port === 'string' ? parseInt(port, 10) : port;

  // Check if valid number
  if (isNaN(portNum)) {
    errors.push({
      field: 'port',
      message: 'Port must be a valid number',
      code: 'INVALID_PORT_FORMAT',
    });
    return { valid: false, errors };
  }

  // Check if integer
  if (!Number.isInteger(portNum)) {
    errors.push({
      field: 'port',
      message: 'Port must be an integer',
      code: 'INVALID_PORT_FORMAT',
    });
  }

  // Check range (1-65535)
  if (portNum < 1 || portNum > 65535) {
    errors.push({
      field: 'port',
      message: 'Port must be between 1 and 65535',
      code: 'PORT_OUT_OF_RANGE',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    port: errors.length === 0 ? portNum : undefined,
  };
}

/**
 * Detects if an IPv4 address is private
 * Private ranges: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8
 * @param ip - IPv4 address to check
 * @returns true if private, false otherwise
 */
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  
  // 10.0.0.0/8
  if (parts[0] === 10) {
    return true;
  }
  
  // 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) {
    return true;
  }
  
  // 192.168.0.0/16
  if (parts[0] === 192 && parts[1] === 168) {
    return true;
  }
  
  // 127.0.0.0/8 (loopback)
  if (parts[0] === 127) {
    return true;
  }
  
  return false;
}

/**
 * Detects if an IPv6 address is private
 * Private ranges: fc00::/7 (unique local), fe80::/10 (link-local), ::1 (loopback)
 * @param ip - IPv6 address to check
 * @returns true if private, false otherwise
 */
function isPrivateIPv6(ip: string): boolean {
  const lowerIP = ip.toLowerCase();
  
  // Loopback ::1
  if (lowerIP === '::1') {
    return true;
  }
  
  // Link-local fe80::/10
  if (lowerIP.startsWith('fe80:')) {
    return true;
  }
  
  // Unique local fc00::/7 (fc00:: - fdff::)
  if (lowerIP.startsWith('fc') || lowerIP.startsWith('fd')) {
    return true;
  }
  
  return false;
}

/**
 * Detects if an IP address is private (works for both IPv4 and IPv6)
 * @param ip - IP address to check
 * @returns true if private, false otherwise
 */
export function isPrivateIP(ip: string): boolean {
  const validation = validateIP(ip);
  
  if (!validation.valid) {
    return false;
  }
  
  return validation.isPrivate || false;
}

/**
 * Sanitizes user input to prevent injection attacks
 * Removes potentially malicious patterns
 * @param input - User input to sanitize
 * @returns Sanitized string
 */
export function sanitizeInput(input: string): string {
  if (!input) {
    return '';
  }

  let sanitized = input.trim();

  // Remove HTML tags
  sanitized = sanitized.replace(/<[^>]*>/g, '');

  // Remove script tags and content
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove event handlers (onclick, onerror, etc.)
  sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');

  // Remove javascript: protocol
  sanitized = sanitized.replace(/javascript:/gi, '');

  // Remove SQL injection patterns
  sanitized = sanitized.replace(/(\%27)|(\')|(\-\-)|(\%23)|(#)/gi, '');

  // Remove path traversal patterns
  sanitized = sanitized.replace(/\.\.\//g, '');

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');

  return sanitized;
}

/**
 * Detects malicious patterns in input
 * @param input - User input to check
 * @returns true if malicious patterns detected, false otherwise
 */
export function detectMaliciousPatterns(input: string): boolean {
  if (!input) {
    return false;
  }

  const maliciousPatterns = [
    /(\%27)|(\')|(\-\-)|(\%23)|(#)/i,  // SQL injection
    /<script[^>]*>.*?<\/script>/gi,     // XSS script tags
    /javascript:/gi,                     // JavaScript protocol
    /on\w+\s*=/gi,                       // Event handlers
    /\.\.\//g,                           // Path traversal
    /<iframe/gi,                         // Iframe injection
    /eval\s*\(/gi,                       // Eval function
    /expression\s*\(/gi,                 // CSS expression
  ];

  return maliciousPatterns.some(pattern => pattern.test(input));
}
