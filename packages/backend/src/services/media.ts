import type {
  CreateMediaInput,
  ImportMediaInput,
  ListMediaQuery,
  Media,
  MediaProgress,
  PaginatedResponse,
  Status,
  UpdateMediaInput
} from '@anriod/shared'
import { config } from '../config'
import { DEFAULT_PAGE, DEFAULT_LIMIT, MAX_PAGE, MAX_LIMIT, MIN_RATING, MAX_RATING, ERROR_MESSAGES } from '../constants'
import { all, get, run, transaction, type SqlValue } from '../db/helpers'
import { getDataSource } from '../datasources/registry'
import { HttpError } from '../middleware/error'
import { isMediaType, isStatus, jsonString, parseJsonField, toInt } from '../utils/http'
import { downloadQueue } from '../utils/download-queue'
import { getTagsForMedia, getTagsForMediaBatch, setTagsForMedia } from './tag'
import { createWatchHistory } from './history'

interface MediaRow {
  id: string
  title: string
  type: Media['type']
  status: Media['status']
  rating: number | null
  notes: string | null
  current_progress: string | null
  cover_url: string | null
  description: string | null
  external_rating: number | null
  air_date: string | null
  total_episodes: number | null
  studio: string | null
  source_metadata: string | null
  source: string | null
  source_id: string | null
  source_url: string | null
  synced_at: string | null
  created_at: string
  updated_at: string
}

const SORT_FIELDS: Record<string, string> = {
  title: 'title',
  rating: 'rating',
  created_at: 'created_at',
  updated_at: 'updated_at',
  air_date: 'air_date'
}

const INSERT_FIELDS = [
  'id',
  'title',
  'type',
  'status',
  'rating',
  'notes',
  'current_progress',
  'cover_url',
  'description',
  'external_rating',
  'air_date',
  'total_episodes',
  'studio',
  'source_metadata',
  'source',
  'source_id',
  'source_url',
  'synced_at',
  'updated_at'
] as const

const UPDATE_FIELDS = [
  'title',
  'type',
  'status',
  'rating',
  'notes',
  'current_progress',
  'cover_url',
  'description',
  'external_rating',
  'air_date',
  'total_episodes',
  'studio',
  'source_metadata',
  'source',
  'source_id',
  'source_url',
  'synced_at'
] as const

function rowToMedia(row: MediaRow, tagsMap?: Map<string, string[]>): Media {
  return {
    ...row,
    current_progress: parseJsonField<MediaProgress>(row.current_progress),
    source_metadata: parseJsonField<Record<string, unknown>>(row.source_metadata),
    tags: tagsMap?.get(row.id) ?? getTagsForMedia(row.id)
  }
}

function normalizeMediaInput(input: CreateMediaInput | UpdateMediaInput): Record<string, SqlValue | undefined> {
  const internalInput = input as UpdateMediaInput & { synced_at?: string | null }

  return {
    title: input.title,
    type: input.type,
    status: input.status,
    rating: input.rating,
    notes: input.notes,
    current_progress: input.current_progress === undefined ? undefined : jsonString(input.current_progress),
    cover_url: input.cover_url,
    description: input.description,
    external_rating: input.external_rating,
    air_date: input.air_date,
    total_episodes: input.total_episodes,
    studio: input.studio,
    source_metadata: input.source_metadata === undefined ? undefined : jsonString(input.source_metadata),
    source: input.source,
    source_id: input.source_id,
    source_url: input.source_url,
    synced_at: internalInput.synced_at ?? undefined,
    updated_at: new Date().toISOString()
  }
}

function validateMediaInput(input: CreateMediaInput | UpdateMediaInput, partial = false) {
  if (!partial || input.title !== undefined) {
    if (!input.title?.trim()) throw new HttpError(400, ERROR_MESSAGES.TITLE_REQUIRED)
  }

  if (!partial || input.type !== undefined) {
    if (!isMediaType(input.type)) throw new HttpError(400, ERROR_MESSAGES.INVALID_MEDIA_TYPE)
  }

  if (input.status !== undefined && !isStatus(input.status)) {
    throw new HttpError(400, ERROR_MESSAGES.INVALID_STATUS)
  }

  if (input.rating !== undefined && input.rating !== null && (input.rating < MIN_RATING || input.rating > MAX_RATING)) {
    throw new HttpError(400, ERROR_MESSAGES.INVALID_RATING)
  }
}

function buildSort(sort = 'updated_at:desc'): string {
  const [field = 'updated_at', direction = 'desc'] = sort.split(':')
  const column = SORT_FIELDS[field] ?? 'updated_at'
  const order = direction.toLowerCase() === 'asc' ? 'ASC' : 'DESC'
  // Normalize timestamp format (space→T) so ISO and SQLite formats sort together
  const col = field === 'updated_at' || field === 'created_at'
    ? `REPLACE(${column}, ' ', 'T')`
    : column
  return `${col} ${order}`
}

