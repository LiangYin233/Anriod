import type { Media, Tag, WatchHistory } from '@anriod/shared'
import { asc, eq } from 'drizzle-orm'
import { ERROR_MESSAGES } from '../constants'
import { db } from '../db/client'
import { media, mediaTags, tags, watchHistory, type NewMediaRow, type NewTagRow, type NewWatchHistoryRow } from '../db/schema'
import { HttpError } from '../middleware/error'

export interface ExportData {
  version: 1
  exported_at: string
  media: Media[]
  tags: Tag[]
  watch_history: WatchHistory[]
}

export function exportAll(): ExportData {
  const mediaRows = db.select().from(media).orderBy(asc(media.created_at)).all()

  // Fetch all media_tags in one query
  const allMediaTags = db
    .select({ media_id: mediaTags.media_id, name: tags.name })
    .from(mediaTags)
    .innerJoin(tags, eq(tags.id, mediaTags.tag_id))
    .orderBy(asc(mediaTags.media_id), asc(tags.name))
    .all()

  // Group tags by media_id
  const tagsByMediaId = new Map<string, string[]>()
  for (const row of allMediaTags) {
    if (!tagsByMediaId.has(row.media_id)) {
      tagsByMediaId.set(row.media_id, [])
    }
    tagsByMediaId.get(row.media_id)!.push(row.name)
  }

  const mediaItems: Media[] = mediaRows.map((row) => ({
    ...row,
    tags: tagsByMediaId.get(row.id) || []
  }))

  const tagRows = db.select().from(tags).orderBy(asc(tags.id)).all()
  const watchHistoryRows = db.select().from(watchHistory).orderBy(asc(watchHistory.id)).all()

  return {
    version: 1,
    exported_at: new Date().toISOString(),
    media: mediaItems,
    tags: tagRows,
    watch_history: watchHistoryRows
  }
}

export function importAll(data: ExportData) {
  if (!data || data.version !== 1) {
    throw new HttpError(400, ERROR_MESSAGES.INVALID_EXPORT_FORMAT)
  }

  if (!Array.isArray(data.media) || !Array.isArray(data.tags) || !Array.isArray(data.watch_history)) {
    throw new HttpError(400, ERROR_MESSAGES.EXPORT_MISSING_ARRAYS)
  }

  const tagsByName = new Map<string, Tag>()
  for (const tag of data.tags) {
    if (!tagsByName.has(tag.name)) tagsByName.set(tag.name, tag)
  }

  db.transaction((transaction) => {
    // Clear existing data (order matters due to foreign keys)
    transaction.delete(watchHistory).run()
    transaction.delete(mediaTags).run()
    transaction.delete(tags).run()
    transaction.delete(media).run()

    // Restore tags
    for (const tag of data.tags) {
      const values: NewTagRow = {
        id: tag.id,
        name: tag.name,
        created_at: tag.created_at
      }
      transaction.insert(tags).values(values).onConflictDoNothing().run()
    }

    // Restore media
    for (const item of data.media) {
      const values: NewMediaRow = {
        id: item.id,
        title: item.title,
        type: item.type,
        status: item.status,
        rating: item.rating ?? null,
        current_progress: item.current_progress ?? null,
        cover_url: item.cover_url ?? null,
        description: item.description ?? null,
        external_rating: item.external_rating ?? null,
        air_date: item.air_date ?? null,
        total_episodes: item.total_episodes ?? null,
        studio: item.studio ?? null,
        source_metadata: item.source_metadata ?? null,
        source: item.source ?? null,
        source_id: item.source_id ?? null,
        source_url: item.source_url ?? null,
        synced_at: item.synced_at ?? null,
        created_at: item.created_at,
        updated_at: item.updated_at
      }
      transaction.insert(media).values(values).run()

      // Restore media-tag associations
      if (Array.isArray(item.tags)) {
        for (const tagName of item.tags) {
          const tag = tagsByName.get(tagName)
          if (tag) {
            transaction.insert(mediaTags).values({ media_id: item.id, tag_id: tag.id }).onConflictDoNothing().run()
          }
        }
      }
    }

    // Restore watch history
    for (const entry of data.watch_history) {
      const values: NewWatchHistoryRow = {
        id: entry.id,
        media_id: entry.media_id,
        started_at: entry.started_at,
        completed_at: entry.completed_at ?? null,
        progress_from: entry.progress_from ?? null,
        progress_to: entry.progress_to ?? null,
        rating: entry.rating ?? null,
        created_at: entry.created_at
      }
      transaction.insert(watchHistory).values(values).run()
    }
  })
}
