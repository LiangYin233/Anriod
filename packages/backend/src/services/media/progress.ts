import type { Media, Status } from '@anriod/shared'
import { progressKey } from '@anriod/shared'
import { and, eq } from 'drizzle-orm'
import { ERROR_MESSAGES } from '../../constants'
import { db, type AppDbExecutor } from '../../db/client'
import { media, watchRecord } from '../../db/schema'
import { HttpError } from '../../middleware/error'
import { isStatus } from '../../utils/http'
import { createWatchRecord } from '../watch-record'
import { getMediaById } from './crud'

export function markEpisodesWatched(id: string, episodes: number[], database: AppDbExecutor = db): Media {
  if (episodes.length === 0) return getMediaById(id, database)
  const current = getMediaById(id, database)
  const key = progressKey(current.type)
  const now = new Date().toISOString()

  for (const ep of episodes) {
    createWatchRecord({
      media_id: id,
      [key]: ep,
      watched_at: now
    }, database)
  }

  database.update(media).set({ updated_at: now }).where(eq(media.id, id)).run()

  return getMediaById(id, database)
}

export function markSingleEpisode(id: string, episode: number, database: AppDbExecutor = db): Media {
  const current = getMediaById(id, database)
  const key = progressKey(current.type)
  const now = new Date().toISOString()

  createWatchRecord({
    media_id: id,
    [key]: episode,
    watched_at: now
  }, database)

  return getMediaById(id, database)
}

export function undoEpisodeWatch(id: string, episode: number, database: AppDbExecutor = db): Media {
  const current = getMediaById(id, database)
  const key = progressKey(current.type)

  const col = key === 'chapter' ? watchRecord.chapter : watchRecord.episode
  const entry = database
    .select({ id: watchRecord.id })
    .from(watchRecord)
    .where(and(eq(watchRecord.media_id, id), eq(col, episode)))
    .get()

  if (entry) {
    database.delete(watchRecord).where(eq(watchRecord.id, entry.id)).run()
  }

  const now = new Date().toISOString()
  database.update(media).set({ updated_at: now }).where(eq(media.id, id)).run()

  return getMediaById(id, database)
}

export function updateStatus(id: string, status: Status, database: AppDbExecutor = db): Media {
  getMediaById(id, database)
  if (!isStatus(status)) throw new HttpError(400, ERROR_MESSAGES.INVALID_STATUS)

  const now = new Date().toISOString()
  database.update(media).set({ status, updated_at: now }).where(eq(media.id, id)).run()

  return getMediaById(id, database)
}
