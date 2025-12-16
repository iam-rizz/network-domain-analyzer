/**
 * Input validation utilities for Network & Domain Analysis Tool
 * Provides validation functions for domains, IPs, ports, and input sanitization
 */

import dns from 'dns';
import { promisify } from 'util';
import {
  DomainValidationResult,
  IPValidationResult,
  PortValidationResult,
  ValidationError,
} from '../models/validation.types';

import os from 'os';

const dnsResolve4 = promisify(dns.resolve4);
const dnsResolve6 = promisify(dns.resolve6);

/**
 * Cache for server's own IP addresses
 * Populated on first call to getServerIPs()
 */
let serverIPsCache: string[] | null = null;

/**
 * Get all IP addresses of the current server
 * @returns Array of IP addresses
 */
export function getServerIPs(): string[] {
  if (serverIPsCache !== null) {
    return serverIPsCache;
  }

  const ips: string[] = [];
  const interfaces = os.networkInterfaces();

  for (const name of Object.keys(interfaces)) {
    const netInterface = interfaces[name];
    if (!netInterface) continue;

    for (const info of netInterface) {
      // Skip internal/loopback addresses (already blocked)
      if (info.internal) continue;
      ips.push(info.address);
    }
  }

  serverIPsCache = ips;
  return ips;
}

/**
 * Clear the server IPs cache (useful for testing)
 */
export function clearServerIPsCache(): void {
  serverIPsCache = null;
}

/**
 * Check if an IP address belongs to this server
 * @param ip - IP address to check
 * @returns true if IP belongs to this server
 */
export function isSelfIP(ip: string): boolean {
  const serverIPs = getServerIPs();
  return serverIPs.includes(ip);
}

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
 * Detects if an IPv4 address is local/internal (more comprehensive check)
 * Includes: loopback, private, link-local, broadcast, documentation, reserved
 * @param ip - IPv4 address to check
 * @returns true if local/internal, false otherwise
 */
function isLocalIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  
  // 0.0.0.0/8 - Current network
  if (parts[0] === 0) {
    return true;
  }
  
  // 10.0.0.0/8 - Private Class A
  if (parts[0] === 10) {
    return true;
  }
  
  // 127.0.0.0/8 - Loopback
  if (parts[0] === 127) {
    return true;
  }
  
  // 169.254.0.0/16 - Link-local
  if (parts[0] === 169 && parts[1] === 254) {
    return true;
  }
  
  // 172.16.0.0/12 - Private Class B (172.16.0.0 - 172.31.255.255)
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) {
    return true;
  }
  
  // 192.168.0.0/16 - Private Class C
  if (parts[0] === 192 && parts[1] === 168) {
    return true;
  }
  
  // 192.0.0.0/24 - IETF Protocol Assignments
  if (parts[0] === 192 && parts[1] === 0 && parts[2] === 0) {
    return true;
  }
  
  // 192.0.2.0/24 - TEST-NET-1 (Documentation)
  if (parts[0] === 192 && parts[1] === 0 && parts[2] === 2) {
    return true;
  }
  
  // 198.51.100.0/24 - TEST-NET-2 (Documentation)
  if (parts[0] === 198 && parts[1] === 51 && parts[2] === 100) {
    return true;
  }
  
  // 203.0.113.0/24 - TEST-NET-3 (Documentation)
  if (parts[0] === 203 && parts[1] === 0 && parts[2] === 113) {
    return true;
  }
  
  // 224.0.0.0/4 - Multicast
  if (parts[0] >= 224 && parts[0] <= 239) {
    return true;
  }
  
  // 240.0.0.0/4 - Reserved for future use
  if (parts[0] >= 240 && parts[0] <= 255) {
    return true;
  }
  
  // 255.255.255.255 - Broadcast
  if (parts[0] === 255 && parts[1] === 255 && parts[2] === 255 && parts[3] === 255) {
    return true;
  }
  
  return false;
}

/**
 * Detects if an IPv6 address is local/internal (more comprehensive check)
 * @param ip - IPv6 address to check
 * @returns true if local/internal, false otherwise
 */
