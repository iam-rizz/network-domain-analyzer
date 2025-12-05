/**
 * Database connection and initialization
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let db: Database.Database | null = null;

/**
 * Initialize database connection
 */
export function initDatabase(dbPath?: string): Database.Database {
  const defaultPath = path.join(process.cwd(), 'data', 'analyses.db');
  const finalPath = dbPath || process.env.DATABASE_PATH || defaultPath;
  
  // Ensure data directory exists
  const dir = path.dirname(finalPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  db = new Database(finalPath);
  
  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL');
  
  // Create tables
  createTables(db);
  
  return db;
}

/**
 * Get database instance
 */
export function getDatabase(): Database.Database {
  if (!db) {
    return initDatabase();
  }
  return db;
}

/**
 * Close database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Create database tables
 */
function createTables(database: Database.Database): void {
  // Create analyses table
  database.exec(`
    CREATE TABLE IF NOT EXISTS analyses (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      domain TEXT,
      ip TEXT,
      result TEXT NOT NULL,
      status TEXT NOT NULL,
      error TEXT,
      created_at INTEGER NOT NULL
    )
  `);
  
  // Create indexes for better query performance
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_created_at ON analyses(created_at DESC)
  `);
  
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_domain ON analyses(domain)
  `);
  
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_type ON analyses(type)
  `);
}
