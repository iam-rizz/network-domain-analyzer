/**
 * Host Routes
 * Handles host monitoring endpoints (ping, HTTP check, port scan, SSL check)
 */

import { Router, Request, Response, NextFunction } from 'express';
import { HostService } from '../services/host.service';
import { AppError } from '../models/error.types';
import { sanitizeBody } from '../middleware/sanitization.middleware';
import { createRateLimiter } from '../middleware/rateLimiter.middleware';

const router = Router();
const hostService = new HostService();

// Rate limiter for host endpoints
const hostRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 50,
});

/**
 * POST /api/host/ping
 * Ping a host from multiple locations
 */
router.post(
  '/ping',
  hostRateLimiter.middleware(),
  sanitizeBody(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { host, locations } = req.body;

      // Validate required fields
      if (!host) {
        throw new AppError(
          'VALIDATION_ERROR',
          'Host is required',
          400,
          { field: 'host' }
        );
      }

      // Validate locations if provided
      if (locations && !Array.isArray(locations)) {
        throw new AppError(
          'VALIDATION_ERROR',
          'locations must be an array',
          400,
          { field: 'locations' }
        );
      }

      // Perform ping
      const result = await hostService.ping(host, locations);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/host/http-check
 * Check HTTP/HTTPS endpoint
 */
router.post(
  '/http-check',
  hostRateLimiter.middleware(),
  sanitizeBody(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { url } = req.body;

      // Validate required fields
      if (!url) {
        throw new AppError(
          'VALIDATION_ERROR',
          'URL is required',
          400,
          { field: 'url' }
        );
      }

      // Perform HTTP check
      const result = await hostService.checkHTTP(url);

      // Add slow response indicator
      const isSlow = hostService.isSlowResponse(result.responseTime);

      res.json({
        success: true,
        data: {
          ...result,
          isSlow,
          slowResponseThreshold: hostService.getSlowResponseThreshold(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/host/port-scan
 * Scan ports on a host
 */
router.post(
  '/port-scan',
  hostRateLimiter.middleware(),
  sanitizeBody(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { host, ports } = req.body;

      // Validate required fields
      if (!host) {
        throw new AppError(
          'VALIDATION_ERROR',
          'Host is required',
          400,
          { field: 'host' }
        );
      }

      // Validate ports if provided
      if (ports) {
        if (!Array.isArray(ports)) {
          throw new AppError(
            'VALIDATION_ERROR',
            'ports must be an array',
            400,
            { field: 'ports' }
          );
        }

        // Validate each port number
        for (const port of ports) {
          if (typeof port !== 'number' || port < 1 || port > 65535) {
            throw new AppError(
              'VALIDATION_ERROR',
              `Invalid port number: ${port}. Port must be between 1 and 65535`,
              400,
              { field: 'ports', invalidPort: port }
            );
          }
        }
      }

      // Perform port scan
      const result = await hostService.scanPorts(host, ports);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/host/ssl-check
 * Check SSL certificate for a domain
 */
router.post(
  '/ssl-check',
  hostRateLimiter.middleware(),
  sanitizeBody(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { domain } = req.body;

      // Validate required fields
      if (!domain) {
        throw new AppError(
          'VALIDATION_ERROR',
          'Domain is required',
          400,
          { field: 'domain' }
        );
      }

      // Perform SSL check
      const result = await hostService.checkSSL(domain);

      // Add expiration warnings
      const isExpiringSoon = hostService.isExpiringWithin30Days(result.daysUntilExpiry);
      const isExpired = hostService.isCertificateExpired(result.daysUntilExpiry);

      res.json({
        success: true,
        data: {
          ...result,
          isExpiringSoon,
          isExpired,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
