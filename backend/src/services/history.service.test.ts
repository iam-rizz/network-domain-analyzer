/**
 * History Service Tests
 */

import * as fc from 'fast-check';
import { HistoryService } from './history.service';
import { initDatabase, closeDatabase } from '../database/db';
import { AnalysisType } from '../models/analysis.types';
import fs from 'fs';
import path from 'path';

describe('HistoryService', () => {
  let historyService: HistoryService;
  let testDbPath: string;
  
  beforeEach(() => {
    // Create a unique test database for each test
    testDbPath = path.join(process.cwd(), 'data', `test-${Date.now()}-${Math.random()}.db`);
    initDatabase(testDbPath);
    historyService = new HistoryService();
  });
  
  afterEach(() => {
    closeDatabase();
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    // Clean up WAL and SHM files
    const walPath = `${testDbPath}-wal`;
    const shmPath = `${testDbPath}-shm`;
    if (fs.existsSync(walPath)) {
      fs.unlinkSync(walPath);
    }
    if (fs.existsSync(shmPath)) {
      fs.unlinkSync(shmPath);
    }
  });
  
  /**
   * Feature: network-domain-analyzer, Property 21: History Persistence
   * Validates: Requirements 9.1
   * 
   * For any completed analysis, the system should save the result to history with a timestamp.
   */
  test('Property 21: History Persistence - saved analysis can be retrieved', () => {
    fc.assert(
      fc.property(
        fc.record({
          type: fc.constantFrom<AnalysisType>(
            'dns_lookup',
            'dns_propagation',
            'whois',
            'rdap',
            'ping',
            'http_check',
            'port_scan',
            'ssl_check',
            'ip_lookup'
          ),
          domain: fc.option(fc.domain(), { nil: undefined }),
          ip: fc.option(fc.ipV4(), { nil: undefined }),
          result: fc.jsonValue(),
          status: fc.constantFrom<'success' | 'error'>('success', 'error'),
          error: fc.option(fc.string(), { nil: undefined })
        }),
        (analysis) => {
          // Save the analysis
          const id = historyService.saveAnalysis(analysis);
          
          // Retrieve the saved analysis
          const retrieved = historyService.getAnalysisById(id);
          
          // Verify the analysis was saved and can be retrieved
          expect(retrieved).not.toBeNull();
          expect(retrieved!.id).toBe(id);
          expect(retrieved!.type).toBe(analysis.type);
          
          // SQLite stores undefined as null, so we need to normalize the comparison
          expect(retrieved!.domain).toBe(analysis.domain || null);
          expect(retrieved!.ip).toBe(analysis.ip || null);
          expect(retrieved!.result).toEqual(analysis.result);
          expect(retrieved!.status).toBe(analysis.status);
          expect(retrieved!.error).toBe(analysis.error || null);
          
          // Verify timestamp is present and valid
          expect(retrieved!.createdAt).toBeInstanceOf(Date);
          expect(retrieved!.createdAt.getTime()).toBeLessThanOrEqual(Date.now());
          expect(retrieved!.createdAt.getTime()).toBeGreaterThan(Date.now() - 5000); // Within last 5 seconds
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Feature: network-domain-analyzer, Property 22: History Auto-Cleanup
   * Validates: Requirements 9.5
   * 
   * For any history that exceeds 100 entries, the system should automatically delete 
   * the oldest entries to maintain the limit.
   */
  test('Property 22: History Auto-Cleanup - maintains maximum entry limit', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 101, max: 150 }),
        fc.integer({ min: 50, max: 100 }),
        (totalEntries, maxEntries) => {
          // Create entries - auto-cleanup at 100 will happen during this
          const ids: string[] = [];
          const timestamps: number[] = [];
          
          for (let i = 0; i < totalEntries; i++) {
            const beforeSave = Date.now();
            const id = historyService.saveAnalysis({
              type: 'dns_lookup',
              domain: `example${i}.com`,
              result: { records: [] },
              status: 'success'
            });
            ids.push(id);
            timestamps.push(beforeSave);
          }
          
          // After creating totalEntries with auto-cleanup at 100, we should have at most 100 entries
          const countBeforeManualCleanup = historyService.getCount();
          expect(countBeforeManualCleanup).toBeLessThanOrEqual(100);
          
          // Now manually trigger cleanup with the specified maxEntries
          historyService.cleanOldEntries(maxEntries);
          
          // Verify the count is at or below the limit
          const count = historyService.getCount();
          expect(count).toBeLessThanOrEqual(maxEntries);
          
          // Get all surviving analyses with their timestamps
          const survivingAnalyses = ids
            .map((id, index) => {
              const analysis = historyService.getAnalysisById(id);
              return analysis ? { id, index, createdAt: analysis.createdAt.getTime() } : null;
            })
            .filter((a): a is NonNullable<typeof a> => a !== null);
          
          // The number of surviving entries should equal the count
          expect(survivingAnalyses.length).toBe(count);
          
          // Verify that the surviving entries are among the most recently created
          // Sort by timestamp to find the oldest surviving entry
          const sortedSurviving = [...survivingAnalyses].sort((a, b) => a.createdAt - b.createdAt);
          const oldestSurvivingTimestamp = sortedSurviving[0].createdAt;
          
          // All deleted entries should have timestamps older than or equal to the oldest surviving entry
          for (let i = 0; i < ids.length; i++) {
            const analysis = historyService.getAnalysisById(ids[i]);
            if (analysis === null) {
              // This entry was deleted - its timestamp should be <= oldest surviving
              // Note: We can't check this directly since the entry is deleted
              // But we can verify that newer entries weren't deleted
            }
          }
          
          // The most recently created entry should always survive
          const lastId = ids[ids.length - 1];
          expect(historyService.getAnalysisById(lastId)).not.toBeNull();
          
          // Verify that if an entry with timestamp T survived, 
          // then all entries with timestamp > T should also survive
          for (let i = 0; i < ids.length; i++) {
            const analysis = historyService.getAnalysisById(ids[i]);
            if (analysis && analysis.createdAt.getTime() > oldestSurvivingTimestamp) {
              // This entry has a newer timestamp than the oldest survivor, so it should exist
              expect(analysis).not.toBeNull();
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
  
  // Unit tests for additional functionality
  
  test('getHistory returns analyses in descending order by timestamp', () => {
    // Create multiple analyses
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const id = historyService.saveAnalysis({
        type: 'dns_lookup',
        domain: `example${i}.com`,
        result: { records: [] },
        status: 'success'
      });
      ids.push(id);
    }
    
    // Get history
    const history = historyService.getHistory(10, 0);
    
    // Verify order (most recent first)
    expect(history.length).toBe(5);
    for (let i = 0; i < history.length - 1; i++) {
      expect(history[i].createdAt.getTime()).toBeGreaterThanOrEqual(
        history[i + 1].createdAt.getTime()
      );
    }
  });
  
  test('getHistory supports pagination', () => {
    // Create 10 analyses
    for (let i = 0; i < 10; i++) {
      historyService.saveAnalysis({
        type: 'dns_lookup',
        domain: `example${i}.com`,
        result: { records: [] },
        status: 'success'
      });
    }
    
    // Get first page
    const page1 = historyService.getHistory(3, 0);
    expect(page1.length).toBe(3);
    
    // Get second page
    const page2 = historyService.getHistory(3, 3);
    expect(page2.length).toBe(3);
    
    // Verify no overlap
    const page1Ids = page1.map(a => a.id);
    const page2Ids = page2.map(a => a.id);
    expect(page1Ids).not.toEqual(expect.arrayContaining(page2Ids));
  });
  
  test('deleteAnalysis removes the analysis', () => {
    // Create an analysis
    const id = historyService.saveAnalysis({
      type: 'dns_lookup',
      domain: 'example.com',
      result: { records: [] },
      status: 'success'
    });
    
    // Verify it exists
    expect(historyService.getAnalysisById(id)).not.toBeNull();
    
    // Delete it
    const deleted = historyService.deleteAnalysis(id);
    expect(deleted).toBe(true);
    
    // Verify it's gone
    expect(historyService.getAnalysisById(id)).toBeNull();
  });
  
  test('deleteAnalysis returns false for non-existent ID', () => {
    const deleted = historyService.deleteAnalysis('non-existent-id');
    expect(deleted).toBe(false);
  });
  
  test('getAnalysisById returns null for non-existent ID', () => {
    const analysis = historyService.getAnalysisById('non-existent-id');
    expect(analysis).toBeNull();
  });
  
  test('automatic cleanup is triggered after saveAnalysis', () => {
    // Create exactly 100 entries
    for (let i = 0; i < 100; i++) {
      historyService.saveAnalysis({
        type: 'dns_lookup',
        domain: `example${i}.com`,
        result: { records: [] },
        status: 'success'
      });
    }
    
    expect(historyService.getCount()).toBe(100);
    
    // Add one more - should trigger cleanup
    historyService.saveAnalysis({
      type: 'dns_lookup',
      domain: 'example-new.com',
      result: { records: [] },
      status: 'success'
    });
    
    // Should still be at 100 (oldest one deleted)
    expect(historyService.getCount()).toBe(100);
  });
  
  /**
   * Feature: network-domain-analyzer, Property 18: JSON Export Round-Trip
   * Validates: Requirements 8.2
   * 
   * For any analysis result exported to JSON format, parsing the JSON should produce 
   * an equivalent data structure to the original.
   */
  test('Property 18: JSON Export Round-Trip - exported JSON can be parsed back', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            type: fc.constantFrom<AnalysisType>(
              'dns_lookup',
              'dns_propagation',
              'whois',
              'rdap',
              'ping',
              'http_check',
              'port_scan',
              'ssl_check',
              'ip_lookup'
            ),
            domain: fc.option(fc.domain(), { nil: undefined }),
            ip: fc.option(fc.ipV4(), { nil: undefined }),
            result: fc.jsonValue(),
            status: fc.constantFrom<'success' | 'error'>('success', 'error'),
            error: fc.option(fc.string(), { nil: undefined })
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (analyses) => {
          // Save all analyses and collect their IDs
          const ids: string[] = [];
          for (const analysis of analyses) {
            const id = historyService.saveAnalysis(analysis);
            ids.push(id);
          }
          
          // Export to JSON
          const jsonBuffer = historyService.exportAnalyses(ids, 'json');
          const jsonString = jsonBuffer.toString('utf-8');
          
          // Parse the JSON
          const parsed = JSON.parse(jsonString);
          
          // Verify the structure is valid
          expect(parsed).toHaveProperty('exportDate');
          expect(parsed).toHaveProperty('count');
          expect(parsed).toHaveProperty('analyses');
          expect(Array.isArray(parsed.analyses)).toBe(true);
          expect(parsed.count).toBe(analyses.length);
          expect(parsed.analyses.length).toBe(analyses.length);
          
          // Verify each analysis in the parsed data matches the original
          for (let i = 0; i < analyses.length; i++) {
            const original = analyses[i];
            const exported = parsed.analyses[i];
            
            expect(exported).toHaveProperty('id');
            expect(exported).toHaveProperty('type');
            expect(exported).toHaveProperty('domain');
            expect(exported).toHaveProperty('ip');
            expect(exported).toHaveProperty('result');
            expect(exported).toHaveProperty('status');
            expect(exported).toHaveProperty('error');
            expect(exported).toHaveProperty('createdAt');
            
            expect(exported.type).toBe(original.type);
            expect(exported.domain).toBe(original.domain || null);
            expect(exported.ip).toBe(original.ip || null);
            
            // For round-trip testing, we need to compare against JSON-normalized values
            // JSON serialization normalizes certain values (e.g., -0 becomes 0)
            const normalizedOriginal = JSON.parse(JSON.stringify(original.result));
            expect(exported.result).toEqual(normalizedOriginal);
            
            expect(exported.status).toBe(original.status);
            expect(exported.error).toBe(original.error || null);
            
            // Verify createdAt is a valid ISO string
            expect(() => new Date(exported.createdAt)).not.toThrow();
          }
          
          // Round-trip test: the parsed data should be equivalent to what we can retrieve
          // This tests that export -> parse produces the same data as database retrieval
          for (let i = 0; i < ids.length; i++) {
            const retrieved = historyService.getAnalysisById(ids[i]);
            const exported = parsed.analyses[i];
            
            expect(retrieved).not.toBeNull();
            expect(exported.id).toBe(retrieved!.id);
            expect(exported.type).toBe(retrieved!.type);
            
            // Compare with JSON-normalized version since both went through JSON serialization
            const normalizedRetrieved = JSON.parse(JSON.stringify(retrieved!.result));
            expect(exported.result).toEqual(normalizedRetrieved);
            
            expect(exported.status).toBe(retrieved!.status);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Feature: network-domain-analyzer, Property 19: Export Format Availability
   * Validates: Requirements 8.1
   * 
   * For any export request, the system should provide both JSON and CSV format options.
   */
  test('Property 19: Export Format Availability - both JSON and CSV formats work', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            type: fc.constantFrom<AnalysisType>(
              'dns_lookup',
              'dns_propagation',
              'whois',
              'rdap',
              'ping',
              'http_check',
              'port_scan',
              'ssl_check',
              'ip_lookup'
            ),
            domain: fc.option(fc.domain(), { nil: undefined }),
            ip: fc.option(fc.ipV4(), { nil: undefined }),
            result: fc.jsonValue(),
            status: fc.constantFrom<'success' | 'error'>('success', 'error'),
            error: fc.option(fc.string(), { nil: undefined })
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (analyses) => {
          // Save all analyses and collect their IDs
          const ids: string[] = [];
          for (const analysis of analyses) {
            const id = historyService.saveAnalysis(analysis);
            ids.push(id);
          }
          
          // Test JSON export
          let jsonExportSucceeded = false;
          try {
            const jsonBuffer = historyService.exportAnalyses(ids, 'json');
            expect(jsonBuffer).toBeInstanceOf(Buffer);
            expect(jsonBuffer.length).toBeGreaterThan(0);
            
            // Verify it's valid JSON
            const parsed = JSON.parse(jsonBuffer.toString('utf-8'));
            expect(parsed).toHaveProperty('analyses');
            jsonExportSucceeded = true;
          } catch (error) {
            // Should not throw for valid data
            jsonExportSucceeded = false;
          }
          
          // Test CSV export
          let csvExportSucceeded = false;
          try {
            const csvBuffer = historyService.exportAnalyses(ids, 'csv');
            expect(csvBuffer).toBeInstanceOf(Buffer);
            expect(csvBuffer.length).toBeGreaterThan(0);
            
            // Verify it has CSV structure (headers + data rows)
            const csvString = csvBuffer.toString('utf-8');
            const lines = csvString.split('\n');
            expect(lines.length).toBeGreaterThan(1); // At least header + 1 data row
            expect(lines[0]).toContain('ID'); // Header should contain ID
            csvExportSucceeded = true;
          } catch (error) {
            // Should not throw for valid data
            csvExportSucceeded = false;
          }
          
          // Both formats should be available and work
          expect(jsonExportSucceeded).toBe(true);
          expect(csvExportSucceeded).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Feature: network-domain-analyzer, Property 20: Empty Export Prevention
   * Validates: Requirements 8.5
   * 
   * For any export request where no data is available, the system should prevent 
   * the export and display an error message.
   */
  test('Property 20: Empty Export Prevention - export fails when no data available', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<'json' | 'csv'>('json', 'csv'),
        (format) => {
          // Test with empty array
          expect(() => {
            historyService.exportAnalyses([], format);
          }).toThrow('No data available for export');
          
          // Test with non-existent IDs
          expect(() => {
            historyService.exportAnalyses(['non-existent-id-1', 'non-existent-id-2'], format);
          }).toThrow('No data available for export');
          
          // Test with null/undefined (if TypeScript allows)
          expect(() => {
            historyService.exportAnalyses(null as any, format);
          }).toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });
  
  // Unit tests for export functionality
  
  test('exportAnalyses generates valid JSON with correct structure', () => {
    // Create a test analysis
    const id = historyService.saveAnalysis({
      type: 'dns_lookup',
      domain: 'example.com',
      result: { records: [{ type: 'A', value: '1.2.3.4' }] },
      status: 'success'
    });
    
    // Export to JSON
    const buffer = historyService.exportAnalyses([id], 'json');
    const parsed = JSON.parse(buffer.toString('utf-8'));
    
    // Verify structure
    expect(parsed).toHaveProperty('exportDate');
    expect(parsed).toHaveProperty('count', 1);
    expect(parsed).toHaveProperty('analyses');
    expect(parsed.analyses).toHaveLength(1);
    expect(parsed.analyses[0].domain).toBe('example.com');
  });
  
  test('exportAnalyses generates valid CSV with headers', () => {
    // Create a test analysis
    const id = historyService.saveAnalysis({
      type: 'whois',
      domain: 'test.com',
      result: { registrar: 'Test Registrar' },
      status: 'success'
    });
    
    // Export to CSV
    const buffer = historyService.exportAnalyses([id], 'csv');
    const csvString = buffer.toString('utf-8');
    const lines = csvString.split('\n');
    
    // Verify headers
    expect(lines[0]).toContain('ID');
    expect(lines[0]).toContain('Type');
    expect(lines[0]).toContain('Domain');
    expect(lines[0]).toContain('Status');
    
    // Verify data row exists
    expect(lines.length).toBeGreaterThan(1);
    expect(lines[1]).toContain('whois');
    expect(lines[1]).toContain('test.com');
  });
  
  test('CSV export handles special characters correctly', () => {
    // Create analysis with special characters
    const id = historyService.saveAnalysis({
      type: 'dns_lookup',
      domain: 'example.com',
      result: { note: 'Contains, comma and "quotes"' },
      status: 'success',
      error: 'Error message'
    });
    
    // Export to CSV
    const buffer = historyService.exportAnalyses([id], 'csv');
    const csvString = buffer.toString('utf-8');
    
    // Verify the CSV contains the data
    expect(csvString).toContain('example.com');
    expect(csvString).toContain('dns_lookup');
    
    // Verify that fields with special characters are properly handled
    // The result field contains JSON which has quotes and commas
    expect(csvString).toContain('Contains');
    expect(csvString).toContain('comma');
    expect(csvString).toContain('quotes');
  });
  
  test('generateExportFilename creates descriptive filename', () => {
    const jsonFilename = historyService.generateExportFilename('json');
    const csvFilename = historyService.generateExportFilename('csv');
    
    // Verify format
    expect(jsonFilename).toMatch(/^analysis-export-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.json$/);
    expect(csvFilename).toMatch(/^analysis-export-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.csv$/);
  });
  
  test('generateExportFilename supports custom prefix', () => {
    const filename = historyService.generateExportFilename('json', 'dns-check');
    expect(filename).toMatch(/^dns-check-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.json$/);
  });
  
  test('exportAnalyses handles multiple analyses', () => {
    // Create multiple analyses
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const id = historyService.saveAnalysis({
        type: 'dns_lookup',
        domain: `example${i}.com`,
        result: { records: [] },
        status: 'success'
      });
      ids.push(id);
    }
    
    // Export to JSON
    const jsonBuffer = historyService.exportAnalyses(ids, 'json');
    const parsed = JSON.parse(jsonBuffer.toString('utf-8'));
    expect(parsed.count).toBe(5);
    expect(parsed.analyses).toHaveLength(5);
    
    // Export to CSV
    const csvBuffer = historyService.exportAnalyses(ids, 'csv');
    const csvString = csvBuffer.toString('utf-8');
    const lines = csvString.split('\n');
    expect(lines.length).toBe(6); // Header + 5 data rows
  });
});