function isLocalIPv6(ip: string): boolean {
  const lowerIP = ip.toLowerCase().trim();
  
  // Unspecified address ::
  if (lowerIP === '::' || lowerIP === '0:0:0:0:0:0:0:0') {
    return true;
  }
  
  // Loopback ::1
  if (lowerIP === '::1' || lowerIP === '0:0:0:0:0:0:0:1') {
    return true;
  }
  
  // Link-local fe80::/10
  if (lowerIP.startsWith('fe80:') || lowerIP.startsWith('fe8') || 
      lowerIP.startsWith('fe9') || lowerIP.startsWith('fea') || lowerIP.startsWith('feb')) {
    return true;
  }
  
  // Unique local fc00::/7 (fc00:: - fdff::)
  if (lowerIP.startsWith('fc') || lowerIP.startsWith('fd')) {
    return true;
  }
  
  // IPv4-mapped IPv6 addresses ::ffff:x.x.x.x
  const ipv4MappedMatch = lowerIP.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (ipv4MappedMatch) {
    return isLocalIPv4(ipv4MappedMatch[1]);
  }
  
  // Multicast ff00::/8
  if (lowerIP.startsWith('ff')) {
    return true;
  }
  
  return false;
}

/**
 * Check if hostname resolves to local/internal address
 * @param hostname - Hostname to check
 * @returns true if hostname is local, false otherwise
 */
export function isLocalHostname(hostname: string): boolean {
  const lowerHostname = hostname.toLowerCase().trim();
  
  // Common local hostnames
  const localHostnames = [
    'localhost',
    'localhost.localdomain',
    'local',
    'broadcasthost',
    'ip6-localhost',
    'ip6-loopback',
  ];
  
  if (localHostnames.includes(lowerHostname)) {
    return true;
  }
  
  // Check for .local TLD
  if (lowerHostname.endsWith('.local') || lowerHostname.endsWith('.localhost')) {
    return true;
  }
  
  // Check for .internal TLD
  if (lowerHostname.endsWith('.internal')) {
    return true;
  }
  
  // Check for common internal domain patterns
  if (lowerHostname.endsWith('.lan') || lowerHostname.endsWith('.home')) {
    return true;
  }
  
  return false;
}

/**
 * Comprehensive check if IP or hostname is local/internal
 * Use this to prevent SSRF attacks
 * @param target - IP address or hostname to check
 * @returns Object with isLocal flag and reason
 */
export function isLocalTarget(target: string): { isLocal: boolean; reason?: string } {
  if (!target || typeof target !== 'string') {
    return { isLocal: false };
  }
  
  const trimmedTarget = target.trim();
  
  // Check if it's a hostname
  if (isLocalHostname(trimmedTarget)) {
    return { isLocal: true, reason: 'Local hostname not allowed' };
  }
  
  // Validate as IP
  const ipValidation = validateIP(trimmedTarget);
  
  if (ipValidation.valid) {
    if (ipValidation.type === 'IPv4' && isLocalIPv4(trimmedTarget)) {
      return { isLocal: true, reason: 'Private/local IPv4 address not allowed' };
    }
    
    if (ipValidation.type === 'IPv6' && isLocalIPv6(trimmedTarget)) {
      return { isLocal: true, reason: 'Private/local IPv6 address not allowed' };
    }
  }
  
  return { isLocal: false };
}

/**
 * Extract hostname from URL and check if it's local
 * @param url - URL to check
 * @returns Object with isLocal flag and reason
 */
