/**
 * Migration: Remove cover_local_path column
 *
 * This migration removes the cover_local_path column from the media table.
 * We now use only cover_url for both remote URLs and local paths.
 *
 * Remote: https://example.com/image.jpg
 * Local:  /covers/123.jpg
 */

import { run } from '../helpers'

export function removeCoverLocalPath() {
  console.log('Removing cover_local_path column from media table...')

  // SQLite doesn't support DROP COLUMN directly, so we need to recreate the table
  // Step 1: Create new table without cover_local_path
  run(`
    CREATE TABLE media_new (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'plan_to_watch',
      rating REAL,
      notes TEXT,
      current_progress TEXT,
      cover_url TEXT,
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
    )
  `)

  // Step 2: Copy data from old table (excluding cover_local_path)
  run(`
    INSERT INTO media_new
    SELECT
      id, title, type, status, rating, notes, current_progress,
      cover_url, description, external_rating, air_date, total_episodes,
      studio, source_metadata, source, source_id, source_url, synced_at,
      created_at, updated_at
    FROM media
  `)

  // Step 3: Drop old table
  run('DROP TABLE media')

  // Step 4: Rename new table
  run('ALTER TABLE media_new RENAME TO media')

  // Step 5: Recreate indexes
  run('CREATE INDEX idx_media_type ON media(type)')
  run('CREATE INDEX idx_media_status ON media(status)')
  run('CREATE INDEX idx_media_source ON media(source, source_id)')
  run('CREATE INDEX idx_media_updated ON media(updated_at)')

  console.log('✓ Successfully removed cover_local_path column')
}

// Run migration if executed directly
if (import.meta.main) {
  removeCoverLocalPath()
}
