import type {
  CreateWatchHistoryInput,
  PaginatedResponse,
  UpdateWatchHistoryInput,
  WatchHistory
} from '@anriod/shared'
import { count, desc, eq, getTableColumns } from 'drizzle-orm'
import { DEFAULT_PAGE, DEFAULT_LIMIT, MAX_PAGE, MAX_LIMIT, ERROR_MESSAGES } from '../constants'
import { db } from '../db/client'
import { media, watchHistory, type NewWatchHistoryRow } from '../db/schema'
import { HttpError } from '../middleware/error'
import { toInt } from '../utils/http'

interface HistoryRow extends WatchHistory {}

function assertMediaExists(mediaId: string) {
  const mediaRow = db.select({ id: media.id }).from(media).where(eq(media.id, mediaId)).get()
  if (!mediaRow) throw new HttpError(404, ERROR_MESSAGES.MEDIA_NOT_FOUND)
}

function historyWithMediaTitle() {
  return db
    .select({
      ...getTableColumns(watchHistory),
      media_title: media.title
    })
    .from(watchHistory)
    .innerJoin(media, eq(media.id, watchHistory.media_id))
}

export function listHistory(query: { page?: number; limit?: number; media_id?: string }): PaginatedResponse<WatchHistory> {
  const page = toInt(query.page, DEFAULT_PAGE, DEFAULT_PAGE, MAX_PAGE)
  const limit = toInt(query.limit, DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT)
  const offset = (page - 1) * limit
  const whereClause = query.media_id ? eq(watchHistory.media_id, query.media_id) : undefined

  const total = db
    .select({ total: count() })
    .from(watchHistory)
    .where(whereClause)
    .get()?.total ?? 0

  const rows = historyWithMediaTitle()
    .where(whereClause)
    .orderBy(desc(watchHistory.started_at))
    .limit(limit)
    .offset(offset)
    .all() as HistoryRow[]

  return {
    data: rows,
    pagination: { page, limit, total }
  }
}

export function getHistoryById(id: number): WatchHistory {
  const row = historyWithMediaTitle()
    .where(eq(watchHistory.id, id))
    .get() as HistoryRow | undefined

  if (!row) throw new HttpError(404, ERROR_MESSAGES.HISTORY_NOT_FOUND)
  return row
}

export function listHistoryForMedia(mediaId: string): WatchHistory[] {
  assertMediaExists(mediaId)
  return historyWithMediaTitle()
    .where(eq(watchHistory.media_id, mediaId))
    .orderBy(desc(watchHistory.started_at))
    .all() as HistoryRow[]
}

export function createWatchHistory(input: CreateWatchHistoryInput): WatchHistory {
  assertMediaExists(input.media_id)

  const now = new Date().toISOString()
  const startedAt = input.started_at ?? now
  const values: NewWatchHistoryRow = {
    media_id: input.media_id,
    started_at: startedAt,
    completed_at: input.completed_at ?? null,
    progress_from: input.progress_from ?? null,
    progress_to: input.progress_to ?? null,
    rating: input.rating ?? null,
    notes: input.notes ?? null,
    created_at: now
  }

  const inserted = db.insert(watchHistory).values(values).returning({ id: watchHistory.id }).get()
  if (!inserted) throw new HttpError(500, ERROR_MESSAGES.HISTORY_CREATE_FAILED)
  return getHistoryById(inserted.id)
}

export function updateWatchHistory(id: number, input: UpdateWatchHistoryInput): WatchHistory {
  getHistoryById(id)

  const values: Partial<NewWatchHistoryRow> = {}
  if (input.started_at !== undefined) values.started_at = input.started_at
  if (input.completed_at !== undefined) values.completed_at = input.completed_at
  if (input.progress_from !== undefined) values.progress_from = input.progress_from
  if (input.progress_to !== undefined) values.progress_to = input.progress_to
  if (input.rating !== undefined) values.rating = input.rating
  if (input.notes !== undefined) values.notes = input.notes

  if (Object.keys(values).length > 0) {
    db.update(watchHistory).set(values).where(eq(watchHistory.id, id)).run()
  }

  return getHistoryById(id)
}

export function deleteWatchHistory(id: number) {
  getHistoryById(id)
  db.delete(watchHistory).where(eq(watchHistory.id, id)).run()
}
