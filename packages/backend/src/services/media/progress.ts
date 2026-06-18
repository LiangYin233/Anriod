import type { Media, MediaProgress, Status } from '@anriod/shared'
import { desc, eq, inArray } from 'drizzle-orm'
import { ERROR_MESSAGES } from '../../constants'
import { db } from '../../db/client'
import { media, watchHistory } from '../../db/schema'
import { HttpError } from '../../middleware/error'
import { isStatus } from '../../utils/http'
import { createWatchHistory } from '../history'
import { getMediaById } from './crud'

function isChapterBased(type: string): boolean {
  return type === 'novel' || type === 'manga'
}

function progressKey(type: string): 'chapter' | 'episode' {
  return isChapterBased(type) ? 'chapter' : 'episode'
}

function episodeOf(entry: { progress_to: MediaProgress | null }, key: 'chapter' | 'episode'): number {
  return (entry.progress_to?.[key] as number | undefined) ?? 0
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
      createWatchHistory({
        media_id: id,
        started_at: now,
        completed_at: now,
        progress_from: null,
        progress_to: { [key]: ep },
        rating: null
      })
    }
  } else if (newValue !== undefined && newValue < oldValue) {
    const historyIdsToDelete = db
      .select({ id: watchHistory.id, progress_to: watchHistory.progress_to })
      .from(watchHistory)
      .where(eq(watchHistory.media_id, id))
      .all()
      .filter((entry) => episodeOf(entry, key) > newValue)
      .map((entry) => entry.id)

    if (historyIdsToDelete.length > 0) {
      db.delete(watchHistory).where(inArray(watchHistory.id, historyIdsToDelete)).run()
    }
  }

  return getMediaById(id)
}

export function markEpisodesWatched(id: string, episodes: number[]): Media {
  const current = getMediaById(id)
  const key = progressKey(current.type)
  const now = new Date().toISOString()

  for (const ep of episodes) {
    createWatchHistory({
      media_id: id,
      started_at: now,
      completed_at: now,
      progress_from: null,
      progress_to: { [key]: ep },
      rating: null
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

  createWatchHistory({
    media_id: id,
    started_at: now,
    completed_at: now,
    progress_from: null,
    progress_to: { [key]: episode },
    rating: null
  })

  return getMediaById(id)
}

export function undoEpisodeWatch(id: string, episode: number): Media {
  const current = getMediaById(id)
  const key = progressKey(current.type)

  const entry = db
    .select({ id: watchHistory.id, progress_to: watchHistory.progress_to })
    .from(watchHistory)
    .where(eq(watchHistory.media_id, id))
    .all()
    .find((e) => episodeOf(e, key) === episode)

  if (entry) {
    db.delete(watchHistory).where(eq(watchHistory.id, entry.id)).run()
  }

  const remaining = db
    .select({ progress_to: watchHistory.progress_to })
    .from(watchHistory)
    .where(eq(watchHistory.media_id, id))
    .all()

  const maxWatched = remaining.length > 0
    ? Math.max(...remaining.map((e) => episodeOf(e, key)))
    : 0

  const now = new Date().toISOString()
  db.update(media).set({ current_progress: { [key]: maxWatched }, updated_at: now }).where(eq(media.id, id)).run()

  return getMediaById(id)
}

export function updateStatus(id: string, status: Status): Media {
  const current = getMediaById(id)
  if (!isStatus(status)) throw new HttpError(400, ERROR_MESSAGES.INVALID_STATUS)

  const now = new Date().toISOString()
  db.update(media).set({ status, updated_at: now }).where(eq(media.id, id)).run()

  if (status === 'completed' && current.status !== 'completed') {
    const lastHistory = db
      .select({ started_at: watchHistory.started_at })
      .from(watchHistory)
      .where(eq(watchHistory.media_id, id))
      .orderBy(desc(watchHistory.started_at))
      .limit(1)
      .get()

    createWatchHistory({
      media_id: id,
      started_at: lastHistory?.started_at ?? current.created_at,
      completed_at: now,
      progress_from: null,
      progress_to: current.current_progress,
      rating: current.rating
    })
  }

  if (status === 'watching' && current.status !== 'watching') {
    createWatchHistory({
      media_id: id,
      started_at: now,
      completed_at: null,
      progress_from: current.current_progress,
      progress_to: null,
      rating: null
    })
  }

  return getMediaById(id)
}
