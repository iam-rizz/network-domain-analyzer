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

/**
 * GET /api/dns/propagation/stream
 * Stream DNS propagation check results using Server-Sent Events (SSE)
 * 
 * Query params:
 * - domain: string (required) - Domain to check
 * - recordType: string (required) - DNS record type (A, AAAA, MX, etc.)
 * - regions: string (optional) - Comma-separated regions: americas,europe,asia,oceania,global,all
 * - maxLocations: number (optional) - Maximum number of locations to check
 */
router.get(
  '/propagation/stream',
  dnsRateLimiter.middleware(),
  async (req: Request, res: Response) => {
    const { domain, recordType, regions, maxLocations } = req.query;

    // Validate required fields
    if (!domain || typeof domain !== 'string') {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Domain is required' },
      });
      return;
    }

    if (!recordType || typeof recordType !== 'string') {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'recordType is required' },
      });
      return;
    }

    // Validate recordType
    const validTypes: DNSRecordType[] = ['A', 'AAAA', 'MX', 'TXT', 'CNAME', 'NS', 'SOA'];
    if (!validTypes.includes(recordType as DNSRecordType)) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: `Invalid record type: ${recordType}` },
      });
      return;
    }

    // Parse regions
    const validRegions: ProbeRegion[] = ['americas', 'europe', 'asia', 'oceania', 'global', 'all'];
    let selectedRegions: ProbeRegion[] | undefined;
    if (regions && typeof regions === 'string') {
      selectedRegions = regions.split(',').map(r => r.trim().toLowerCase()) as ProbeRegion[];
      for (const region of selectedRegions) {
        if (!validRegions.includes(region)) {
          res.status(400).json({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: `Invalid region: ${region}` },
          });
          return;
        }
      }
    }

    // Parse maxLocations
    let maxLocs: number | undefined;
    if (maxLocations && typeof maxLocations === 'string') {
      maxLocs = parseInt(maxLocations, 10);
      if (isNaN(maxLocs) || maxLocs < 1 || maxLocs > 30) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'maxLocations must be between 1 and 30' },
        });
        return;
      }
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.flushHeaders();

    // Get probe locations
    const locationsToProbe = dnsService.getProbeLocationsForCheck({
      regions: selectedRegions,
      maxLocations: maxLocs,
    });

    // Send initial event with all locations (pending state)
    const initialLocations = locationsToProbe.map(loc => ({
      location: loc.name,
      server: loc.server,
      region: loc.region,
      country: loc.country,
      status: 'pending' as const,
    }));

    res.write(`event: init\n`);
    res.write(`data: ${JSON.stringify({ locations: initialLocations, total: locationsToProbe.length })}\n\n`);

    // Track results for final summary
    const results: any[] = [];
    let completedCount = 0;

    // Query each location and stream results
    const queryPromises = locationsToProbe.map(async (location, index) => {
      try {
        const result = await dnsService.queryLocationWithResilience(
          domain,
          recordType as DNSRecordType,
          location.name,
          location.server
        );

        results.push(result);
        completedCount++;

        // Send result event
        res.write(`event: result\n`);
        res.write(`data: ${JSON.stringify({
          index,
          server: location.server,
          region: location.region,
          country: location.country,
          location: result.location,
          status: result.status,
          records: result.records,
          responseTime: result.responseTime,
          progress: {
            completed: completedCount,
            total: locationsToProbe.length,
          },
        })}\n\n`);

      } catch (error: any) {
        completedCount++;
        const errorResult = {
          location: location.name,
          status: 'unavailable' as const,
          records: [] as any[],
          responseTime: 0,
        };
        results.push(errorResult);

        res.write(`event: result\n`);
        res.write(`data: ${JSON.stringify({
          index,
          server: location.server,
          region: location.region,
          country: location.country,
          location: location.name,
          status: 'unavailable',
          records: [],
          responseTime: 0,
          error: error.message,
          progress: {
            completed: completedCount,
            total: locationsToProbe.length,
          },
        })}\n\n`);
      }
    });

    // Wait for all queries to complete
    await Promise.all(queryPromises);

    // Calculate final summary
    const successfulResults = results.filter(r => r.status === 'success' && r.records?.length > 0);
    const failedResults = results.filter(r => r.status === 'failure' || r.status === 'unavailable');
    
    // Check if fully propagated
    let fullyPropagated = false;
    const inconsistencies: string[] = [];
    
    if (successfulResults.length >= 2) {
      const referenceRecords = successfulResults[0].records;
      fullyPropagated = successfulResults.every(result => {
        const sorted1 = [...referenceRecords].sort((a: any, b: any) => a.value.localeCompare(b.value));
        const sorted2 = [...result.records].sort((a: any, b: any) => a.value.localeCompare(b.value));
        
        if (sorted1.length !== sorted2.length) return false;
        return sorted1.every((r: any, i: number) => r.value === sorted2[i].value);
      });

      if (!fullyPropagated) {
        for (let i = 1; i < successfulResults.length; i++) {
          const ref = successfulResults[0];
          const curr = successfulResults[i];
          const refValues = ref.records.map((r: any) => r.value).sort().join(',');
          const currValues = curr.records.map((r: any) => r.value).sort().join(',');
          if (refValues !== currValues) {
            inconsistencies.push(`Records differ between ${ref.location} and ${curr.location}`);
          }
        }
      }
    }

    // Send complete event with summary
    res.write(`event: complete\n`);
    res.write(`data: ${JSON.stringify({
      fullyPropagated,
      inconsistencies,
      summary: {
        total: results.length,
        successful: successfulResults.length,
        failed: failedResults.length,
      },
    })}\n\n`);

    // Save to history
    try {
      historyService.saveAnalysis({
        type: 'dns_propagation',
        domain,
        result: {
          fullyPropagated,
          locations: results,
          inconsistencies,
        },
        status: 'success',
      });
    } catch {
      // Don't fail if history save fails
    }

    res.end();
  }
);

export default router;