export function listMedia(query: ListMediaQuery): PaginatedResponse<Media> {
  const page = toInt(query.page, DEFAULT_PAGE, DEFAULT_PAGE, MAX_PAGE)
  const limit = toInt(query.limit, DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT)
  const offset = (page - 1) * limit
  const where: string[] = []
  const params: SqlValue[] = []

  if (query.type) {
    if (!isMediaType(query.type)) throw new HttpError(400, ERROR_MESSAGES.INVALID_MEDIA_TYPE)
    where.push('type = ?')
    params.push(query.type)
  }

  if (query.status) {
    if (!isStatus(query.status)) throw new HttpError(400, ERROR_MESSAGES.INVALID_STATUS)
    where.push('status = ?')
    params.push(query.status)
  }

  if (query.source) {
    where.push('source = ?')
    params.push(query.source)
  }

  if (query.q) {
    const escaped = query.q.replace(/[%_]/g, '\\$&')
    where.push('title LIKE ? ESCAPE ?')
    params.push(`%${escaped}%`, '\\')
  }

  if (query.tag) {
    where.push(`EXISTS (
      SELECT 1 FROM media_tags mt
      INNER JOIN tags t ON t.id = mt.tag_id
      WHERE mt.media_id = media.id AND t.name = ?
    )`)
    params.push(query.tag)
  }

  if (query.air_date_from) {
    where.push('air_date >= ?')
    params.push(query.air_date_from)
  }

  if (query.air_date_to) {
    where.push('air_date <= ?')
    params.push(query.air_date_to)
  }

  if (query.ep_min !== undefined) {
    where.push('total_episodes >= ?')
    params.push(query.ep_min)
  }

  if (query.ep_max !== undefined) {
    where.push('total_episodes <= ?')
    params.push(query.ep_max)
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''
  const total = get<{ total: number }>(`SELECT COUNT(*) AS total FROM media ${whereSql}`, params)?.total ?? 0

  // Status counts for ALL matching records (not just current page)
  const statusCounts = all<{ status: string; count: number }>(
    `SELECT status, COUNT(*) as count FROM media ${whereSql} GROUP BY status`,
    params
  ).reduce((acc, r) => { acc[r.status] = r.count; return acc }, {} as Record<string, number>)

  const rows = all<MediaRow>(`SELECT * FROM media ${whereSql} ORDER BY ${buildSort(query.sort)} LIMIT ? OFFSET ?`, [...params, limit, offset])

  // Batch-load tags in a single query (avoids N+1)
  const tagsMap = getTagsForMediaBatch(rows.map((r) => r.id))

  return {
    data: rows.map((row) => rowToMedia(row, tagsMap)),
    pagination: { page, limit, total },
    status_counts: statusCounts
  }
}

export function getMediaById(id: string): Media {
  const row = get<MediaRow>('SELECT * FROM media WHERE id = ?', [id])
  if (!row) throw new HttpError(404, ERROR_MESSAGES.MEDIA_NOT_FOUND)
  return rowToMedia(row)
}

export function createMedia(input: CreateMediaInput): Media {
  validateMediaInput(input)

  const existing = get<{ id: string }>(
    'SELECT id FROM media WHERE title = ? AND type = ?',
    [input.title.trim(), input.type]
  )
  if (existing) throw new HttpError(409, 'Duplicate entry')

  const id = crypto.randomUUID()
  const normalized = normalizeMediaInput({ ...input, status: input.status ?? 'plan_to_watch' })
  const values = INSERT_FIELDS.map((field) => (field === 'id' ? id : (normalized[field] ?? null)))

  transaction(() => {
    const sql = 'INSERT INTO media (' + INSERT_FIELDS.join(', ') + ') VALUES (' + INSERT_FIELDS.map(() => '?').join(', ') + ')'
    run(sql, values)
    setTagsForMedia(id, input.tags)
  })

  return getMediaById(id)
}

export function updateMedia(id: string, input: UpdateMediaInput): Media {
  getMediaById(id)
  validateMediaInput(input, true)

  const normalized = normalizeMediaInput(input)
  const fields = UPDATE_FIELDS.filter((field) => normalized[field] !== undefined)

  if (fields.length > 0) {
    const values = fields.map((field) => normalized[field] as SqlValue)
    const setClause = fields.map((f) => f + ' = ?').join(', ')
    run(
      'UPDATE media SET ' + setClause + ', updated_at = ? WHERE id = ?',
      [...values, new Date().toISOString(), id]
    )
  }

  if (input.tags !== undefined) {
    setTagsForMedia(id, input.tags)
  }

  // If this update supplied a remote cover_url, trigger local download
  const updated = getMediaById(id)
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

export function deleteMedia(id: string) {
  getMediaById(id)
  run('DELETE FROM media WHERE id = ?', [id])
}

function isChapterBased(type: string): boolean {
  return type === 'novel' || type === 'manga'
}

export function updateProgress(id: string, progress: MediaProgress, notes?: string | null, startedAt?: string | null): Media {
  const current = getMediaById(id)
  const now = startedAt || new Date().toISOString()
  const useChapter = isChapterBased(current.type)
  const field = useChapter ? 'chapter' : 'episode'

  run('UPDATE media SET current_progress = ?, updated_at = ? WHERE id = ?', [jsonString(progress), now, id])

  const newVal = progress[field]
  const oldVal = (current.current_progress?.[field] as number | undefined) ?? 0
  if (newVal !== undefined && newVal > oldVal) {
    // Create a discrete entry for each episode/chapter watched
    for (let v = oldVal + 1; v <= newVal; v++) {
      const valProgress = { [field]: v }
      createWatchHistory({
        media_id: id,
        started_at: now,
        completed_at: now,
        progress_from: { [field]: v - 1 },
        progress_to: valProgress,
        rating: null,
        notes: v === newVal ? (notes ?? null) : null
      })
    }
  } else if (newVal !== undefined && newVal < oldVal) {
    // User decreased count — delete entries beyond new value
    const key = useChapter ? 'chapter' : 'episode'
    run(
      `DELETE FROM watch_history WHERE media_id = ? AND CAST(json_extract(progress_to, '$.${key}') AS INTEGER) > ?`,
      [id, newVal]
    )
  }

  return getMediaById(id)
}

export function updateStatus(id: string, status: Status): Media {
  const current = getMediaById(id)
  if (!isStatus(status)) throw new HttpError(400, ERROR_MESSAGES.INVALID_STATUS)

  const now = new Date().toISOString()
  run('UPDATE media SET status = ?, updated_at = ? WHERE id = ?', [status, now, id])

  if (status === 'completed' && current.status !== 'completed') {
    // Find the most recent watch-history entry for this media to use as session start
    const lastHistory = get<{ started_at: string }>(
      'SELECT started_at FROM watch_history WHERE media_id = ? ORDER BY started_at DESC LIMIT 1',
      [id]
    )

    createWatchHistory({
      media_id: id,
      started_at: lastHistory?.started_at ?? current.created_at,
      completed_at: now,
      progress_from: null,
      progress_to: current.current_progress,
      rating: current.rating,
      notes: current.notes
    })
  }

  if (status === 'watching' && current.status !== 'watching') {
    // Starting a new watch session — create an open-ended history entry
    createWatchHistory({
      media_id: id,
      started_at: now,
      completed_at: null,
      progress_from: current.current_progress,
      progress_to: null,
      rating: null,
      notes: null
    })
  }

  return getMediaById(id)
}

export async function importMedia(input: ImportMediaInput): Promise<Media> {
  const dataSource = getDataSource(input.source)
  if (!dataSource) throw new HttpError(400, ERROR_MESSAGES.UNKNOWN_DATA_SOURCE)

  const details = await dataSource.getDetails(input.source_id, input.type)
  const media = createMedia({
    title: details.title,
    type: details.media_type,
    status: input.status ?? 'plan_to_watch',
    cover_url: details.cover_url,
    description: details.description,
    external_rating: details.external_rating ?? null,
    air_date: details.air_date ?? null,
    total_episodes: details.total_episodes ?? null,
    studio: details.studio ?? null,
    source_metadata: details.raw_metadata,
    source: details.source,
    source_id: details.source_id,
    source_url: details.source_url ?? null
  })

  if (details.cover_url) {
    downloadQueue.add({
      mediaId: media.id,
      coverUrl: details.cover_url,
      savePath: `${config.coversDir}/${media.id}`
    })
  }

  return media
}

export async function syncMedia(id: string): Promise<Media> {
  const media = getMediaById(id)
  if (!media.source || !media.source_id) throw new HttpError(400, ERROR_MESSAGES.MEDIA_NO_SOURCE)

  const dataSource = getDataSource(media.source)
  if (!dataSource) throw new HttpError(400, ERROR_MESSAGES.UNKNOWN_DATA_SOURCE)

  const details = await dataSource.getDetails(media.source_id, media.type)
  return updateMedia(id, {
    external_rating: details.external_rating ?? null,
    air_date: details.air_date ?? null,
    total_episodes: details.total_episodes ?? null,
    source_metadata: details.raw_metadata,
    source_url: details.source_url ?? null,
    synced_at: new Date().toISOString()
  } as UpdateMediaInput & { synced_at: string })
}
