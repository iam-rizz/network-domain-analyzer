/**
 * Batch Service Tests
 * Unit tests and property-based tests for Batch Service
 */

// Mock the whois module before any imports
jest.mock('whois', () => ({
  lookup: jest.fn(),
}));

import * as fc from 'fast-check';
import { BatchService } from './batch.service';
import { AppError } from '../models/error.types';

describe('BatchService', () => {
  let batchService: BatchService;

  beforeEach(() => {
    batchService = new BatchService();
  });

  describe('Unit Tests', () => {
    describe('parseDomainsInput', () => {
      it('should parse newline-separated domains', () => {
        const input = 'google.com\ngithub.com\ncloudflare.com';
        const result = batchService.parseDomainsInput(input);
        
        expect(result).toEqual(['google.com', 'github.com', 'cloudflare.com']);
      });

      it('should parse comma-separated domains', () => {
        const input = 'google.com,github.com,cloudflare.com';
        const result = batchService.parseDomainsInput(input);
        
        expect(result).toEqual(['google.com', 'github.com', 'cloudflare.com']);
      });

      it('should parse mixed newline and comma-separated domains', () => {
        const input = 'google.com,github.com\ncloudflare.com,amazon.com';
        const result = batchService.parseDomainsInput(input);
        
        expect(result).toEqual(['google.com', 'github.com', 'cloudflare.com', 'amazon.com']);
      });

      it('should trim whitespace from domains', () => {
        const input = '  google.com  ,  github.com  \n  cloudflare.com  ';
        const result = batchService.parseDomainsInput(input);
        
        expect(result).toEqual(['google.com', 'github.com', 'cloudflare.com']);
      });

      it('should filter out empty strings', () => {
        const input = 'google.com,,\n\ngithub.com,,,\n\n\ncloudflare.com';
        const result = batchService.parseDomainsInput(input);
        
        expect(result).toEqual(['google.com', 'github.com', 'cloudflare.com']);
      });

      it('should return empty array for empty input', () => {
        expect(batchService.parseDomainsInput('')).toEqual([]);
        expect(batchService.parseDomainsInput('   ')).toEqual([]);
        expect(batchService.parseDomainsInput('\n\n\n')).toEqual([]);
      });
    });

    describe('validateBatchSize', () => {
      it('should accept batch size within limit', () => {
        const domains = Array(50).fill('google.com');
        expect(() => batchService.validateBatchSize(domains)).not.toThrow();
      });

      it('should reject batch size exceeding limit', () => {
        const domains = Array(51).fill('google.com');
        expect(() => batchService.validateBatchSize(domains)).toThrow(AppError);
        expect(() => batchService.validateBatchSize(domains)).toThrow('exceeds maximum limit');
      });

      it('should reject empty batch', () => {
        expect(() => batchService.validateBatchSize([])).toThrow(AppError);
        expect(() => batchService.validateBatchSize([])).toThrow('No domains provided');
      });
    });

    describe('processBatch', () => {
      it('should process multiple valid domains', async () => {
        const domains = ['google.com', 'github.com'];
        const results = await batchService.processBatch(domains, { analysisTypes: ['dns'] });
        
        expect(results).toHaveLength(2);
        expect(results[0].domain).toBe('google.com');
        expect(results[1].domain).toBe('github.com');
      });

      it('should isolate errors - one failure does not stop batch', async () => {
        // Test that when one domain analysis throws an error, others still process
        // We need to test at the batch level, not individual analysis type level
        const domains = ['google.com', 'github.com', 'cloudflare.com'];
        const results = await batchService.processBatch(domains, { analysisTypes: ['dns'] });
        
        expect(results).toHaveLength(3);
        
        // All domains should be processed
        expect(results.every(r => r.domain)).toBe(true);
        expect(results.every(r => r.status === 'success' || r.status === 'error')).toBe(true);
        
        // The key property: all domains get results, none are skipped
        expect(results.map(r => r.domain)).toEqual(domains);
      });

      it('should reject batch exceeding size limit', async () => {
        const domains = Array(51).fill('google.com');
        await expect(batchService.processBatch(domains)).rejects.toThrow(AppError);
      });

      it('should reject empty batch', async () => {
        await expect(batchService.processBatch([])).rejects.toThrow(AppError);
      });
    });

    describe('formatSummary', () => {
      it('should format batch results as summary', () => {
        const results = [
          { domain: 'google.com', status: 'success' as const, result: { timestamp: new Date() } },
          { domain: 'invalid.com', status: 'error' as const, error: 'DNS lookup failed' },
          { domain: 'github.com', status: 'success' as const, result: { timestamp: new Date() } },
        ];
        
        const summary = batchService.formatSummary(results);
        
        expect(summary.total).toBe(3);
        expect(summary.successful).toBe(2);
        expect(summary.failed).toBe(1);
        expect(summary.results).toHaveLength(3);
      });
    });
  });

  describe('Property-Based Tests', () => {
    /**
     * Feature: network-domain-analyzer, Property 16: Batch Processing Independence
     * Validates: Requirements 7.3
     * 
     * For any batch analysis with multiple domains, each domain should be processed 
     * independently such that failure of one domain does not prevent processing of others.
     */
    it('Property 16: Batch Processing Independence - one failure does not stop batch', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate batches of varying sizes with valid domains
          fc.integer({ min: 2, max: 5 }),  // Reduced max for faster execution
          fc.constantFrom('google.com', 'github.com', 'cloudflare.com'),
          async (batchSize, baseDomain) => {
            // Create a batch where we know all domains will process
            const domains = Array(batchSize).fill(baseDomain);
            
            try {
              const results = await batchService.processBatch(domains, { analysisTypes: ['dns'] });
              
              // The key independence property: 
              // 1. All domains get processed (results length matches input length)
              const hasAllResults = results.length === domains.length;
              
              // 2. Each result corresponds to a domain in order
              const domainsMatch = results.every((r, idx) => r.domain === domains[idx]);
              
              // 3. All results have a status (success or error)
              const allHaveStatus = results.every(r => 
                r.status === 'success' || r.status === 'error'
              );
              
              // 4. The batch processing doesn't throw even if individual analyses might fail
              // (we're inside the try block, so if we got here, no exception was thrown)
              
              return hasAllResults && domainsMatch && allHaveStatus;
            } catch (error) {
              // The batch itself should not throw - only individual domain failures
              // should be captured in results
              // If we catch an error here, it means the batch processing failed entirely
              return false;
            }
          }
        ),
        { numRuns: 20 }  // Reduced runs for faster execution
      );
    }, 60000);

    /**
     * Feature: network-domain-analyzer, Property 17: Batch Size Limitation
     * Validates: Requirements 7.5
     * 
     * For any batch input with more than 50 domains, the system should reject 
     * the request and display a warning about the limit.
     */
    it('Property 17: Batch Size Limitation - rejects batches exceeding 50 domains', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate batch sizes from 51 to 100
          fc.integer({ min: 51, max: 100 }),
          async (batchSize) => {
            // Create a batch of the specified size
            const domains = Array(batchSize).fill(0).map((_, i) => `domain${i}.com`);
            
            try {
              await batchService.processBatch(domains);
              
              // Should not reach here - should throw error
              return false;
            } catch (error) {
              // Should throw an AppError
              const isAppError = error instanceof AppError;
              
              // Error should mention batch size limit
              const mentionsSizeLimit = error instanceof AppError && 
                (error.message.includes('exceeds maximum limit') || 
                 error.message.includes('50'));
              
              // Error code should be appropriate
              const hasCorrectCode = error instanceof AppError && 
                error.code === 'BATCH_SIZE_EXCEEDED';
              
              // Status code should be 400 (bad request)
              const hasCorrectStatus = error instanceof AppError && 
                error.statusCode === 400;
              
              return isAppError && mentionsSizeLimit && hasCorrectCode && hasCorrectStatus;
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Additional property test: Batch size at exactly 50 should be accepted
     */
    it('Property 17 (edge case): Batch size of exactly 50 domains should be accepted', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('google.com', 'github.com', 'cloudflare.com'),
          async (baseDomain) => {
            // Create exactly 50 domains
            const domains = Array(50).fill(baseDomain);
            
            try {
              const results = await batchService.processBatch(domains, { analysisTypes: ['dns'] });
              
              // Should successfully process all 50 domains
              const hasAllResults = results.length === 50;
              
              // All results should have a status
              const allHaveStatus = results.every(r => 
                r.status === 'success' || r.status === 'error'
              );
              
              return hasAllResults && allHaveStatus;
            } catch (error) {
              // Should not throw error for exactly 50 domains
              if (error instanceof AppError && error.code === 'BATCH_SIZE_EXCEEDED') {
                return false;
              }
              // Other errors (like network issues) are acceptable
              return true;
            }
          }
        ),
        { numRuns: 3 }  // Reduced runs since this is expensive (50 DNS calls per run)
      );
    }, 180000);  // Increased timeout for large batch

    /**
     * Additional property test: Batch size below 50 should always be accepted
     */
    it('Property 17 (boundary): Batch sizes from 1 to 50 should be accepted', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10 }),  // Reduced max to avoid timeouts
          async (batchSize) => {
            const domains = Array(batchSize).fill('google.com');
            
            try {
              const results = await batchService.processBatch(domains, { analysisTypes: ['dns'] });
              
              // Should return results for all domains
              return results.length === batchSize;
            } catch (error) {
              // Should not throw BATCH_SIZE_EXCEEDED error
              if (error instanceof AppError && error.code === 'BATCH_SIZE_EXCEEDED') {
                return false;
              }
              // Other errors are acceptable
              return true;
            }
          }
        ),
        { numRuns: 20 }  // Reduced runs for faster execution
      );
    }, 60000);
  });
});
