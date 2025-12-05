/**
 * Error Handler Middleware
 * Centralized error handling for Express application
 */

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../models/error.types';
import logger from '../utils/logger';

/**
 * Error handler middleware
 * Catches all errors and formats them for client response
 * Ensures sensitive information is not exposed
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log the error with full details
  if (err instanceof AppError) {
    logger.error('Application error', {
      code: err.code,
      message: err.message,
      statusCode: err.statusCode,
      path: req.path,
      method: req.method,
      ip: req.ip,
      // Don't log sensitive details
      details: sanitizeDetails(err.details),
      stack: err.stack,
    });

    // Send sanitized error response to client
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        // Only include details in development
        ...(process.env.NODE_ENV === 'development' && err.details
          ? { details: sanitizeDetails(err.details) }
          : {}),
      },
    });
  } else {
    // Unexpected errors - log with full details but send generic message
    logger.error('Unexpected error', {
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      ip: req.ip,
    });

    // Don't expose internal error details to client
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred. Please try again later.',
      },
    });
  }
}

/**
 * Sanitize error details to remove sensitive information
 * @param details - Error details object
 * @returns Sanitized details
 */
function sanitizeDetails(details: any): any {
  if (!details || typeof details !== 'object') {
    return details;
  }

  const sanitized = { ...details };
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

  // Remove sensitive fields
  for (const field of sensitiveFields) {
    if (field in sanitized) {
      delete sanitized[field];
    }
  }

  // Remove stack traces from nested errors
  if (sanitized.originalError && typeof sanitized.originalError === 'object') {
    delete sanitized.originalError.stack;
  }

  // Recursively sanitize nested objects
  for (const key in sanitized) {
    if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeDetails(sanitized[key]);
    }
  }

  return sanitized;
}

/**
 * Not found handler middleware
 * Handles 404 errors for undefined routes
 */
export function notFoundHandler(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const error = new AppError(
    'NOT_FOUND',
    `Route not found: ${req.method} ${req.path}`,
    404,
    { path: req.path, method: req.method }
  );
  next(error);
}

/**
 * Async handler wrapper
 * Wraps async route handlers to catch errors and pass to error middleware
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, _res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, _res, next)).catch(next);
  };
}
