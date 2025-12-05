/**
 * Tests for retry utility and timeout configuration
 */

import * as fc from 'fast-check';
import { withRetry, withTimeout, TIMEOUTS } from './retry';

describe('Retry Utility', () => {
  describe('withRetry', () => {
    it('should succeed on first attempt if function succeeds', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      const result = await withRetry(mockFn);
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable errors', async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce({ code: 'ETIMEDOUT', message: 'Timeout' })
        .mockResolvedValueOnce('success');
      
      const result = await withRetry(mockFn, { initialDelay: 10, maxRetries: 2 });
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should not retry on non-retryable errors', async () => {
      const mockFn = jest.fn().mockRejectedValue({ code: 'INVALID_INPUT', message: 'Bad input' });
      
      await expect(withRetry(mockFn, { maxRetries: 2 })).rejects.toMatchObject({
        code: 'INVALID_INPUT',
      });
      
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should throw after max retries', async () => {
      const mockFn = jest.fn().mockRejectedValue({ code: 'ETIMEDOUT', message: 'Timeout' });
      
      await expect(
        withRetry(mockFn, { initialDelay: 10, maxRetries: 2 })
      ).rejects.toMatchObject({
        code: 'ETIMEDOUT',
      });
      
      expect(mockFn).toHaveBeenCalledTimes(3); // initial + 2 retries
    });
  });

  describe('withTimeout', () => {
    it('should succeed if function completes within timeout', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      const result = await withTimeout(mockFn, 1000);
      
      expect(result).toBe('success');
    });

    it('should throw timeout error if function takes too long', async () => {
      const mockFn = jest.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve('success'), 2000))
      );
      
      await expect(withTimeout(mockFn, 100)).rejects.toThrow('Operation timed out');
    });

    it('should use custom timeout error message', async () => {
      const mockFn = jest.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve('success'), 2000))
      );
      
      await expect(
        withTimeout(mockFn, 100, 'Custom timeout message')
      ).rejects.toThrow('Custom timeout message');
    });
  });

  /**
   * Feature: network-domain-analyzer, Property 26: API Timeout Configuration
   * Validates: Requirements 15.4
   * 
   * For any external API call, the system should enforce a timeout of maximum 30 seconds.
   */
  describe('Property 26: API Timeout Configuration', () => {
    it('should enforce that all configured timeouts are at most 30 seconds', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...Object.keys(TIMEOUTS)),
          (timeoutKey) => {
            const timeoutValue = TIMEOUTS[timeoutKey as keyof typeof TIMEOUTS];
            
            // Property: All timeouts must be <= 30000ms (30 seconds)
            expect(timeoutValue).toBeLessThanOrEqual(30000);
            expect(timeoutValue).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should enforce timeout for any async operation', async () => {
      fc.assert(
        await fc.asyncProperty(
          fc.integer({ min: 100, max: 5000 }), // operation duration
          fc.integer({ min: 50, max: 30000 }), // timeout value
          async (operationDuration, timeoutValue) => {
            const operation = () =>
              new Promise<string>((resolve) =>
                setTimeout(() => resolve('completed'), operationDuration)
              );

            try {
              const result = await withTimeout(operation, timeoutValue);
              
              // If we got a result, operation must have completed within timeout
              expect(operationDuration).toBeLessThanOrEqual(timeoutValue);
              expect(result).toBe('completed');
            } catch (error: any) {
              // If we got a timeout error, operation must have exceeded timeout
              expect(error.message).toContain('timed out');
              expect(operationDuration).toBeGreaterThan(timeoutValue);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should enforce that EXTERNAL_API timeout is exactly 30 seconds', () => {
      // This is the maximum timeout for any external call
      expect(TIMEOUTS.EXTERNAL_API).toBe(30000);
    });

    it('should have all operation-specific timeouts less than or equal to EXTERNAL_API timeout', () => {
      const maxTimeout = TIMEOUTS.EXTERNAL_API;
      
      Object.entries(TIMEOUTS).forEach(([_key, value]) => {
        expect(value).toBeLessThanOrEqual(maxTimeout);
      });
    });
  });
});
