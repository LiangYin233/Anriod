import type {
  CreateWatchRecordInput,
  PaginatedResponse,
  UpdateWatchRecordInput,
  WatchRecord
} from '@anriod/shared'
import { count, desc, eq, getTableColumns } from 'drizzle-orm'
import { DEFAULT_PAGE, DEFAULT_LIMIT, MAX_PAGE, MAX_LIMIT, ERROR_MESSAGES } from '../constants'
import { db } from '../db/client'
import { media, watchRecord, type NewWatchRecordRow } from '../db/schema'
import { HttpError } from '../middleware/error'
import { toInt } from '../utils/http'

function assertMediaExists(mediaId: string) {
  const mediaRow = db.select({ id: media.id }).from(media).where(eq(media.id, mediaId)).get()
  if (!mediaRow) throw new HttpError(404, ERROR_MESSAGES.MEDIA_NOT_FOUND)
}

function recordWithMediaTitle() {
  return db
    .select({
      ...getTableColumns(watchRecord),
      media_title: media.title
    })
    .from(watchRecord)
    .innerJoin(media, eq(media.id, watchRecord.media_id))
}

export function listRecords(query: { page?: number; limit?: number; media_id?: string }): PaginatedResponse<WatchRecord> {
  const page = toInt(query.page, DEFAULT_PAGE, DEFAULT_PAGE, MAX_PAGE)
  const limit = toInt(query.limit, DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT)
  const offset = (page - 1) * limit
  const whereClause = query.media_id ? eq(watchRecord.media_id, query.media_id) : undefined

  const total = db
    .select({ total: count() })
    .from(watchRecord)
    .where(whereClause)
    .get()?.total ?? 0

  const rows = recordWithMediaTitle()
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

export function getRecordById(id: number): WatchRecord {
  const row = recordWithMediaTitle()
    .where(eq(watchRecord.id, id))
    .get() as WatchRecord | undefined

  if (!row) throw new HttpError(404, ERROR_MESSAGES.RECORD_NOT_FOUND)
  return row
}

export function listRecordsForMedia(mediaId: string): WatchRecord[] {
  assertMediaExists(mediaId)
  return recordWithMediaTitle()
    .where(eq(watchRecord.media_id, mediaId))
    .orderBy(desc(watchRecord.watched_at))
    .all() as WatchRecord[]
}

export function createWatchRecord(input: CreateWatchRecordInput): WatchRecord {
  assertMediaExists(input.media_id)

  const now = new Date().toISOString()
  const watchedAt = input.watched_at ?? now
  const values: NewWatchRecordRow = {
    media_id: input.media_id,
    episode: input.episode ?? null,
    chapter: input.chapter ?? null,
    watched_at: watchedAt,
    is_continuous: input.is_continuous ?? 1,
    created_at: now
  }

  const inserted = db.insert(watchRecord).values(values).returning({ id: watchRecord.id }).get()
  if (!inserted) throw new HttpError(500, ERROR_MESSAGES.RECORD_CREATE_FAILED)
  return getRecordById(inserted.id)
}

export function updateWatchRecord(id: number, input: UpdateWatchRecordInput): WatchRecord {
  getRecordById(id)

  const values: Partial<NewWatchRecordRow> = {}
  if (input.episode !== undefined) values.episode = input.episode
  if (input.chapter !== undefined) values.chapter = input.chapter
  if (input.watched_at !== undefined) values.watched_at = input.watched_at
  if (input.is_continuous !== undefined) values.is_continuous = input.is_continuous
  if (Object.keys(values).length > 0) {
    db.update(watchRecord).set(values).where(eq(watchRecord.id, id)).run()
  }

  return getRecordById(id)
}

export function deleteWatchRecord(id: number) {
  getRecordById(id)
  db.delete(watchRecord).where(eq(watchRecord.id, id)).run()
}
