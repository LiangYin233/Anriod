import type {
  CreateWatchRecordInput,
  PaginatedResponse,
  UpdateWatchRecordInput,
  WatchRecord
} from '@anriod/shared'
import { count, desc, eq, getTableColumns } from 'drizzle-orm'
import { DEFAULT_PAGE, DEFAULT_LIMIT, MAX_PAGE, MAX_LIMIT, ERROR_MESSAGES } from '../constants'
import { db, type AppDbExecutor } from '../db/client'
import { media, watchRecord, type NewWatchRecordRow } from '../db/schema'
import { HttpError } from '../middleware/error'
import { toInt } from '../utils/http'

function assertMediaExists(mediaId: string, database: AppDbExecutor) {
  const mediaRow = database.select({ id: media.id }).from(media).where(eq(media.id, mediaId)).get()
  if (!mediaRow) throw new HttpError(404, ERROR_MESSAGES.MEDIA_NOT_FOUND)
}

function recordWithMediaTitle(database: AppDbExecutor) {
  return database
    .select({
      ...getTableColumns(watchRecord),
      media_title: media.title
    })
    .from(watchRecord)
    .innerJoin(media, eq(media.id, watchRecord.media_id))
}

export function listRecords(query: { page?: number; limit?: number; media_id?: string }, database: AppDbExecutor = db): PaginatedResponse<WatchRecord> {
  const page = toInt(query.page, DEFAULT_PAGE, DEFAULT_PAGE, MAX_PAGE)
  const limit = toInt(query.limit, DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT)
  const offset = (page - 1) * limit
  const whereClause = query.media_id ? eq(watchRecord.media_id, query.media_id) : undefined

  const total = database
    .select({ total: count() })
    .from(watchRecord)
    .where(whereClause)
    .get()?.total ?? 0

  const rows = recordWithMediaTitle(database)
    .where(whereClause)
    .orderBy(desc(watchRecord.watched_at))
    .limit(limit)
    .offset(offset)
    .all() as WatchRecord[]

  return {
    data: rows,
    pagination: { page, limit, total }
  }
}

export function getRecordById(id: number, database: AppDbExecutor = db): WatchRecord {
  const row = recordWithMediaTitle(database)
    .where(eq(watchRecord.id, id))
    .get() as WatchRecord | undefined

  if (!row) throw new HttpError(404, ERROR_MESSAGES.RECORD_NOT_FOUND)
  return row
}

export function listRecordsForMedia(mediaId: string, database: AppDbExecutor = db): WatchRecord[] {
  assertMediaExists(mediaId, database)
  return recordWithMediaTitle(database)
    .where(eq(watchRecord.media_id, mediaId))
    .orderBy(desc(watchRecord.watched_at))
    .all() as WatchRecord[]
}

export function createWatchRecord(input: CreateWatchRecordInput, database: AppDbExecutor = db): WatchRecord {
  assertMediaExists(input.media_id, database)

  const now = new Date().toISOString()
  const watchedAt = input.watched_at ?? now
  const values: NewWatchRecordRow = {
    media_id: input.media_id,
    episode: input.episode ?? null,
    chapter: input.chapter ?? null,
    watched_at: watchedAt,
    created_at: now
  }

  const inserted = database.insert(watchRecord).values(values).returning({ id: watchRecord.id }).get()
  if (!inserted) throw new HttpError(500, ERROR_MESSAGES.RECORD_CREATE_FAILED)
  return getRecordById(inserted.id, database)
}

export function updateWatchRecord(id: number, input: UpdateWatchRecordInput, database: AppDbExecutor = db): WatchRecord {
  getRecordById(id, database)

  const values: Partial<NewWatchRecordRow> = {}
  if (input.episode !== undefined) values.episode = input.episode
  if (input.chapter !== undefined) values.chapter = input.chapter
  if (input.watched_at !== undefined) values.watched_at = input.watched_at
  if (Object.keys(values).length > 0) {
    database.update(watchRecord).set(values).where(eq(watchRecord.id, id)).run()
  }

  return getRecordById(id, database)
}

export function deleteWatchRecord(id: number, database: AppDbExecutor = db) {
  getRecordById(id, database)
  database.delete(watchRecord).where(eq(watchRecord.id, id)).run()
}
