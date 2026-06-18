import type { Media, Status } from '@anriod/shared'
import { and, eq } from 'drizzle-orm'
import { ERROR_MESSAGES } from '../../constants'
import { db } from '../../db/client'
import { media, watchRecord } from '../../db/schema'
import { HttpError } from '../../middleware/error'
import { isStatus } from '../../utils/http'
import { createWatchRecord } from '../watch-record'
import { getMediaById } from './crud'

function isChapterBased(type: string): boolean {
  return type === 'novel' || type === 'manga'
}

function progressKey(type: string): 'chapter' | 'episode' {
  return isChapterBased(type) ? 'chapter' : 'episode'
}

export function markEpisodesWatched(id: string, episodes: number[]): Media {
  if (episodes.length === 0) return getMediaById(id)
  const current = getMediaById(id)
  const key = progressKey(current.type)
  const now = new Date().toISOString()

  for (const ep of episodes) {
    createWatchRecord({
      media_id: id,
      [key]: ep,
      watched_at: now
    })
  }

  db.update(media).set({ updated_at: now }).where(eq(media.id, id)).run()

  return getMediaById(id)
}

export function markSingleEpisode(id: string, episode: number): Media {
  const current = getMediaById(id)
  const key = progressKey(current.type)
  const now = new Date().toISOString()

  createWatchRecord({
    media_id: id,
    [key]: episode,
    watched_at: now
  })

  return getMediaById(id)
}

export function undoEpisodeWatch(id: string, episode: number): Media {
  const current = getMediaById(id)
  const key = progressKey(current.type)

  const col = key === 'chapter' ? watchRecord.chapter : watchRecord.episode
  const entry = db
    .select({ id: watchRecord.id })
    .from(watchRecord)
    .where(and(eq(watchRecord.media_id, id), eq(col, episode)))
    .get()

  if (entry) {
    db.delete(watchRecord).where(eq(watchRecord.id, entry.id)).run()
  }

  const now = new Date().toISOString()
  db.update(media).set({ updated_at: now }).where(eq(media.id, id)).run()

  return getMediaById(id)
}

export function updateStatus(id: string, status: Status): Media {
  getMediaById(id)
  if (!isStatus(status)) throw new HttpError(400, ERROR_MESSAGES.INVALID_STATUS)

  const now = new Date().toISOString()
  db.update(media).set({ status, updated_at: now }).where(eq(media.id, id)).run()

  return getMediaById(id)
}
