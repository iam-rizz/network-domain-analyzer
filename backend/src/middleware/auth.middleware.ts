/**
 * Authentication Middleware
 * Handles API key authentication for protected endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { securityService } from '../services/security.service';

// In a real application, this would be stored in a database
// For now, we'll use an in-memory store
const API_KEY_STORE = new Map<string, string>();

/**
 * Store an API key hash
 * @param apiKey - Plain text API key
 */
export async function storeAPIKey(apiKey: string): Promise<void> {
  const hash = await securityService.hashAPIKey(apiKey);
  API_KEY_STORE.set(apiKey, hash);
}

/**
 * Middleware to require API key authentication
 */
export function requireAPIKey() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Extract API key from header
      const apiKey = req.headers['x-api-key'] as string;

      if (!apiKey) {
        res.status(401).json({
          error: {
            code: 'MISSING_API_KEY',
            message: 'API key is required for this endpoint',
          },
        });
        return;
      }

      // Check format first
      if (!securityService.isValidAPIKeyFormat(apiKey)) {
        res.status(401).json({
          error: {
            code: 'INVALID_API_KEY',
            message: 'Invalid API key format',
          },
        });
        return;
      }

      // Validate against stored hashes
      let isValid = false;
      
      // In a real application, you would look up the hash from database
      // For now, we check against all stored hashes
      for (const [, hash] of API_KEY_STORE.entries()) {
        if (await securityService.validateAPIKey(apiKey, hash)) {
          isValid = true;
          break;
        }
      }

      // Also check if the key matches directly (for testing)
      if (!isValid && API_KEY_STORE.has(apiKey)) {
        const hash = API_KEY_STORE.get(apiKey)!;
        isValid = await securityService.validateAPIKey(apiKey, hash);
      }

      if (!isValid) {
        res.status(401).json({
          error: {
            code: 'INVALID_API_KEY',
            message: 'Invalid or expired API key',
          },
        });
        return;
      }

      // API key is valid, proceed
      next();
    } catch (error) {
      console.error('API key validation error:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred during authentication',
        },
      });
    }
  };
}

/**
 * Optional API key authentication
 * Allows request to proceed even without API key, but validates if present
 */
export function optionalAPIKey() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const apiKey = req.headers['x-api-key'] as string;

      if (!apiKey) {
        // No API key provided, proceed without authentication
        return next();
      }

      // API key provided, validate it
      if (!securityService.isValidAPIKeyFormat(apiKey)) {
        return res.status(401).json({
          error: {
            code: 'INVALID_API_KEY',
            message: 'Invalid API key format',
          },
        });
      }

      let isValid = false;
      for (const [, hash] of API_KEY_STORE.entries()) {
        if (await securityService.validateAPIKey(apiKey, hash)) {
          isValid = true;
          break;
        }
      }

      if (!isValid && API_KEY_STORE.has(apiKey)) {
        const hash = API_KEY_STORE.get(apiKey)!;
        isValid = await securityService.validateAPIKey(apiKey, hash);
      }

      if (!isValid) {
        return res.status(401).json({
          error: {
            code: 'INVALID_API_KEY',
            message: 'Invalid or expired API key',
          },
        });
      }

      next();
    } catch (error) {
      console.error('API key validation error:', error);
      next();
    }
  };
}
