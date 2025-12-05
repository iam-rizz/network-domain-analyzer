/**
 * RDAP Routes
 * Handles RDAP domain lookup endpoints
 */

import { Router, Request, Response, NextFunction } from 'express';
import { RDAPService } from '../services/rdap.service';
import { HistoryService } from '../services/history.service';
import { AppError } from '../models/error.types';
import { sanitizeBody } from '../middleware/sanitization.middleware';
import { createRateLimiter } from '../middleware/rateLimiter.middleware';

const router = Router();
const rdapService = new RDAPService('./dns.json');
const historyService = new HistoryService();

// Initialize RDAP service on startup
rdapService.initialize().catch(error => {
  console.error('Failed to initialize RDAP service:', error);
});

// Rate limiter for RDAP endpoints
const rdapRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 50,
});

/**
 * POST /api/rdap/lookup
 * Lookup domain information using RDAP with fallback to WHOIS
 */
router.post(
  '/lookup',
  rdapRateLimiter.middleware(),
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

      // Perform RDAP lookup
      const result = await rdapService.lookupDomain(domain);

      // Save to history
      try {
        historyService.saveAnalysis({
          type: 'rdap',
          domain,
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

/**
 * GET /api/rdap/bootstrap
 * Get RDAP bootstrap information
 */
router.get(
  '/bootstrap',
  rdapRateLimiter.middleware(),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const info = rdapService.getBootstrapInfo();

      res.json({
        success: true,
        data: info,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
