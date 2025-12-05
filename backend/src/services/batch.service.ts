/**
 * Batch Analysis Service
 * Provides batch processing functionality for multiple domains
 */

import { DNSService } from './dns.service';
import { WHOISService } from './whois.service';
import { RDAPService } from './rdap.service';
import { HostService } from './host.service';
import { BatchResult } from '../models/analysis.types';
import { AppError } from '../models/error.types';

const MAX_BATCH_SIZE = 50;

export interface BatchAnalysisOptions {
  analysisTypes?: ('dns' | 'whois' | 'rdap' | 'host' | 'all')[];
}

export interface BatchProgress {
  total: number;
  completed: number;
  failed: number;
  results: BatchResult[];
}

export class BatchService {
  private dnsService: DNSService;
  private whoisService: WHOISService;
  private rdapService: RDAPService;
  private hostService: HostService;

  constructor() {
    this.dnsService = new DNSService();
    this.whoisService = new WHOISService();
    this.rdapService = new RDAPService('./dns.json');
    this.hostService = new HostService();
  }

  /**
   * Parse input string into array of domains
   * Supports newline and comma-separated formats
   * @param input - Raw input string with domains
   * @returns Array of domain strings
   */
  parseDomainsInput(input: string): string[] {
    if (!input || typeof input !== 'string') {
      return [];
    }

    // Split by newlines and commas, then clean up
    const domains = input
      .split(/[\n,]+/)
      .map(domain => domain.trim())
      .filter(domain => domain.length > 0);

    return domains;
  }

  /**
   * Validate batch size
   * @param domains - Array of domains
   * @throws AppError if batch size exceeds limit
   */
  validateBatchSize(domains: string[]): void {
    if (domains.length > MAX_BATCH_SIZE) {
      throw new AppError(
        'BATCH_SIZE_EXCEEDED',
        `Batch size exceeds maximum limit of ${MAX_BATCH_SIZE} domains. You provided ${domains.length} domains.`,
        400,
        { maxSize: MAX_BATCH_SIZE, providedSize: domains.length }
      );
    }

    if (domains.length === 0) {
      throw new AppError(
        'EMPTY_BATCH',
        'No domains provided for batch analysis',
        400
      );
    }
  }

  /**
   * Process multiple domains in batch
   * Each domain is processed independently with error isolation
   * @param domains - Array of domain names
   * @param options - Batch analysis options
   * @returns Array of batch results
   */
  async processBatch(
    domains: string[],
    options: BatchAnalysisOptions = {}
  ): Promise<BatchResult[]> {
    // Validate batch size
    this.validateBatchSize(domains);

    const results: BatchResult[] = [];

    // Process each domain independently
    // Using for...of to process sequentially for better error isolation
    // and to avoid overwhelming external services
    for (const domain of domains) {
      try {
        const result = await this.analyzeDomain(domain, options);
        results.push({
          domain,
          status: 'success',
          result,
        });
      } catch (error: any) {
        // Isolate errors - one domain failure doesn't stop the batch
        results.push({
          domain,
          status: 'error',
          error: error.message || 'Unknown error occurred',
        });
      }
    }

    return results;
  }

  /**
   * Analyze a single domain
   * @param domain - Domain name to analyze
   * @param options - Analysis options
   * @returns Analysis result object
   */
  private async analyzeDomain(
    domain: string,
    options: BatchAnalysisOptions
  ): Promise<any> {
    const analysisTypes = options.analysisTypes || ['dns'];
    const result: any = {
      domain,
      timestamp: new Date(),
    };

    // Perform requested analysis types
    if (analysisTypes.includes('dns') || analysisTypes.includes('all')) {
      try {
        result.dns = await this.dnsService.lookupRecords(domain);
      } catch (error: any) {
        result.dns = { error: error.message };
      }
    }

    if (analysisTypes.includes('rdap') || analysisTypes.includes('all')) {
      try {
        result.rdap = await this.rdapService.lookupDomain(domain);
      } catch (error: any) {
        result.rdap = { error: error.message };
      }
    }

    if (analysisTypes.includes('whois') || analysisTypes.includes('all')) {
      try {
        result.whois = await this.whoisService.lookup(domain);
      } catch (error: any) {
        result.whois = { error: error.message };
      }
    }

    if (analysisTypes.includes('host') || analysisTypes.includes('all')) {
      try {
        result.host = await this.hostService.checkHTTP(`https://${domain}`);
      } catch (error: any) {
        result.host = { error: error.message };
      }
    }

    return result;
  }

  /**
   * Process batch with progress tracking
   * @param domains - Array of domain names
   * @param options - Batch analysis options
   * @param progressCallback - Optional callback for progress updates
   * @returns Array of batch results
   */
  async processBatchWithProgress(
    domains: string[],
    options: BatchAnalysisOptions = {},
    progressCallback?: (progress: BatchProgress) => void
  ): Promise<BatchResult[]> {
    // Validate batch size
    this.validateBatchSize(domains);

    const results: BatchResult[] = [];
    let completed = 0;
    let failed = 0;

    for (const domain of domains) {
      try {
        const result = await this.analyzeDomain(domain, options);
        results.push({
          domain,
          status: 'success',
          result,
        });
        completed++;
      } catch (error: any) {
        results.push({
          domain,
          status: 'error',
          error: error.message || 'Unknown error occurred',
        });
        failed++;
      }

      // Call progress callback if provided
      if (progressCallback) {
        progressCallback({
          total: domains.length,
          completed: completed + failed,
          failed,
          results: [...results],
        });
      }
    }

    return results;
  }

  /**
   * Format batch results as summary table
   * @param results - Array of batch results
   * @returns Formatted summary object
   */
  formatSummary(results: BatchResult[]): any {
    const summary = {
      total: results.length,
      successful: results.filter(r => r.status === 'success').length,
      failed: results.filter(r => r.status === 'error').length,
      results: results.map(r => ({
        domain: r.domain,
        status: r.status,
        error: r.error,
        // Include basic info from result if successful
        ...(r.status === 'success' && r.result ? {
          hasData: true,
          timestamp: r.result.timestamp,
        } : {}),
      })),
    };

    return summary;
  }
}
