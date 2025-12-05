/**
 * Retry utility with exponential backoff
 * Provides retry logic for external API calls
 */

import logger from './logger';

export interface RetryOptions {
  maxRetries: number;
  initialDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffMultiplier: number;
  retryableErrors?: string[]; // Error codes that should trigger retry
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2,
  retryableErrors: ['ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED', 'EHOSTUNREACH'],
};

/**
 * Execute a function with retry logic and exponential backoff
 * @param fn - Async function to execute
 * @param options - Retry configuration options
 * @returns Result of the function execution
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | undefined;
  let delay = config.initialDelay;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Check if error is retryable
      const isRetryable = config.retryableErrors?.includes(error.code) || 
                          error.code === 'ETIMEOUT' ||
                          error.statusCode >= 500;

      // Don't retry if not retryable or max retries reached
      if (!isRetryable || attempt === config.maxRetries) {
        logger.warn('Retry failed or not retryable', {
          attempt: attempt + 1,
          maxRetries: config.maxRetries,
          errorCode: error.code,
          errorMessage: error.message,
          isRetryable,
        });
        throw error;
      }

      // Log retry attempt
      logger.info('Retrying operation', {
        attempt: attempt + 1,
        maxRetries: config.maxRetries,
        delay,
        errorCode: error.code,
        errorMessage: error.message,
      });

      // Wait before retrying
      await sleep(delay);

      // Calculate next delay with exponential backoff
      delay = Math.min(delay * config.backoffMultiplier, config.maxDelay);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError || new Error('Retry failed');
}

/**
 * Sleep for specified milliseconds
 * @param ms - Milliseconds to sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a function with timeout
 * @param fn - Async function to execute
 * @param timeoutMs - Timeout in milliseconds
 * @param timeoutError - Optional custom error message
 * @returns Result of the function execution
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  timeoutError?: string
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(timeoutError || `Operation timed out after ${timeoutMs}ms`)),
        timeoutMs
      )
    ),
  ]);
}

/**
 * Predefined timeout configurations for different operations
 */
export const TIMEOUTS = {
  DNS_LOOKUP: 5000,        // 5 seconds
  WHOIS_QUERY: 10000,      // 10 seconds
  RDAP_QUERY: 10000,       // 10 seconds
  HTTP_CHECK: 10000,       // 10 seconds
  PING_TEST: 5000,         // 5 seconds
  PORT_SCAN: 30000,        // 30 seconds per port
  SSL_CHECK: 10000,        // 10 seconds
  IP_LOOKUP: 5000,         // 5 seconds
  EXTERNAL_API: 30000,     // 30 seconds (max for any external call)
};
