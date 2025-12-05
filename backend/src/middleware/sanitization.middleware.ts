/**
 * Input Sanitization Middleware
 * Sanitizes and validates request inputs to prevent malicious attacks
 */

import { Request, Response, NextFunction } from 'express';
import { securityService } from '../services/security.service';

/**
 * Recursively sanitize object properties
 */
function sanitizeObject(obj: any): any {
  if (typeof obj === 'string') {
    return securityService.sanitizeInput(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  if (obj !== null && typeof obj === 'object') {
    const sanitized: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }

  return obj;
}

/**
 * Middleware to sanitize request body
 */
export function sanitizeBody() {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }
    next();
  };
}

/**
 * Middleware to sanitize query parameters
 */
export function sanitizeQuery() {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query);
    }
    next();
  };
}

/**
 * Middleware to sanitize all inputs (body, query, params)
 */
export function sanitizeAll() {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }

    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query);
    }

    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeObject(req.params);
    }

    next();
  };
}

/**
 * Middleware to detect and reject malicious patterns
 */
export function detectMaliciousInput() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const checkForMalicious = (obj: any): string[] => {
      const patterns: string[] = [];

      if (typeof obj === 'string') {
        const detection = securityService.detectMaliciousPatterns(obj);
        if (detection.detected) {
          patterns.push(...detection.patterns);
        }
      } else if (Array.isArray(obj)) {
        for (const item of obj) {
          patterns.push(...checkForMalicious(item));
        }
      } else if (obj !== null && typeof obj === 'object') {
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            patterns.push(...checkForMalicious(obj[key]));
          }
        }
      }

      return patterns;
    };

    const maliciousPatterns: string[] = [];

    if (req.body) {
      maliciousPatterns.push(...checkForMalicious(req.body));
    }

    if (req.query) {
      maliciousPatterns.push(...checkForMalicious(req.query));
    }

    if (req.params) {
      maliciousPatterns.push(...checkForMalicious(req.params));
    }

    if (maliciousPatterns.length > 0) {
      console.warn('Malicious patterns detected:', maliciousPatterns);
      res.status(400).json({
        error: {
          code: 'MALICIOUS_INPUT_DETECTED',
          message: 'Request contains potentially malicious content',
        },
      });
      return;
    }

    next();
  };
}
