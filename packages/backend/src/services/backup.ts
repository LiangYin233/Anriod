import type { Media, Tag, WatchRecord } from '@anriod/shared'
import { asc, eq } from 'drizzle-orm'
import { ERROR_MESSAGES } from '../constants'
import { db } from '../db/client'
import { media, mediaTags, tags, watchRecord, type NewMediaRow, type NewTagRow, type NewWatchRecordRow } from '../db/schema'
import { HttpError } from '../middleware/error'

export interface ExportData {
  version: 2
  exported_at: string
  media: Media[]
  tags: Tag[]
  watch_records: WatchRecord[]
}

export function exportAll(): ExportData {
  const mediaRows = db.select().from(media).orderBy(asc(media.created_at)).all()

  const allMediaTags = db
    .select({ media_id: mediaTags.media_id, name: tags.name })
    .from(mediaTags)
    .innerJoin(tags, eq(tags.id, mediaTags.tag_id))
    .orderBy(asc(mediaTags.media_id), asc(tags.name))
    .all()

  const tagsByMediaId = new Map<string, string[]>()
  for (const row of allMediaTags) {
    if (!tagsByMediaId.has(row.media_id)) {
      tagsByMediaId.set(row.media_id, [])
    }
    tagsByMediaId.get(row.media_id)!.push(row.name)
  }

  const mediaItems: Media[] = mediaRows.map((row) => ({
    ...row,
    current_progress: null,
    tags: tagsByMediaId.get(row.id) || []
  }))

  const tagRows = db.select().from(tags).orderBy(asc(tags.id)).all()
  const recordRows = db.select().from(watchRecord).orderBy(asc(watchRecord.id)).all()

  return {
    version: 2,
    exported_at: new Date().toISOString(),
    media: mediaItems,
    tags: tagRows,
    watch_records: recordRows
  }
}

export function importAll(data: ExportData) {
  if (!data || data.version !== 2) {
    throw new HttpError(400, ERROR_MESSAGES.INVALID_EXPORT_FORMAT)
  }

  if (!Array.isArray(data.media) || !Array.isArray(data.tags) || !Array.isArray(data.watch_records)) {
    throw new HttpError(400, ERROR_MESSAGES.EXPORT_MISSING_ARRAYS)
  }

  const tagsByName = new Map<string, Tag>()
  for (const tag of data.tags) {
    if (!tagsByName.has(tag.name)) tagsByName.set(tag.name, tag)
  }

  db.transaction((transaction) => {
    transaction.delete(watchRecord).run()
    transaction.delete(mediaTags).run()
    transaction.delete(tags).run()
    transaction.delete(media).run()

    for (const tag of data.tags) {
      const values: NewTagRow = {
        id: tag.id,
        name: tag.name,
        created_at: tag.created_at
      }
      transaction.insert(tags).values(values).onConflictDoNothing().run()
    }

    for (const item of data.media) {
      const values: NewMediaRow = {
        id: item.id,
        title: item.title,
        type: item.type,
        status: item.status,
        rating: item.rating ?? null,
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

      if (Array.isArray(item.tags)) {
        for (const tagName of item.tags) {
          const tag = tagsByName.get(tagName)
          if (tag) {
            transaction.insert(mediaTags).values({ media_id: item.id, tag_id: tag.id }).onConflictDoNothing().run()
          }
        }
      }
    }

    for (const entry of data.watch_records) {
      const values: NewWatchRecordRow = {
        id: entry.id,
        media_id: entry.media_id,
        episode: entry.episode ?? null,
        chapter: entry.chapter ?? null,
        watched_at: entry.watched_at,
        created_at: entry.created_at
      }
      transaction.insert(watchRecord).values(values).run()
    }
  })
}
