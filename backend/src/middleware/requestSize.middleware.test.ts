/**
 * Property-Based Tests for Request Size Limit Middleware
 */

import * as fc from 'fast-check';
import { requestSizeLimit, defaultRequestSizeLimit } from './requestSize.middleware';
import { Request, Response } from 'express';

// Mock Express Request and Response
function createMockRequest(contentLength?: number, bodySize?: number): Partial<Request> {
  const req: any = {
    headers: contentLength ? { 'content-length': contentLength.toString() } : {},
    on: jest.fn(),
    pause: jest.fn(),
    destroy: jest.fn(),
  };

  // Simulate data events if bodySize is provided
  if (bodySize !== undefined) {
    setTimeout(() => {
      const chunkSize = 1024; // 1KB chunks
      let sent = 0;
      while (sent < bodySize) {
        const size = Math.min(chunkSize, bodySize - sent);
        const chunk = Buffer.alloc(size);
        const dataCallback = req.on.mock.calls.find((call: any[]) => call[0] === 'data');
        if (dataCallback) {
          dataCallback[1](chunk);
        }
        sent += size;
      }
    }, 10);
  }

  return req;
}

function createMockResponse(): Partial<Response> {
  const response: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return response;
}

describe('Request Size Limit Middleware - Property Tests', () => {
  /**
   * Feature: network-domain-analyzer, Property 35: Request Size Limit
   * Validates: Requirements 14.7
   * 
   * For any request with body size exceeding 1MB,
   * the system should reject with HTTP 413 status code.
   */
  describe('Property 35: Request Size Limit', () => {
    it('should reject requests exceeding the configured size limit', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1024, max: 10240 }), // maxSize (1KB to 10KB for testing)
          fc.integer({ min: 1, max: 100 }), // excess amount in KB
          (maxSize, excess) => {
            const requestSize = maxSize + (excess * 1024);
            const middleware = requestSizeLimit({ maxSize });

            const req = createMockRequest(requestSize) as Request;
            const res = createMockResponse() as Response;
            let nextCalled = false;

            middleware(req, res, () => {
              nextCalled = true;
            });

            // Should reject the request
            expect(nextCalled).toBe(false);
            expect(res.status).toHaveBeenCalledWith(413);
            expect(res.json).toHaveBeenCalledWith(
              expect.objectContaining({
                error: expect.objectContaining({
                  code: 'REQUEST_TOO_LARGE',
                }),
              })
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow requests within the size limit', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1024, max: 10240 }), // maxSize
          fc.integer({ min: 0, max: 1023 }), // size within limit
          (maxSize, size) => {
            const requestSize = size;
            fc.pre(requestSize <= maxSize);

            const middleware = requestSizeLimit({ maxSize });

            const req = createMockRequest(requestSize) as Request;
            const res = createMockResponse() as Response;
            let nextCalled = false;

            middleware(req, res, () => {
              nextCalled = true;
            });

            // Should allow the request
            expect(nextCalled).toBe(true);
            expect(res.status).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle requests at exactly the size limit', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1024, max: 10240 }), // maxSize
          (maxSize) => {
            const middleware = requestSizeLimit({ maxSize });

            const req = createMockRequest(maxSize) as Request;
            const res = createMockResponse() as Response;
            let nextCalled = false;

            middleware(req, res, () => {
              nextCalled = true;
            });

            // Should allow the request at exactly the limit
            expect(nextCalled).toBe(true);
            expect(res.status).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle requests without content-length header', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1024, max: 10240 }), // maxSize
          (maxSize) => {
            const middleware = requestSizeLimit({ maxSize });

            const req = createMockRequest() as Request; // No content-length
            const res = createMockResponse() as Response;
            let nextCalled = false;

            middleware(req, res, () => {
              nextCalled = true;
            });

            // Should allow the request to proceed (will be checked via data events)
            expect(nextCalled).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use 1MB default limit', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1024 * 1024 + 1, max: 1024 * 1024 + 10240 }), // Size > 1MB
          (requestSize) => {
            const middleware = defaultRequestSizeLimit();

            const req = createMockRequest(requestSize) as Request;
            const res = createMockResponse() as Response;
            let nextCalled = false;

            middleware(req, res, () => {
              nextCalled = true;
            });

            // Should reject requests over 1MB
            expect(nextCalled).toBe(false);
            expect(res.status).toHaveBeenCalledWith(413);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject requests with size exactly 1 byte over limit', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1024, max: 10240 }), // maxSize
          (maxSize) => {
            const middleware = requestSizeLimit({ maxSize });

            const req = createMockRequest(maxSize + 1) as Request;
            const res = createMockResponse() as Response;
            let nextCalled = false;

            middleware(req, res, () => {
              nextCalled = true;
            });

            // Should reject even 1 byte over
            expect(nextCalled).toBe(false);
            expect(res.status).toHaveBeenCalledWith(413);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
