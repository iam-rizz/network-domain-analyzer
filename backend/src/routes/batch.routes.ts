/**
 * Batch Routes
 * Handles batch analysis endpoints
 */

import { Router, Request, Response, NextFunction } from 'express';
import { BatchService } from '../services/batch.service';
import { AppError } from '../models/error.types';
import { sanitizeBody } from '../middleware/sanitization.middleware';
import { createRateLimiter } from '../middleware/rateLimiter.middleware';
import { requireAPIKey } from '../middleware/auth.middleware';

const router = Router();
const batchService = new BatchService();

// Rate limiter for batch endpoints (more restrictive)
const batchRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5,
});

/**
 * POST /api/batch/analyze
 * Analyze multiple domains in batch
 * Requires API key authentication
 */
router.post(
  '/analyze',
  requireAPIKey(),
  batchRateLimiter.middleware(),
  sanitizeBody(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { domains, analysisTypes } = req.body;

      // Validate required fields
      if (!domains) {
        throw new AppError(
          'VALIDATION_ERROR',
          'domains is required',
          400,
          { field: 'domains' }
        );
      }

      // Parse domains input (supports string or array)
      let domainList: string[] = [];
      if (typeof domains === 'string') {
        domainList = batchService.parseDomainsInput(domains);
      } else if (Array.isArray(domains)) {
        domainList = domains;
      } else {
        throw new AppError(
          'VALIDATION_ERROR',
          'domains must be a string or array',
          400,
          { field: 'domains' }
        );
      }

      // Validate analysis types if provided
      if (analysisTypes) {
        if (!Array.isArray(analysisTypes)) {
          throw new AppError(
            'VALIDATION_ERROR',
            'analysisTypes must be an array',
            400,
            { field: 'analysisTypes' }
          );
        }

        const validTypes = ['dns', 'whois', 'rdap', 'host', 'all'];
        for (const type of analysisTypes) {
          if (!validTypes.includes(type)) {
            throw new AppError(
              'VALIDATION_ERROR',
              `Invalid analysis type: ${type}. Valid types are: ${validTypes.join(', ')}`,
              400,
              { field: 'analysisTypes', invalidType: type }
            );
          }
        }
      }

      // Process batch
      const results = await batchService.processBatch(domainList, {
        analysisTypes: analysisTypes || ['dns'],
      });

      // Format summary
      const summary = batchService.formatSummary(results);

      res.json({
        success: true,
        data: {
          summary,
          results,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
