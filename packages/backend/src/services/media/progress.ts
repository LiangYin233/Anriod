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

export function updateProgress(id: string, progress: MediaProgress, startedAt?: string | null): Media {
  const current = getMediaById(id)
  const now = startedAt || new Date().toISOString()
  const useChapter = isChapterBased(current.type)
  const progressKey = useChapter ? 'chapter' : 'episode'

  db.update(media).set({ current_progress: progress, updated_at: now }).where(eq(media.id, id)).run()

  const newValue = progress[progressKey] as number | undefined
  const oldValue = (current.current_progress?.[progressKey] as number | undefined) ?? 0
  if (newValue !== undefined && newValue > oldValue) {
    for (let progressValue = oldValue + 1; progressValue <= newValue; progressValue++) {
      const valueProgress = { [progressKey]: progressValue }
      createWatchHistory({
        media_id: id,
        started_at: now,
        completed_at: now,
        progress_from: { [progressKey]: progressValue - 1 },
        progress_to: valueProgress,
        rating: null
      })
    }
  } else if (newValue !== undefined && newValue < oldValue) {
    const historyIdsToDelete = db
      .select({ id: watchHistory.id, progress_to: watchHistory.progress_to })
      .from(watchHistory)
      .where(eq(watchHistory.media_id, id))
      .all()
      .filter((entry) => ((entry.progress_to?.[progressKey] as number | undefined) ?? 0) > newValue)
      .map((entry) => entry.id)

    if (historyIdsToDelete.length > 0) {
      db.delete(watchHistory).where(inArray(watchHistory.id, historyIdsToDelete)).run()
    }
  }

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
