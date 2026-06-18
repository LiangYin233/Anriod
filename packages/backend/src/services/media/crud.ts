import type { CreateMediaInput, Media, MediaProgress, MediaType, UpdateMediaInput } from '@anriod/shared'
import { isChapterBased } from '@anriod/shared'
import { and, eq, sql } from 'drizzle-orm'
import { config } from '../../config'
import { ERROR_MESSAGES } from '../../constants'
import { db, type AppDbExecutor } from '../../db/client'
import { media, watchRecord } from '../../db/schema'
import { HttpError } from '../../middleware/error'
import { downloadQueue } from '../../utils/download-queue'
import { setTagsForMedia } from '../tag'
import { createMediaValues, normalizeMediaInput, rowToMedia } from './mapper'
import { validateMediaInput } from './validation'

function computeProgress(mediaId: string, mediaType: string, database: AppDbExecutor): MediaProgress | null {
  const agg = database
    .select({
      max_episode: sql<number>`MAX(${watchRecord.episode})`,
      max_chapter: sql<number>`MAX(${watchRecord.chapter})`
    })
    .from(watchRecord)
    .where(eq(watchRecord.media_id, mediaId))
    .get()

  if (!agg) return null
  const isChapter = isChapterBased(mediaType as MediaType)
  if (isChapter && agg.max_chapter != null && agg.max_chapter > 0) return { chapter: agg.max_chapter }
  if (!isChapter && agg.max_episode != null && agg.max_episode > 0) return { episode: agg.max_episode }
  return null
}

export function getMediaById(id: string, database: AppDbExecutor = db): Media {
  const row = database.select().from(media).where(eq(media.id, id)).get()
  if (!row) throw new HttpError(404, ERROR_MESSAGES.MEDIA_NOT_FOUND)
  const progress = computeProgress(row.id, row.type, database)
  const progressMap = new Map<string, MediaProgress>()
  if (progress) progressMap.set(id, progress)
  return rowToMedia(row, undefined, progressMap)
}

export function createMedia(input: CreateMediaInput, database: AppDbExecutor = db): Media {
  validateMediaInput(input)

  const existing = database
    .select({ id: media.id })
    .from(media)
    .where(and(eq(media.title, input.title.trim()), eq(media.type, input.type)))
    .get()
  if (existing) throw new HttpError(409, 'Duplicate entry')

  const id = crypto.randomUUID()
  const values = createMediaValues(id, input)

  db.transaction((transaction) => {
    transaction.insert(media).values(values).run()
    setTagsForMedia(id, input.tags, transaction)
  })

  return getMediaById(id, database)
}

export function updateMedia(
  id: string,
  input: UpdateMediaInput,
  extra?: { synced_at?: string | null },
  database: AppDbExecutor = db
): Media {
  getMediaById(id, database)
  validateMediaInput(input, true)

  const values = normalizeMediaInput(input, extra)
  const hasMediaChanges = Object.keys(values).length > 0
  if (hasMediaChanges) values.updated_at = new Date().toISOString()

  if (hasMediaChanges || input.tags !== undefined) {
    db.transaction((transaction) => {
      if (hasMediaChanges) {
        transaction.update(media).set(values).where(eq(media.id, id)).run()
      }

      if (input.tags !== undefined) {
        setTagsForMedia(id, input.tags, transaction)
      }
    })
  }

  const updated = getMediaById(id, database)
  const coverUrl = input.cover_url
  if (typeof coverUrl === 'string' && coverUrl.startsWith('http')) {
    downloadQueue.add({
      mediaId: id,
      coverUrl,
      savePath: `${config.coversDir}/${id}`
    })
  }

  return updated
}

export function deleteMedia(id: string, database: AppDbExecutor = db) {
  getMediaById(id, database)
  database.delete(media).where(eq(media.id, id)).run()
}
