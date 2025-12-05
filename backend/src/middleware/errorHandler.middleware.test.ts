/**
 * Tests for error handler middleware
 */

import * as fc from 'fast-check';
import { Request, Response, NextFunction } from 'express';
import { errorHandler, notFoundHandler, asyncHandler } from './errorHandler.middleware';
import { AppError } from '../models/error.types';

describe('Error Handler Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    
    mockRequest = {
      path: '/test',
      method: 'GET',
      ip: '127.0.0.1',
    };
    
    mockResponse = {
      status: statusMock,
      json: jsonMock,
    };
    
    mockNext = jest.fn();
  });

  describe('errorHandler', () => {
    it('should handle AppError correctly', () => {
      const error = new AppError('VALIDATION_ERROR', 'Invalid input', 400, { field: 'domain' });
      
      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
        },
      });
    });

    it('should handle unexpected errors with generic message', () => {
      const error = new Error('Database connection failed');
      
      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred. Please try again later.',
        },
      });
    });

    it('should not expose sensitive details in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const error = new AppError('VALIDATION_ERROR', 'Invalid input', 400, {
        password: 'secret123',
        apiKey: 'key123',
      });
      
      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(jsonMock).toHaveBeenCalledWith({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
        },
      });
      
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('notFoundHandler', () => {
    it('should create 404 error for undefined routes', () => {
      notFoundHandler(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'NOT_FOUND',
          statusCode: 404,
        })
      );
    });
  });

  describe('asyncHandler', () => {
    it('should handle successful async operations', async () => {
      const asyncFn = jest.fn().mockResolvedValue('success');
      const handler = asyncHandler(asyncFn);
      
      await handler(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(asyncFn).toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should catch async errors and pass to next', async () => {
      const error = new Error('Async error');
      const asyncFn = jest.fn().mockRejectedValue(error);
      const handler = asyncHandler(asyncFn);
      
      await handler(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  /**
   * Feature: network-domain-analyzer, Property 27: Error Information Hiding
   * Validates: Requirements 15.5
   * 
   * For any error that occurs, the system should log detailed error information internally
   * while displaying only user-friendly messages without sensitive data to the user.
   */
  describe('Property 27: Error Information Hiding', () => {
    it('should never expose sensitive fields in error responses', () => {
      const sensitiveFields = [
        'password',
        'apiKey',
        'token',
        'authorization',
        'cookie',
        'secret',
        'key',
        'credentials',
        'auth',
      ];

      fc.assert(
        fc.property(
          fc.constantFrom(...sensitiveFields),
          fc.string({ minLength: 5, maxLength: 50 }),
          fc.string({ minLength: 10, maxLength: 100 }),
          (sensitiveField, sensitiveValue, errorMessage) => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';

            const details: any = {};
            details[sensitiveField] = sensitiveValue;
            details.publicField = 'public data';

            const error = new AppError('VALIDATION_ERROR', errorMessage, 400, details);

            const jsonMock = jest.fn();
            const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
            const mockRes = { status: statusMock, json: jsonMock } as any;
            const mockReq = { path: '/test', method: 'GET', ip: '127.0.0.1' } as any;

            errorHandler(error, mockReq, mockRes, jest.fn());

            const response = jsonMock.mock.calls[0][0];

            // Property: Response should not contain sensitive field
            expect(JSON.stringify(response)).not.toContain(sensitiveValue);
            
            // In production, details should not be included at all
            expect(response.error.details).toBeUndefined();

            process.env.NODE_ENV = originalEnv;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should always return user-friendly messages for unexpected errors', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 10, maxLength: 200 }),
          (internalErrorMessage) => {
            const error = new Error(internalErrorMessage);

            const jsonMock = jest.fn();
            const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
            const mockRes = { status: statusMock, json: jsonMock } as any;
            const mockReq = { path: '/test', method: 'GET', ip: '127.0.0.1' } as any;

            errorHandler(error, mockReq, mockRes, jest.fn());

            const response = jsonMock.mock.calls[0][0];

            // Property: Internal error message should not be exposed
            expect(response.error.message).not.toBe(internalErrorMessage);
            expect(response.error.message).toBe(
              'An unexpected error occurred. Please try again later.'
            );
            expect(response.error.code).toBe('INTERNAL_ERROR');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should sanitize nested error details', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 5, maxLength: 50 }),
          fc.string({ minLength: 5, maxLength: 50 }),
          (password, apiKey) => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'development'; // Even in dev, sensitive fields should be removed

            const error = new AppError('VALIDATION_ERROR', 'Error', 400, {
              user: {
                password,
                email: 'test@example.com',
              },
              auth: {
                apiKey,
                token: 'secret-token',
              },
            });

            const jsonMock = jest.fn();
            const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
            const mockRes = { status: statusMock, json: jsonMock } as any;
            const mockReq = { path: '/test', method: 'GET', ip: '127.0.0.1' } as any;

            errorHandler(error, mockReq, mockRes, jest.fn());

            const response = jsonMock.mock.calls[0][0];
            const responseStr = JSON.stringify(response);

            // Property: Nested sensitive data should not appear in response
            expect(responseStr).not.toContain(password);
            expect(responseStr).not.toContain(apiKey);
            expect(responseStr).not.toContain('secret-token');

            process.env.NODE_ENV = originalEnv;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should always return proper HTTP status codes', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'VALIDATION_ERROR',
            'INVALID_DOMAIN',
            'DNS_LOOKUP_FAILED',
            'RATE_LIMIT_EXCEEDED',
            'UNAUTHORIZED',
            'NOT_FOUND',
            'INTERNAL_ERROR'
          ),
          fc.string({ minLength: 10, maxLength: 100 }),
          (errorCode, errorMessage) => {
            const statusCodeMap: Record<string, number> = {
              VALIDATION_ERROR: 400,
              INVALID_DOMAIN: 400,
              DNS_LOOKUP_FAILED: 500,
              RATE_LIMIT_EXCEEDED: 429,
              UNAUTHORIZED: 401,
              NOT_FOUND: 404,
              INTERNAL_ERROR: 500,
            };

            const expectedStatus = statusCodeMap[errorCode];
            const error = new AppError(errorCode as any, errorMessage, expectedStatus);

            const jsonMock = jest.fn();
            const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
            const mockRes = { status: statusMock, json: jsonMock } as any;
            const mockReq = { path: '/test', method: 'GET', ip: '127.0.0.1' } as any;

            errorHandler(error, mockReq, mockRes, jest.fn());

            // Property: Status code should match error type
            expect(statusMock).toHaveBeenCalledWith(expectedStatus);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not expose stack traces in production', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 10, maxLength: 100 }),
          (errorMessage) => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';

            const error = new AppError('INTERNAL_ERROR', errorMessage, 500, {
              originalError: new Error('Internal stack trace'),
            });

            const jsonMock = jest.fn();
            const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
            const mockRes = { status: statusMock, json: jsonMock } as any;
            const mockReq = { path: '/test', method: 'GET', ip: '127.0.0.1' } as any;

            errorHandler(error, mockReq, mockRes, jest.fn());

            const response = jsonMock.mock.calls[0][0];
            const responseStr = JSON.stringify(response);

            // Property: Stack traces should not be in response
            expect(responseStr).not.toContain('at ');
            expect(responseStr).not.toContain('.js:');
            expect(responseStr).not.toContain('stack');

            process.env.NODE_ENV = originalEnv;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
