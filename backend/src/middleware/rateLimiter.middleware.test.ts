/**
 * Property-Based Tests for Rate Limiter Middleware
 */

import * as fc from 'fast-check';
import { RateLimiter } from './rateLimiter.middleware';
import { Request, Response } from 'express';

// Mock Express Request and Response
function createMockRequest(ip: string): Partial<Request> {
  return {
    ip,
    socket: {
      remoteAddress: ip,
    } as any,
    headers: {},
  };
}

function createMockResponse(): Partial<Response> {
  const headers: Record<string, string> = {};
  const response: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    setHeader: jest.fn((key: string, value: string) => {
      headers[key] = value;
    }),
    getHeader: jest.fn((key: string) => headers[key]),
    headers,
  };
  return response;
}

describe('RateLimiter Middleware - Property Tests', () => {
  /**
   * Feature: network-domain-analyzer, Property 32: Rate Limit Enforcement
   * Validates: Requirements 14.2
   * 
   * For any IP address that exceeds the configured rate limit,
   * the system should reject subsequent requests with HTTP 429 status code.
   */
  describe('Property 32: Rate Limit Enforcement', () => {
    it('should reject requests exceeding rate limit with 429 status', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10 }), // maxRequests
          fc.integer({ min: 100, max: 1000 }), // windowMs
          fc.ipV4(), // IP address
          async (maxRequests, windowMs, ip) => {
            // Create rate limiter with specific config
            const rateLimiter = new RateLimiter({
              windowMs,
              maxRequests,
            });

            const middleware = rateLimiter.middleware();
            let rejectedCount = 0;
            let acceptedCount = 0;

            // Make requests up to and beyond the limit
            const totalRequests = maxRequests + 5;

            for (let i = 0; i < totalRequests; i++) {
              const req = createMockRequest(ip) as Request;
              const res = createMockResponse() as Response;
              let nextCalled = false;

              await new Promise<void>((resolve) => {
                middleware(req, res, () => {
                  nextCalled = true;
                  resolve();
                });

                // If next wasn't called, response was sent
                setTimeout(() => {
                  if (!nextCalled) {
                    resolve();
                  }
                }, 10);
              });

              if (nextCalled) {
                acceptedCount++;
              } else {
                rejectedCount++;
                // Verify 429 status was set
                expect(res.status).toHaveBeenCalledWith(429);
              }
            }

            // Verify that exactly maxRequests were accepted
            expect(acceptedCount).toBe(maxRequests);
            // Verify that excess requests were rejected
            expect(rejectedCount).toBe(totalRequests - maxRequests);

            // Cleanup
            await rateLimiter.disconnect();
          }
        ),
        { numRuns: 20, timeout: 10000 }
      );
    }, 30000);

    it('should allow requests within rate limit', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 5, max: 20 }), // maxRequests
          fc.integer({ min: 1000, max: 5000 }), // windowMs
          fc.ipV4(), // IP address
          fc.integer({ min: 1, max: 5 }), // requests to make (within limit)
          async (maxRequests, windowMs, ip, requestCount) => {
            fc.pre(requestCount <= maxRequests);

            const rateLimiter = new RateLimiter({
              windowMs,
              maxRequests,
            });

            const middleware = rateLimiter.middleware();
            let allAccepted = true;

            for (let i = 0; i < requestCount; i++) {
              const req = createMockRequest(ip) as Request;
              const res = createMockResponse() as Response;
              let nextCalled = false;

              await new Promise<void>((resolve) => {
                middleware(req, res, () => {
                  nextCalled = true;
                  resolve();
                });

                setTimeout(() => {
                  if (!nextCalled) {
                    resolve();
                  }
                }, 10);
              });

              if (!nextCalled) {
                allAccepted = false;
              }
            }

            // All requests within limit should be accepted
            expect(allAccepted).toBe(true);

            // Cleanup
            await rateLimiter.disconnect();
          }
        ),
        { numRuns: 20, timeout: 10000 }
      );
    }, 30000);

    it('should track rate limits independently per IP', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 5 }), // maxRequests
          fc.integer({ min: 1000, max: 5000 }), // windowMs
          fc.array(fc.ipV4(), { minLength: 2, maxLength: 5 }), // multiple IPs
          async (maxRequests, windowMs, ips) => {
            // Ensure unique IPs
            const uniqueIps = Array.from(new Set(ips));
            fc.pre(uniqueIps.length >= 2);

            const rateLimiter = new RateLimiter({
              windowMs,
              maxRequests,
            });

            const middleware = rateLimiter.middleware();

            // Each IP should be able to make maxRequests
            for (const ip of uniqueIps) {
              let acceptedCount = 0;

              for (let i = 0; i < maxRequests; i++) {
                const req = createMockRequest(ip) as Request;
                const res = createMockResponse() as Response;
                let nextCalled = false;

                await new Promise<void>((resolve) => {
                  middleware(req, res, () => {
                    nextCalled = true;
                    resolve();
                  });

                  setTimeout(() => {
                    if (!nextCalled) {
                      resolve();
                    }
                  }, 10);
                });

                if (nextCalled) {
                  acceptedCount++;
                }
              }

              // Each IP should have its own limit
              expect(acceptedCount).toBe(maxRequests);
            }

            // Cleanup
            await rateLimiter.disconnect();
          }
        ),
        { numRuns: 10, timeout: 10000 }
      );
    }, 30000);
  });
});
