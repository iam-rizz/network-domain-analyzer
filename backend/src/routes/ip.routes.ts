/**
 * IP Routes
 * Handles IP address detection and geolocation lookup endpoints
 */

import { Router, Request, Response, NextFunction } from 'express';
import { IPService } from '../services/ip.service';
import { HistoryService } from '../services/history.service';
import { AppError } from '../models/error.types';
import { sanitizeBody } from '../middleware/sanitization.middleware';
import { createRateLimiter } from '../middleware/rateLimiter.middleware';

const router = Router();
const ipService = new IPService();
const historyService = new HistoryService();

// Rate limiter for IP endpoints
const ipRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100,
});

/**
 * GET /api/ip/current
 * Get current IP address of the requester
 * Automatically fetches public IP when running locally (localhost/private IP)
 */
router.get(
  '/current',
  ipRateLimiter.middleware(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get current IP from request, with public IP fallback for localhost
      const currentIP = await ipService.getCurrentIPWithPublicFallback(req);

      // Lookup IP information
      const result = await ipService.lookupIP(currentIP);

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
 * GET /api/ip/dual
 * Get both IPv4 and IPv6 addresses of the requester with geolocation info
 */
router.get(
  '/dual',
  ipRateLimiter.middleware(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get both IPv4 and IPv6 addresses
      const result = await ipService.getDualIP(req);

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
 * POST /api/ip/lookup
 * Lookup IP address information
 */
router.post(
  '/lookup',
  ipRateLimiter.middleware(),
  sanitizeBody(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { ip } = req.body;

      // Validate required fields
      if (!ip) {
        throw new AppError(
          'VALIDATION_ERROR',
          'IP address is required',
          400,
          { field: 'ip' }
        );
      }

      // Perform IP lookup
      const result = await ipService.lookupIP(ip);

      // Save to history
      try {
        historyService.saveAnalysis({
          type: 'ip_lookup',
          ip,
          result,
          status: 'success',
        });
      } catch {
        // Don't fail the request if history save fails
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
