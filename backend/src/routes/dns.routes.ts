/**
 * DNS Routes
 * Handles DNS lookup and propagation check endpoints
 */

import { Router, Request, Response, NextFunction } from 'express';
import { DNSService, ProbeRegion } from '../services/dns.service';
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
 * 
 * Body params:
 * - domain: string (required) - Domain to check
 * - recordType: string (required) - DNS record type (A, AAAA, MX, etc.)
 * - regions: string[] (optional) - Regions to check: americas, europe, asia, oceania, global, all
 * - maxLocations: number (optional) - Maximum number of locations to check (default: 10)
 */
router.post(
  '/propagation',
  dnsRateLimiter.middleware(),
  sanitizeBody(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { domain, recordType, regions, maxLocations } = req.body;

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

      // Validate regions if provided
      const validRegions: ProbeRegion[] = ['americas', 'europe', 'asia', 'oceania', 'global', 'all'];
      let selectedRegions: ProbeRegion[] | undefined;
      
      if (regions) {
        if (!Array.isArray(regions)) {
          throw new AppError(
            'VALIDATION_ERROR',
            'regions must be an array',
            400,
            { field: 'regions' }
          );
        }
        
        for (const region of regions) {
          if (!validRegions.includes(region)) {
            throw new AppError(
              'VALIDATION_ERROR',
              `Invalid region: ${region}. Valid regions are: ${validRegions.join(', ')}`,
              400,
              { field: 'regions', invalidRegion: region }
            );
          }
        }
        selectedRegions = regions;
      }

      // Validate maxLocations if provided
      let maxLocs: number | undefined;
      if (maxLocations !== undefined) {
        maxLocs = parseInt(maxLocations, 10);
        if (isNaN(maxLocs) || maxLocs < 1 || maxLocs > 30) {
          throw new AppError(
            'VALIDATION_ERROR',
            'maxLocations must be a number between 1 and 30',
            400,
            { field: 'maxLocations' }
          );
        }
      }

      // Check propagation
      const result = await dnsService.checkPropagation(domain, recordType, {
        regions: selectedRegions,
        maxLocations: maxLocs,
      });

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

/**
 * GET /api/dns/probe-locations
 * Get available DNS probe locations grouped by region
 */
router.get(
  '/probe-locations',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const locations = dnsService.getAvailableProbeLocations();
      
      // Count total unique servers
      const allServers = new Set<string>();
      Object.values(locations).forEach(locs => {
        locs.forEach(loc => allServers.add(loc.server));
      });

      res.json({
        success: true,
        data: {
          locations,
          summary: {
            americas: locations.americas.length,
            europe: locations.europe.length,
            asia: locations.asia.length,
            oceania: locations.oceania.length,
            global: locations.global.length,
            total: allServers.size,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
