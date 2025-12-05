/**
 * Request Size Limit Middleware
 * Enforces maximum request body size limit
 */

import { Request, Response, NextFunction } from 'express';

interface RequestSizeLimitConfig {
  maxSize: number; // in bytes
}

/**
 * Create middleware to limit request body size
 * @param config - Configuration with maxSize in bytes
 */
export function requestSizeLimit(config: RequestSizeLimitConfig) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = req.headers['content-length'];

    if (contentLength) {
      const size = parseInt(contentLength, 10);

      if (size > config.maxSize) {
        res.status(413).json({
          error: {
            code: 'REQUEST_TOO_LARGE',
            message: `Request body size exceeds maximum allowed size of ${config.maxSize} bytes`,
            maxSize: config.maxSize,
            receivedSize: size,
          },
        });
        return;
      }
    }

    // Track actual body size as it's received
    let receivedSize = 0;

    req.on('data', (chunk: Buffer) => {
      receivedSize += chunk.length;

      if (receivedSize > config.maxSize) {
        req.pause();
        res.status(413).json({
          error: {
            code: 'REQUEST_TOO_LARGE',
            message: `Request body size exceeds maximum allowed size of ${config.maxSize} bytes`,
            maxSize: config.maxSize,
          },
        });
        req.destroy();
      }
    });

    next();
  };
}

/**
 * Create middleware with 1MB default limit
 */
export function defaultRequestSizeLimit() {
  return requestSizeLimit({ maxSize: 1024 * 1024 }); // 1MB
}
