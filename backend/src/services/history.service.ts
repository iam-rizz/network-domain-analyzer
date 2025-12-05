/**
 * History Service - Manages analysis history persistence
 */

import { getDatabase } from '../database/db';
import { Analysis } from '../models/analysis.types';
import { v4 as uuidv4 } from 'uuid';

export class HistoryService {
  /**
   * Save an analysis to history
   */
  saveAnalysis(analysis: Omit<Analysis, 'id' | 'createdAt'>): string {
    const db = getDatabase();
    const id = uuidv4();
    const createdAt = Date.now();
    
    const stmt = db.prepare(`
      INSERT INTO analyses (id, type, domain, ip, result, status, error, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      analysis.type,
      analysis.domain || null,
      analysis.ip || null,
      JSON.stringify(analysis.result),
      analysis.status,
      analysis.error || null,
      createdAt
    );
    
    // Perform automatic cleanup after saving
    this.cleanOldEntries(100);
    
    return id;
  }
  
  /**
   * Get analysis history with pagination
   */
  getHistory(limit: number = 20, offset: number = 0): Analysis[] {
    const db = getDatabase();
    
    const stmt = db.prepare(`
      SELECT id, type, domain, ip, result, status, error, created_at
      FROM analyses
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);
    
    const rows = stmt.all(limit, offset) as any[];
    
    return rows.map(row => ({
      id: row.id,
      type: row.type,
      domain: row.domain,
      ip: row.ip,
      result: JSON.parse(row.result),
      status: row.status,
      error: row.error,
      createdAt: new Date(row.created_at)
    }));
  }
  
  /**
   * Get a specific analysis by ID
   */
  getAnalysisById(id: string): Analysis | null {
    const db = getDatabase();
    
    const stmt = db.prepare(`
      SELECT id, type, domain, ip, result, status, error, created_at
      FROM analyses
      WHERE id = ?
    `);
    
    const row = stmt.get(id) as any;
    
    if (!row) {
      return null;
    }
    
    return {
      id: row.id,
      type: row.type,
      domain: row.domain,
      ip: row.ip,
      result: JSON.parse(row.result),
      status: row.status,
      error: row.error,
      createdAt: new Date(row.created_at)
    };
  }
  
  /**
   * Delete an analysis by ID
   */
  deleteAnalysis(id: string): boolean {
    const db = getDatabase();
    
    const stmt = db.prepare(`
      DELETE FROM analyses WHERE id = ?
    `);
    
    const result = stmt.run(id);
    
    return result.changes > 0;
  }
  
  /**
   * Clean old entries to maintain maximum entry limit
   */
  cleanOldEntries(maxEntries: number): void {
    const db = getDatabase();
    
    // Count total entries
    const countStmt = db.prepare(`SELECT COUNT(*) as count FROM analyses`);
    const countResult = countStmt.get() as { count: number };
    
    if (countResult.count <= maxEntries) {
      return;
    }
    
    // Delete oldest entries beyond the limit
    // Use both created_at and id for deterministic ordering
    const deleteStmt = db.prepare(`
      DELETE FROM analyses
      WHERE id IN (
        SELECT id FROM analyses
        ORDER BY created_at DESC, id DESC
        LIMIT -1 OFFSET ?
      )
    `);
    
    deleteStmt.run(maxEntries);
  }
  
  /**
   * Get total count of analyses
   */
  getCount(): number {
    const db = getDatabase();
    const stmt = db.prepare(`SELECT COUNT(*) as count FROM analyses`);
    const result = stmt.get() as { count: number };
    return result.count;
  }
  
  /**
   * Export analyses to JSON or CSV format
   * @param ids - Array of analysis IDs to export
   * @param format - Export format ('json' or 'csv')
   * @returns Buffer containing the exported data
   * @throws Error if no data available or invalid format
   */
  exportAnalyses(ids: string[], format: 'json' | 'csv'): Buffer {
    // Prevent export when no data available
    if (!ids || ids.length === 0) {
      throw new Error('No data available for export');
    }
    
    // Fetch all analyses by IDs
    const analyses: Analysis[] = [];
    for (const id of ids) {
      const analysis = this.getAnalysisById(id);
      if (analysis) {
        analyses.push(analysis);
      }
    }
    
    // If no valid analyses found, throw error
    if (analyses.length === 0) {
      throw new Error('No data available for export');
    }
    
    if (format === 'json') {
      return this.exportToJSON(analyses);
    } else if (format === 'csv') {
      return this.exportToCSV(analyses);
    } else {
      throw new Error(`Invalid export format: ${format}`);
    }
  }
  
  /**
   * Export analyses to JSON format
   */
  private exportToJSON(analyses: Analysis[]): Buffer {
    // Create valid JSON structure with all data fields
    const exportData = {
      exportDate: new Date().toISOString(),
      count: analyses.length,
      analyses: analyses.map(analysis => ({
        id: analysis.id,
        type: analysis.type,
        domain: analysis.domain || null,
        ip: analysis.ip || null,
        result: analysis.result,
        status: analysis.status,
        error: analysis.error || null,
        createdAt: analysis.createdAt.toISOString()
      }))
    };
    
    const jsonString = JSON.stringify(exportData, null, 2);
    return Buffer.from(jsonString, 'utf-8');
  }
  
  /**
   * Export analyses to CSV format
   */
  private exportToCSV(analyses: Analysis[]): Buffer {
    // CSV headers
    const headers = ['ID', 'Type', 'Domain', 'IP', 'Status', 'Error', 'Created At', 'Result'];
    const csvLines: string[] = [headers.join(',')];
    
    // Add data rows
    for (const analysis of analyses) {
      const row = [
        this.escapeCsvValue(analysis.id),
        this.escapeCsvValue(analysis.type),
        this.escapeCsvValue(analysis.domain || ''),
        this.escapeCsvValue(analysis.ip || ''),
        this.escapeCsvValue(analysis.status),
        this.escapeCsvValue(analysis.error || ''),
        this.escapeCsvValue(analysis.createdAt.toISOString()),
        this.escapeCsvValue(JSON.stringify(analysis.result))
      ];
      csvLines.push(row.join(','));
    }
    
    const csvString = csvLines.join('\n');
    return Buffer.from(csvString, 'utf-8');
  }
  
  /**
   * Escape CSV values to handle commas, quotes, and newlines
   */
  private escapeCsvValue(value: string): string {
    if (!value) return '""';
    
    // If value contains comma, quote, or newline, wrap in quotes and escape quotes
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    
    return `"${value}"`;
  }
  
  /**
   * Generate descriptive filename with timestamp
   * @param format - Export format ('json' or 'csv')
   * @param prefix - Optional prefix for filename
   * @returns Descriptive filename
   */
  generateExportFilename(format: 'json' | 'csv', prefix: string = 'analysis-export'): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const timeComponent = new Date().toISOString().split('T')[1].split('.')[0].replace(/:/g, '-');
    return `${prefix}-${timestamp}-${timeComponent}.${format}`;
  }
}
