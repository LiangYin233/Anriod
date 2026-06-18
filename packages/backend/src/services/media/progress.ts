import type { Media, MediaProgress, Status } from '@anriod/shared'
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

function episodeOf(r: { episode: number | null; chapter: number | null }, key: 'chapter' | 'episode'): number {
  return (r[key] as number) ?? 0
}

function maxWatchedForMedia(mediaId: string, key: 'chapter' | 'episode'): number {
  const rows = db
    .select({ episode: watchRecord.episode, chapter: watchRecord.chapter })
    .from(watchRecord)
    .where(and(eq(watchRecord.media_id, mediaId), eq(watchRecord.is_continuous, 1)))
    .all()
  if (rows.length === 0) return 0
  return Math.max(...rows.map(r => episodeOf(r, key)))
}

export function updateProgress(id: string, progress: MediaProgress, startedAt?: string | null): Media {
  const current = getMediaById(id)
  const now = startedAt || new Date().toISOString()
  const key = progressKey(current.type)

  db.update(media).set({ current_progress: progress, updated_at: now }).where(eq(media.id, id)).run()

  const newValue = progress[key] as number | undefined
  const oldValue = (current.current_progress?.[key] as number | undefined) ?? 0
  if (newValue !== undefined && newValue > oldValue) {
    for (let ep = oldValue + 1; ep <= newValue; ep++) {
      createWatchRecord({
        media_id: id,
        [key]: ep,
        watched_at: now,
        is_continuous: 1
      })
    }
  } else if (newValue !== undefined && newValue < oldValue) {
    const idsToDelete = db
      .select({ id: watchRecord.id, episode: watchRecord.episode, chapter: watchRecord.chapter, is_continuous: watchRecord.is_continuous })
      .from(watchRecord)
      .where(eq(watchRecord.media_id, id))
      .all()
      .filter(r => r.is_continuous === 1 && episodeOf(r, key) > newValue)
      .map(r => r.id)
    for (const rid of idsToDelete) {
      db.delete(watchRecord).where(eq(watchRecord.id, rid)).run()
    }
  }

  return getMediaById(id)
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
      watched_at: now,
      is_continuous: 1
    })
  }

  const maxEp = Math.max(...episodes)
  db.update(media).set({ current_progress: { [key]: maxEp }, updated_at: now }).where(eq(media.id, id)).run()

  return getMediaById(id)
}

export function markSingleEpisode(id: string, episode: number): Media {
  const current = getMediaById(id)
  const key = progressKey(current.type)
  const now = new Date().toISOString()

  createWatchRecord({
    media_id: id,
    [key]: episode,
    watched_at: now,
    is_continuous: 0
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

  const newMax = maxWatchedForMedia(id, key)
  const now = new Date().toISOString()
  db.update(media).set({ current_progress: { [key]: newMax }, updated_at: now }).where(eq(media.id, id)).run()

  return getMediaById(id)
}

export function updateStatus(id: string, status: Status): Media {
  getMediaById(id)
  if (!isStatus(status)) throw new HttpError(400, ERROR_MESSAGES.INVALID_STATUS)

  const now = new Date().toISOString()
  db.update(media).set({ status, updated_at: now }).where(eq(media.id, id)).run()

  return getMediaById(id)
}
