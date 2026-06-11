import type {
  CreateWatchHistoryInput,
  MediaProgress,
  PaginatedResponse,
  UpdateWatchHistoryInput,
  WatchHistory
} from '@anriod/shared'
import { all, get, run, type SqlValue } from '../db/helpers'
import { HttpError } from '../middleware/error'
import { jsonString, parseJsonField, toInt } from '../utils/http'
import { DEFAULT_PAGE, DEFAULT_LIMIT, MAX_PAGE, MAX_LIMIT, ERROR_MESSAGES } from '../constants'

interface HistoryRow {
  id: number
  media_id: string
  media_title?: string
  started_at: string
  completed_at: string | null
  progress_from: string | null
  progress_to: string | null
  rating: number | null
  notes: string | null
  created_at: string
}

function rowToHistory(row: HistoryRow): WatchHistory {
  return {
    ...row,
    progress_from: parseJsonField<MediaProgress>(row.progress_from),
    progress_to: parseJsonField<MediaProgress>(row.progress_to)
  }
}

function assertMediaExists(mediaId: string) {
  const media = get<{ id: string }>('SELECT id FROM media WHERE id = ?', [mediaId])
  if (!media) throw new HttpError(404, ERROR_MESSAGES.MEDIA_NOT_FOUND)
}

export function listHistory(query: { page?: number; limit?: number; media_id?: string }): PaginatedResponse<WatchHistory> {
  const page = toInt(query.page, DEFAULT_PAGE, DEFAULT_PAGE, MAX_PAGE)
  const limit = toInt(query.limit, DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT)
  const offset = (page - 1) * limit
  const where: string[] = []
  const params: SqlValue[] = []

  if (query.media_id) {
    where.push('wh.media_id = ?')
    params.push(query.media_id)
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''
  const total = get<{ total: number }>(`SELECT COUNT(*) AS total FROM watch_history wh ${whereSql}`, params)?.total ?? 0
  const rows = all<HistoryRow>(
    `SELECT wh.*, m.title AS media_title
     FROM watch_history wh
     INNER JOIN media m ON m.id = wh.media_id
     ${whereSql}
     ORDER BY wh.started_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  )

  return {
    data: rows.map(rowToHistory),
    pagination: { page, limit, total }
  }
}

export function getHistoryById(id: number): WatchHistory {
  const row = get<HistoryRow>(
    `SELECT wh.*, m.title AS media_title
     FROM watch_history wh
     INNER JOIN media m ON m.id = wh.media_id
     WHERE wh.id = ?`,
    [id]
  )
  if (!row) throw new HttpError(404, ERROR_MESSAGES.HISTORY_NOT_FOUND)
  return rowToHistory(row)
}

export function listHistoryForMedia(mediaId: string): WatchHistory[] {
  assertMediaExists(mediaId)
  return all<HistoryRow>(
    `SELECT wh.*, m.title AS media_title
     FROM watch_history wh
     INNER JOIN media m ON m.id = wh.media_id
     WHERE wh.media_id = ?
     ORDER BY wh.started_at DESC`,
    [mediaId]
  ).map(rowToHistory)
}

export function createWatchHistory(input: CreateWatchHistoryInput): WatchHistory {
  assertMediaExists(input.media_id)

  const startedAt = input.started_at ?? new Date().toISOString()
  run(
    `INSERT INTO watch_history (
      media_id, started_at, completed_at, progress_from, progress_to, rating, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      input.media_id,
      startedAt,
      input.completed_at ?? null,
      jsonString(input.progress_from),
      jsonString(input.progress_to),
      input.rating ?? null,
      input.notes ?? null
    ]
  )

  const id = get<{ id: number }>('SELECT last_insert_rowid() AS id')?.id
  if (!id) throw new HttpError(500, ERROR_MESSAGES.HISTORY_CREATE_FAILED)
  return getHistoryById(id)
}

export function updateWatchHistory(id: number, input: UpdateWatchHistoryInput): WatchHistory {
  getHistoryById(id)

  const fields: string[] = []
  const values: SqlValue[] = []
  const mapping: Record<string, SqlValue | undefined> = {
    started_at: input.started_at,
    completed_at: input.completed_at,
    progress_from: input.progress_from === undefined ? undefined : jsonString(input.progress_from),
    progress_to: input.progress_to === undefined ? undefined : jsonString(input.progress_to),
    rating: input.rating,
    notes: input.notes
  }

  for (const [field, value] of Object.entries(mapping)) {
    if (value !== undefined) {
      fields.push(`${field} = ?`)
      values.push(value)
    }
  }

  if (fields.length > 0) {
    run(`UPDATE watch_history SET ${fields.join(', ')} WHERE id = ?`, [...values, id])
  }

  return getHistoryById(id)
}

export function deleteWatchHistory(id: number) {
  getHistoryById(id)
  run('DELETE FROM watch_history WHERE id = ?', [id])
}
