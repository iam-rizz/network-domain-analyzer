/**
 * History Routes
 * Handles analysis history endpoints
 */

import { Router, Request, Response, NextFunction } from 'express';
import { HistoryService } from '../services/history.service';
import { AppError } from '../models/error.types';
import { sanitizeBody, sanitizeQuery } from '../middleware/sanitization.middleware';
import { createRateLimiter } from '../middleware/rateLimiter.middleware';
import { requireAPIKey } from '../middleware/auth.middleware';

const router = Router();
const historyService = new HistoryService();

// Rate limiter for history endpoints
const historyRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100,
});

/**
 * GET /api/history
 * Get analysis history with pagination
 */
router.get(
  '/',
  historyRateLimiter.middleware(),
  sanitizeQuery(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Parse query parameters
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;

      // Validate parameters
      if (limit < 1 || limit > 100) {
        throw new AppError(
          'VALIDATION_ERROR',
          'limit must be between 1 and 100',
          400,
          { field: 'limit', value: limit }
        );
      }

      if (offset < 0) {
        throw new AppError(
          'VALIDATION_ERROR',
          'offset must be non-negative',
          400,
          { field: 'offset', value: offset }
        );
      }

      // Get history
      const history = historyService.getHistory(limit, offset);
      const totalCount = historyService.getCount();

      res.json({
        success: true,
        data: {
          history,
          pagination: {
            limit,
            offset,
            total: totalCount,
            hasMore: offset + history.length < totalCount,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/history/:id
 * Get a specific analysis by ID
 */
router.get(
  '/:id',
  historyRateLimiter.middleware(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      if (!id) {
        throw new AppError(
          'VALIDATION_ERROR',
          'Analysis ID is required',
          400,
          { field: 'id' }
        );
      }

      // Get analysis
      const analysis = historyService.getAnalysisById(id);

      if (!analysis) {
        throw new AppError(
          'NOT_FOUND',
          'Analysis not found',
          404,
          { id }
        );
      }

      res.json({
        success: true,
        data: analysis,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/history/:id
 * Delete a specific analysis by ID
 */
router.delete(
  '/:id',
  historyRateLimiter.middleware(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      if (!id) {
        throw new AppError(
          'VALIDATION_ERROR',
          'Analysis ID is required',
          400,
          { field: 'id' }
        );
      }

      // Delete analysis
      const deleted = historyService.deleteAnalysis(id);

      if (!deleted) {
        throw new AppError(
          'NOT_FOUND',
          'Analysis not found',
          404,
          { id }
        );
      }

      res.json({
        success: true,
        message: 'Analysis deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/history/export
 * Export analyses to JSON or CSV format
 * Requires API key authentication
 */
router.post(
  '/export',
  requireAPIKey(),
  historyRateLimiter.middleware(),
  sanitizeBody(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { ids, format } = req.body;

      // Validate required fields
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        throw new AppError(
          'VALIDATION_ERROR',
          'ids array is required and must not be empty',
          400,
          { field: 'ids' }
        );
      }

      if (!format) {
        throw new AppError(
          'VALIDATION_ERROR',
          'format is required',
          400,
          { field: 'format' }
        );
      }

      // Validate format
      if (format !== 'json' && format !== 'csv') {
        throw new AppError(
          'VALIDATION_ERROR',
          'format must be either "json" or "csv"',
          400,
          { field: 'format', value: format }
        );
      }

      // Export analyses
      const exportData = historyService.exportAnalyses(ids, format);

      // Generate filename
      const filename = historyService.generateExportFilename(format);

      // Set response headers for file download
      res.setHeader('Content-Type', format === 'json' ? 'application/json' : 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', exportData.length);

      res.send(exportData);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
