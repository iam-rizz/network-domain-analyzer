/**
 * DNS Routes
 * Handles DNS lookup and propagation check endpoints
 */

import { Router, Request, Response, NextFunction } from 'express';
import { DNSService } from '../services/dns.service';
import { HistoryService } from '../services/history.service';
import { DNSRecordType } from '../models/dns.types';
import { AppError } from '../models/error.types';
import { sanitizeBody } from '../middleware/sanitization.middleware';
import { createRateLimiter } from '../middleware/rateLimiter.middleware';

const router = Router();
const dnsService = new DNSService();
const historyService = new HistoryService();

// Rate limiter for DNS endpoints
const dnsRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 50,
});

/**
 * POST /api/dns/lookup
 * Lookup DNS records for a domain
 */
router.post(
  '/lookup',
  dnsRateLimiter.middleware(),
  sanitizeBody(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { domain, recordTypes } = req.body;

      // Validate required fields
      if (!domain) {
        throw new AppError(
          'VALIDATION_ERROR',
          'Domain is required',
          400,
          { field: 'domain' }
        );
      }

      // Validate recordTypes if provided
      let types: DNSRecordType[] | undefined;
      if (recordTypes) {
        if (!Array.isArray(recordTypes)) {
          throw new AppError(
            'VALIDATION_ERROR',
            'recordTypes must be an array',
            400,
            { field: 'recordTypes' }
          );
        }

        const validTypes: DNSRecordType[] = ['A', 'AAAA', 'MX', 'TXT', 'CNAME', 'NS', 'SOA'];
        for (const type of recordTypes) {
          if (!validTypes.includes(type)) {
            throw new AppError(
              'VALIDATION_ERROR',
              `Invalid record type: ${type}. Valid types are: ${validTypes.join(', ')}`,
              400,
              { field: 'recordTypes', invalidType: type }
            );
          }
        }
        types = recordTypes;
      }

      // Perform DNS lookup
      const result = await dnsService.lookupRecords(domain, types);

      // Save to history
      try {
        historyService.saveAnalysis({
          type: 'dns_lookup',
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
 * POST /api/dns/propagation
 * Check DNS propagation across multiple locations
 */
router.post(
  '/propagation',
  dnsRateLimiter.middleware(),
  sanitizeBody(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { domain, recordType } = req.body;

      // Validate required fields
      if (!domain) {
        throw new AppError(
          'VALIDATION_ERROR',
          'Domain is required',
          400,
          { field: 'domain' }
        );
      }

      if (!recordType) {
        throw new AppError(
          'VALIDATION_ERROR',
          'recordType is required',
          400,
          { field: 'recordType' }
        );
      }

      // Validate recordType
      const validTypes: DNSRecordType[] = ['A', 'AAAA', 'MX', 'TXT', 'CNAME', 'NS', 'SOA'];
      if (!validTypes.includes(recordType)) {
        throw new AppError(
          'VALIDATION_ERROR',
          `Invalid record type: ${recordType}. Valid types are: ${validTypes.join(', ')}`,
          400,
          { field: 'recordType', invalidType: recordType }
        );
      }

      // Check propagation
      const result = await dnsService.checkPropagation(domain, recordType);

      // Save to history
      try {
        historyService.saveAnalysis({
          type: 'dns_propagation',
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

export default router;