export function isLocalURL(url: string): { isLocal: boolean; reason?: string } {
  if (!url || typeof url !== 'string') {
    return { isLocal: false };
  }
  
  try {
    // Add protocol if missing for URL parsing
    let urlToParse = url.trim();
    if (!urlToParse.match(/^https?:\/\//i)) {
      urlToParse = 'http://' + urlToParse;
    }
    
    const parsedUrl = new URL(urlToParse);
    const hostname = parsedUrl.hostname;
    
    return isLocalTarget(hostname);
  } catch {
    // If URL parsing fails, try checking as hostname directly
    return isLocalTarget(url);
  }
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
 * Check if resolved IP is local (for internal use)
 */
function isResolvedIPLocal(ip: string): boolean {
  const ipValidation = validateIP(ip);
  if (!ipValidation.valid) return false;
  
  if (ipValidation.type === 'IPv4') {
    return isLocalIPv4(ip);
  }
  if (ipValidation.type === 'IPv6') {
    return isLocalIPv6(ip);
  }
  return false;
}

/**
 * Options for resolveAndCheckLocal
 */
export interface ResolveCheckOptions {
  /** Block requests targeting the server's own IP addresses */
  blockSelfIP?: boolean;
}

/**
 * Resolve hostname to IP and check if it points to local/internal address
 * This prevents DNS rebinding attacks where a domain resolves to internal IPs
 * @param hostname - Hostname to resolve and check
 * @param options - Additional options
 * @returns Object with isLocal flag, resolved IPs, and reason
 */
export async function resolveAndCheckLocal(
  hostname: string,
  options: ResolveCheckOptions = {}
): Promise<{
  isLocal: boolean;
  isSelf: boolean;
  resolvedIPs: string[];
  localIPs: string[];
  selfIPs: string[];
  reason?: string;
}> {
  const { blockSelfIP = true } = options;

  // First check if hostname itself is local
  if (isLocalHostname(hostname)) {
    return {
      isLocal: true,
      isSelf: false,
      resolvedIPs: [],
      localIPs: [],
      selfIPs: [],
      reason: 'Local hostname not allowed',
    };
  }
  
  // Check if it's already an IP address
  const ipCheck = isLocalTarget(hostname);
  if (ipCheck.isLocal) {
    return {
      isLocal: true,
      isSelf: false,
      resolvedIPs: [hostname],
      localIPs: [hostname],
      selfIPs: [],
      reason: ipCheck.reason,
    };
  }
  
  // If it's a valid IP, check for self IP
  const ipValidation = validateIP(hostname);
  if (ipValidation.valid) {
    if (blockSelfIP && isSelfIP(hostname)) {
      return {
        isLocal: false,
        isSelf: true,
        resolvedIPs: [hostname],
        localIPs: [],
        selfIPs: [hostname],
        reason: 'Targeting server\'s own IP address is not allowed',
      };
    }
    return {
      isLocal: false,
      isSelf: false,
      resolvedIPs: [hostname],
      localIPs: [],
      selfIPs: [],
    };
  }
  
  // Resolve DNS
  const resolvedIPs: string[] = [];
  const localIPs: string[] = [];
  const selfIPs: string[] = [];
  
  try {
    // Try to resolve IPv4
    const ipv4Addresses = await dnsResolve4(hostname);
    resolvedIPs.push(...ipv4Addresses);
  } catch {
    // No IPv4 records, continue
  }
  
  try {
    // Try to resolve IPv6
    const ipv6Addresses = await dnsResolve6(hostname);
    resolvedIPs.push(...ipv6Addresses);
  } catch {
    // No IPv6 records, continue
  }
  
  // If no IPs resolved, allow (DNS lookup will fail later anyway)
  if (resolvedIPs.length === 0) {
    return {
      isLocal: false,
      isSelf: false,
      resolvedIPs: [],
      localIPs: [],
      selfIPs: [],
    };
  }
  
  // Check each resolved IP
  for (const ip of resolvedIPs) {
    if (isResolvedIPLocal(ip)) {
      localIPs.push(ip);
    } else if (blockSelfIP && isSelfIP(ip)) {
      selfIPs.push(ip);
    }
  }
  
  if (localIPs.length > 0) {
    return {
      isLocal: true,
      isSelf: false,
      resolvedIPs,
      localIPs,
      selfIPs,
      reason: `Domain resolves to local/internal IP: ${localIPs.join(', ')}`,
    };
  }
  
  if (selfIPs.length > 0) {
    return {
      isLocal: false,
      isSelf: true,
      resolvedIPs,
      localIPs,
      selfIPs,
      reason: `Domain resolves to server's own IP: ${selfIPs.join(', ')}`,
    };
  }
  
  return {
    isLocal: false,
    isSelf: false,
    resolvedIPs,
    localIPs: [],
    selfIPs: [],
  };
}

/**
 * Resolve URL hostname and check if it points to local/internal address
 * @param url - URL to check
 * @param options - Additional options
 * @returns Object with isLocal flag, resolved IPs, and reason
 */
export async function resolveURLAndCheckLocal(
  url: string,
  options: ResolveCheckOptions = {}
): Promise<{
  isLocal: boolean;
  isSelf: boolean;
  hostname: string;
  resolvedIPs: string[];
  localIPs: string[];
  selfIPs: string[];
  reason?: string;
}> {
  if (!url || typeof url !== 'string') {
    return {
      isLocal: false,
      isSelf: false,
      hostname: '',
      resolvedIPs: [],
      localIPs: [],
      selfIPs: [],
    };
  }
  
  try {
    // Add protocol if missing for URL parsing
    let urlToParse = url.trim();
    if (!urlToParse.match(/^https?:\/\//i)) {
      urlToParse = 'http://' + urlToParse;
    }
    
    const parsedUrl = new URL(urlToParse);
    const hostname = parsedUrl.hostname;
    
    const result = await resolveAndCheckLocal(hostname, options);
    return {
      ...result,
      hostname,
    };
  } catch {
    // If URL parsing fails, try checking as hostname directly
    const result = await resolveAndCheckLocal(url, options);
    return {
      ...result,
      hostname: url,
    };
  }
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
