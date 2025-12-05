/**
 * WHOIS Routes
 * Handles WHOIS domain lookup endpoints
 */

import { Router, Request, Response, NextFunction } from 'express';
import { WHOISService } from '../services/whois.service';
import { AppError } from '../models/error.types';
import { sanitizeBody } from '../middleware/sanitization.middleware';
import { createRateLimiter } from '../middleware/rateLimiter.middleware';

const router = Router();
const whoisService = new WHOISService();

// Rate limiter for WHOIS endpoints
const whoisRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 30,
});

/**
 * POST /api/whois/lookup
 * Lookup WHOIS information for a domain
 */
router.post(
  '/lookup',
  whoisRateLimiter.middleware(),
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

      // Perform WHOIS lookup
      const result = await whoisService.lookup(domain);

      // Add renewal reminder flag if needed
      const needsRenewal = whoisService.needsRenewalReminder(result.expirationDate);
      const daysUntilExpiry = whoisService.getDaysUntilExpiry(result.expirationDate);

      res.json({
        success: true,
        data: {
          ...result,
          needsRenewal,
          daysUntilExpiry,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
