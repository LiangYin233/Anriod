import type { Media, Tag, WatchHistory } from '@anriod/shared'
import { all, run, transaction } from '../db/helpers'
import { HttpError } from '../middleware/error'
import { jsonString, parseJsonField } from '../utils/http'
import { ERROR_MESSAGES } from '../constants'

export interface ExportData {
  version: 1
  exported_at: string
  media: Media[]
  tags: Tag[]
  watch_history: WatchHistory[]
}

export function exportAll(): ExportData {
  const mediaRows = all<Omit<Media, 'tags' | 'current_progress' | 'source_metadata'> & {
    current_progress: string | null
    source_metadata: string | null
  }>('SELECT * FROM media ORDER BY created_at ASC')

  // Fetch all media_tags in one query
  const allMediaTags = all<{ media_id: string; name: string }>(
    `SELECT mt.media_id, t.name
     FROM media_tags mt
     INNER JOIN tags t ON t.id = mt.tag_id
     ORDER BY mt.media_id, t.name ASC`
  )

  // Group tags by media_id
  const tagsByMediaId = new Map<string, string[]>()
  for (const row of allMediaTags) {
    if (!tagsByMediaId.has(row.media_id)) {
      tagsByMediaId.set(row.media_id, [])
    }
    tagsByMediaId.get(row.media_id)!.push(row.name)
  }

  const media: Media[] = mediaRows.map((row) => ({
    ...row,
    current_progress: parseJsonField(row.current_progress),
    source_metadata: parseJsonField(row.source_metadata),
    tags: tagsByMediaId.get(row.id) || []
  }))

  const tags = all<Tag>('SELECT * FROM tags ORDER BY id ASC')
  const watchHistory = all<WatchHistory>('SELECT * FROM watch_history ORDER BY id ASC')

  return {
    version: 1,
    exported_at: new Date().toISOString(),
    media,
    tags,
    watch_history: watchHistory.map((row) => ({
      ...row,
      progress_from: parseJsonField(row.progress_from),
      progress_to: parseJsonField(row.progress_to),
    }))
  }
}

export function importAll(data: ExportData) {
  if (!data || data.version !== 1) {
    throw new HttpError(400, ERROR_MESSAGES.INVALID_EXPORT_FORMAT)
  }

  if (!Array.isArray(data.media) || !Array.isArray(data.tags) || !Array.isArray(data.watch_history)) {
    throw new HttpError(400, ERROR_MESSAGES.EXPORT_MISSING_ARRAYS)
  }

  transaction(() => {
    // Clear existing data (order matters due to foreign keys)
    run('DELETE FROM watch_history')
    run('DELETE FROM media_tags')
    run('DELETE FROM tags')
    run('DELETE FROM media')

    // Restore tags
    for (const tag of data.tags) {
      run('INSERT OR IGNORE INTO tags (id, name, created_at) VALUES (?, ?, ?)', [
        tag.id,
        tag.name,
        tag.created_at
      ])
    }

    // Restore media
    for (const item of data.media) {
      run(
        `INSERT INTO media (
          id, title, type, status, rating, notes, current_progress,
          cover_url, description, external_rating,
          air_date, total_episodes, studio, source_metadata,
          source, source_id, source_url, synced_at,
          created_at, updated_at
        ) VALUES (${Array.from({ length: 20 }, () => '?').join(', ')})`,
        [
          item.id,
          item.title,
          item.type,
          item.status,
          item.rating ?? null,
          item.notes ?? null,
          jsonString(item.current_progress),
          item.cover_url ?? null,
          item.description ?? null,
          item.external_rating ?? null,
          item.air_date ?? null,
          item.total_episodes ?? null,
          item.studio ?? null,
          jsonString(item.source_metadata),
          item.source ?? null,
          item.source_id ?? null,
          item.source_url ?? null,
          item.synced_at ?? null,
          item.created_at,
          item.updated_at
        ]
      )

      // Restore media-tag associations
      if (Array.isArray(item.tags)) {
        for (const tagName of item.tags) {
          const tag = data.tags.find((t) => t.name === tagName)
          if (tag) {
            run('INSERT OR IGNORE INTO media_tags (media_id, tag_id) VALUES (?, ?)', [item.id, tag.id])
          }
        }
      }
    }

    // Restore watch history
    for (const entry of data.watch_history) {
      run(
        `INSERT INTO watch_history (
          id, media_id, started_at, completed_at,
          progress_from, progress_to, rating, notes, created_at
        ) VALUES (${Array.from({ length: 9 }, () => '?').join(', ')})`,
        [
          entry.id,
          entry.media_id,
          entry.started_at,
          entry.completed_at ?? null,
          jsonString(entry.progress_from),
          jsonString(entry.progress_to),
          entry.rating ?? null,
          entry.notes ?? null,
          entry.created_at
        ]
      )
    }
  })
}
