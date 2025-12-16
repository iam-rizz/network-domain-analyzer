/**
 * Local IP/Hostname Blocking Middleware
 * Prevents SSRF attacks by blocking requests to local/internal addresses
 * Includes DNS resolution check to prevent DNS rebinding attacks
 * Also blocks requests targeting the server's own IP (self-targeting)
 */

import { Request, Response, NextFunction } from 'express';
import {
  isLocalTarget,
  isLocalURL,
  resolveAndCheckLocal,
  resolveURLAndCheckLocal,
} from '../utils/validation';

interface BlockLocalIPOptions {
  /** Fields to check in request body */
  bodyFields?: string[];
  /** Fields to check in query params */
  queryFields?: string[];
  /** Whether to check URL fields (extracts hostname from URL) */
  urlFields?: string[];
  /** Whether to resolve DNS and check resolved IPs (prevents DNS rebinding) */
  resolveDNS?: boolean;
  /** Whether to block requests targeting the server's own IP */
  blockSelfIP?: boolean;
}

/**
 * Middleware to block requests targeting local/internal IP addresses or hostnames
 * Synchronous version - only checks hostname/IP format, not DNS resolution
 * @param options - Configuration options
 */
export function blockLocalIP(options: BlockLocalIPOptions = {}) {
  const {
    bodyFields = ['host', 'ip', 'target', 'domain'],
    queryFields = [],
    urlFields = ['url'],
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: string[] = [];

    // Check body fields
    if (req.body && typeof req.body === 'object') {
      for (const field of bodyFields) {
        const value = req.body[field];
        if (value && typeof value === 'string') {
          const check = isLocalTarget(value);
          if (check.isLocal) {
            errors.push(`${field}: ${check.reason}`);
          }
        }
      }

      // Check URL fields (extract hostname from URL)
      for (const field of urlFields) {
        const value = req.body[field];
        if (value && typeof value === 'string') {
          const check = isLocalURL(value);
          if (check.isLocal) {
            errors.push(`${field}: ${check.reason}`);
          }
        }
      }
    }

    // Check query params
    if (req.query && typeof req.query === 'object') {
      for (const field of queryFields) {
        const value = req.query[field];
        if (value && typeof value === 'string') {
          const check = isLocalTarget(value);
          if (check.isLocal) {
            errors.push(`${field}: ${check.reason}`);
          }
        }
      }
    }

    if (errors.length > 0) {
      res.status(403).json({
        success: false,
        error: {
          code: 'LOCAL_TARGET_BLOCKED',
          message: 'Access to local/internal addresses is not allowed',
          details: errors,
        },
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to block requests with DNS resolution check
 * Resolves domain to IP and checks if resolved IP is local/internal or self
 * This prevents DNS rebinding attacks and self-targeting attacks
 * @param options - Configuration options
 */
export function blockLocalIPWithDNS(options: BlockLocalIPOptions = {}) {
  const {
    bodyFields = ['host', 'domain', 'target'],
    queryFields = [],
    urlFields = ['url'],
    blockSelfIP = true,
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const errors: string[] = [];
    let errorCode = 'LOCAL_TARGET_BLOCKED';
    let errorMessage = 'Access to local/internal addresses is not allowed';

    try {
      // Check body fields with DNS resolution
      if (req.body && typeof req.body === 'object') {
        for (const field of bodyFields) {
          const value = req.body[field];
          if (value && typeof value === 'string') {
            const check = await resolveAndCheckLocal(value, { blockSelfIP });
            if (check.isLocal) {
              errors.push(`${field}: ${check.reason}`);
            } else if (check.isSelf) {
              errors.push(`${field}: ${check.reason}`);
              errorCode = 'SELF_TARGET_BLOCKED';
              errorMessage = 'Targeting this server is not allowed';
            }
          }
        }

        // Check URL fields with DNS resolution
        for (const field of urlFields) {
          const value = req.body[field];
          if (value && typeof value === 'string') {
            const check = await resolveURLAndCheckLocal(value, { blockSelfIP });
            if (check.isLocal) {
              errors.push(`${field}: ${check.reason}`);
            } else if (check.isSelf) {
              errors.push(`${field}: ${check.reason}`);
              errorCode = 'SELF_TARGET_BLOCKED';
              errorMessage = 'Targeting this server is not allowed';
            }
          }
        }
      }

      // Check query params with DNS resolution
      if (req.query && typeof req.query === 'object') {
        for (const field of queryFields) {
          const value = req.query[field];
          if (value && typeof value === 'string') {
            const check = await resolveAndCheckLocal(value, { blockSelfIP });
            if (check.isLocal) {
              errors.push(`${field}: ${check.reason}`);
            } else if (check.isSelf) {
              errors.push(`${field}: ${check.reason}`);
              errorCode = 'SELF_TARGET_BLOCKED';
              errorMessage = 'Targeting this server is not allowed';
            }
          }
        }
      }

      if (errors.length > 0) {
        res.status(403).json({
          success: false,
          error: {
            code: errorCode,
            message: errorMessage,
            details: errors,
          },
        });
        return;
      }

      next();
    } catch (error) {
      // If DNS resolution fails, let the request through
      // The actual operation will fail with a proper error
      next();
    }
  };
}

/**
 * Pre-configured middleware for host-related endpoints (sync - no DNS check)
 */
export const blockLocalHost = blockLocalIP({
  bodyFields: ['host', 'domain', 'target'],
  urlFields: ['url'],
});

/**
 * Pre-configured middleware for host-related endpoints (async - with DNS check)
 * Use this to prevent DNS rebinding attacks
 */
export const blockLocalHostWithDNS = blockLocalIPWithDNS({
  bodyFields: ['host', 'domain', 'target'],
  urlFields: ['url'],
});

/**
 * Pre-configured middleware for IP lookup endpoints
 */
export const blockLocalIPLookup = blockLocalIP({
  bodyFields: ['ip'],
  urlFields: [],
});
