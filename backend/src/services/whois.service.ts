/**
 * WHOIS Service
 * Provides WHOIS lookup functionality for domain registration information
 */

import * as whois from 'whois';
import { promisify } from 'util';
import { WHOISResult } from '../models/whois.types';
import { AppError } from '../models/error.types';
import { validateDomain } from '../utils/validation';

const whoisLookup = promisify(whois.lookup);

// Timeout for WHOIS queries (10 seconds)
const WHOIS_TIMEOUT = 10000;

export class WHOISService {
  /**
   * Perform WHOIS lookup for a domain
   * @param domain - Domain name to lookup
   * @returns WHOISResult with domain registration information
   */
  async lookup(domain: string): Promise<WHOISResult> {
    // Validate domain format (Requirement 1.4, 10.1)
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

    try {
      // Perform WHOIS lookup with timeout
      const rawData = await Promise.race([
        whoisLookup(normalizedDomain),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('WHOIS query timeout')), WHOIS_TIMEOUT)
        ),
      ]);

      // Parse WHOIS data (Requirement 6.1, 6.2)
      return this.parseWHOISData(String(rawData), normalizedDomain);
    } catch (error: any) {
      // Handle timeout errors
      if (error.message === 'WHOIS query timeout') {
        throw new AppError(
          'TIMEOUT_ERROR',
          `WHOIS query timeout after ${WHOIS_TIMEOUT}ms`,
          408,
          { domain: normalizedDomain, timeout: WHOIS_TIMEOUT }
        );
      }

      // Handle other errors
      throw new AppError(
        'WHOIS_LOOKUP_FAILED',
        `WHOIS lookup failed: ${error.message}`,
        500,
        { domain: normalizedDomain, error: error.message }
      );
    }
  }

  /**
   * Parse raw WHOIS data into structured format
   * @param rawData - Raw WHOIS response string
   * @param domain - Domain name
   * @returns WHOISResult with parsed information
   */
  private parseWHOISData(rawData: string, domain: string): WHOISResult {
    const lines = rawData.split('\n');

    let registrar = 'Unknown';
    let registrationDate: Date | null = null;
    let expirationDate: Date | null = null;
    const nameServers: string[] = [];
    const status: string[] = [];
    let isPrivacyProtected = false;
    let isAvailable = false;

    // Check for unregistered domain indicators (Requirement 6.5)
    const lowerRawData = rawData.toLowerCase();
    if (
      lowerRawData.includes('no match') ||
      lowerRawData.includes('not found') ||
      lowerRawData.includes('no entries found') ||
      lowerRawData.includes('domain not found') ||
      lowerRawData.includes('no data found') ||
      lowerRawData.includes('status: available') ||
      lowerRawData.includes('status: free')
    ) {
      isAvailable = true;
    }

    // Check for privacy protection (Requirement 6.4)
    if (
      lowerRawData.includes('redacted for privacy') ||
      lowerRawData.includes('data protected') ||
      lowerRawData.includes('privacy protect') ||
      lowerRawData.includes('whois privacy') ||
      lowerRawData.includes('contact privacy')
    ) {
      isPrivacyProtected = true;
    }

    // Parse WHOIS data line by line (Requirement 6.1, 6.2)
    for (const line of lines) {
      const trimmedLine = line.trim();

      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith('%') || trimmedLine.startsWith('#')) {
        continue;
      }

      // Parse registrar
      if (trimmedLine.match(/^Registrar:/i) || trimmedLine.match(/^Registrar Name:/i)) {
        const value = trimmedLine.split(':').slice(1).join(':').trim();
        if (value && value.toLowerCase() !== 'not disclosed') {
          registrar = value;
        }
      }

      // Parse registration date
      if (
        trimmedLine.match(/^Creation Date:/i) ||
        trimmedLine.match(/^Created:/i) ||
        trimmedLine.match(/^Created On:/i) ||
        trimmedLine.match(/^Registration Date:/i)
      ) {
        const dateStr = trimmedLine.split(':').slice(1).join(':').trim();
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) {
          registrationDate = parsed;
        }
      }

      // Parse expiration date
      if (
        trimmedLine.match(/^Registry Expiry Date:/i) ||
        trimmedLine.match(/^Registrar Registration Expiration Date:/i) ||
        trimmedLine.match(/^Expiration Date:/i) ||
        trimmedLine.match(/^Expires:/i) ||
        trimmedLine.match(/^Expires On:/i) ||
        trimmedLine.match(/^Expiry Date:/i)
      ) {
        const dateStr = trimmedLine.split(':').slice(1).join(':').trim();
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) {
          expirationDate = parsed;
        }
      }

      // Parse nameservers (Requirement 6.2)
      if (
        trimmedLine.match(/^Name Server:/i) ||
        trimmedLine.match(/^Nameserver:/i) ||
        trimmedLine.match(/^nserver:/i)
      ) {
        const ns = trimmedLine.split(':')[1]?.trim().toLowerCase();
        if (ns && !nameServers.includes(ns)) {
          nameServers.push(ns);
        }
      }

      // Parse status
      if (trimmedLine.match(/^Domain Status:/i) || trimmedLine.match(/^Status:/i)) {
        const statusValue = trimmedLine.split(':')[1]?.trim();
        if (statusValue && !status.includes(statusValue)) {
          status.push(statusValue);
        }
      }
    }

    // Handle unregistered domains (Requirement 6.5)
    if (isAvailable) {
      status.push('Available for Registration');
    }

    // Handle privacy-protected data (Requirement 6.4)
    if (isPrivacyProtected && registrar === 'Unknown') {
      registrar = 'Privacy Protected';
    }

    // Set default dates if not found
    if (!registrationDate) {
      registrationDate = new Date(0); // Unix epoch for unknown
    }
    if (!expirationDate) {
      expirationDate = new Date(0); // Unix epoch for unknown
    }

    return {
      domain,
      registrar,
      registrationDate,
      expirationDate,
      nameServers,
      status,
      timestamp: new Date(),
    };
  }

  /**
   * Check if domain needs renewal reminder (Requirement 6.3)
   * @param expirationDate - Domain expiration date
   * @returns true if domain expires within 60 days
   */
  needsRenewalReminder(expirationDate: Date): boolean {
    const now = new Date();
    const daysUntilExpiry = Math.floor(
      (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysUntilExpiry > 0 && daysUntilExpiry <= 60;
  }

  /**
   * Calculate days until domain expiration
   * @param expirationDate - Domain expiration date
   * @returns Number of days until expiration (negative if expired)
   */
  getDaysUntilExpiry(expirationDate: Date): number {
    const now = new Date();
    return Math.floor((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }
}
