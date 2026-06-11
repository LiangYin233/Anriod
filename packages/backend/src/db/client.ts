import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { config } from '../config'
import * as schema from './schema'

mkdirSync(dirname(config.databasePath), { recursive: true })
mkdirSync(config.coversDir, { recursive: true })

export const sqlite = new Database(config.databasePath)
sqlite.exec('PRAGMA foreign_keys = ON')

export const db = drizzle(sqlite, { schema })

export function initializeDatabase() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS media (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'plan_to_watch',
      rating REAL,
      notes TEXT,
      current_progress TEXT,
      cover_url TEXT,
      cover_local_path TEXT,
      description TEXT,
      external_rating REAL,
      air_date TEXT,
      total_episodes INTEGER,
      studio TEXT,
      source_metadata TEXT,
      source TEXT,
      source_id TEXT,
      source_url TEXT,
      synced_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS media_tags (
      media_id TEXT NOT NULL REFERENCES media(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (media_id, tag_id)
    );

    CREATE TABLE IF NOT EXISTS watch_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      media_id TEXT NOT NULL REFERENCES media(id) ON DELETE CASCADE,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      progress_from TEXT,
      progress_to TEXT,
      rating REAL,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_media_type ON media(type);
    CREATE INDEX IF NOT EXISTS idx_media_status ON media(status);
    CREATE INDEX IF NOT EXISTS idx_media_source ON media(source, source_id);
    CREATE INDEX IF NOT EXISTS idx_media_updated ON media(updated_at);
    CREATE INDEX IF NOT EXISTS idx_media_tags_media ON media_tags(media_id);
    CREATE INDEX IF NOT EXISTS idx_media_tags_tag ON media_tags(tag_id);
    CREATE INDEX IF NOT EXISTS idx_watch_history_media ON watch_history(media_id);
    CREATE INDEX IF NOT EXISTS idx_watch_history_date ON watch_history(started_at);
  `)
}

export function closeDatabase() {
  sqlite.close()
}
