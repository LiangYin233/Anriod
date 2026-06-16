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
import { and, asc, count, desc, eq, exists, gte, inArray, lte, sql, type SQL } from 'drizzle-orm'
import { config } from '../config'
import { DEFAULT_PAGE, DEFAULT_LIMIT, MAX_PAGE, MAX_LIMIT, MIN_RATING, MAX_RATING, ERROR_MESSAGES } from '../constants'
import { db } from '../db/client'
import { media, mediaTags, tags, watchHistory, type MediaRow, type NewMediaRow } from '../db/schema'
import { getDataSource } from '../datasources/registry'
import { HttpError } from '../middleware/error'
import { isMediaType, isStatus, toInt } from '../utils/http'
import { downloadQueue } from '../utils/download-queue'
import { getTagsForMedia, getTagsForMediaBatch, setTagsForMedia } from './tag'
import { createWatchHistory } from './history'

const SORT_FIELDS = {
  title: media.title,
  rating: media.rating,
  created_at: media.created_at,
  updated_at: media.updated_at,
  air_date: media.air_date
} as const

type SortField = keyof typeof SORT_FIELDS

function parseSort(sort = 'updated_at:desc'): { field: SortField; direction: 'asc' | 'desc' } {
  const [requestedField = 'updated_at', requestedDirection = 'desc'] = sort.split(':')
  const field = requestedField in SORT_FIELDS ? requestedField as SortField : 'updated_at'
  const direction = requestedDirection.toLowerCase() === 'asc' ? 'asc' : 'desc'
  return { field, direction }
}

function rowToMedia(row: MediaRow, tagsMap?: Map<string, string[]>): Media {
  return {
    ...row,
    tags: tagsMap?.get(row.id) ?? getTagsForMedia(row.id)
  }
}

function normalizeMediaInput(input: CreateMediaInput | UpdateMediaInput): Partial<NewMediaRow> {
  const internalInput = input as UpdateMediaInput & { synced_at?: string | null }
  const values: Partial<NewMediaRow> = {}

  if (input.title !== undefined) values.title = input.title
  if (input.type !== undefined) values.type = input.type
  if (input.status !== undefined) values.status = input.status
  if (input.rating !== undefined) values.rating = input.rating
  if (input.notes !== undefined) values.notes = input.notes
  if (input.current_progress !== undefined) values.current_progress = input.current_progress
  if (input.cover_url !== undefined) values.cover_url = input.cover_url
  if (input.description !== undefined) values.description = input.description
  if (input.external_rating !== undefined) values.external_rating = input.external_rating
  if (input.air_date !== undefined) values.air_date = input.air_date
  if (input.total_episodes !== undefined) values.total_episodes = input.total_episodes
  if (input.studio !== undefined) values.studio = input.studio
  if (input.source_metadata !== undefined) values.source_metadata = input.source_metadata
  if (input.source !== undefined) values.source = input.source
  if (input.source_id !== undefined) values.source_id = input.source_id
  if (input.source_url !== undefined) values.source_url = input.source_url
  if (internalInput.synced_at !== undefined) values.synced_at = internalInput.synced_at

  return values
}

function createMediaValues(id: string, input: CreateMediaInput): NewMediaRow {
  const now = new Date().toISOString()

  return {
    id,
    title: input.title,
    type: input.type,
    status: input.status ?? 'plan_to_watch',
    rating: input.rating ?? null,
    notes: input.notes ?? null,
    current_progress: input.current_progress ?? null,
    cover_url: input.cover_url ?? null,
    description: input.description ?? null,
    external_rating: input.external_rating ?? null,
    air_date: input.air_date ?? null,
    total_episodes: input.total_episodes ?? null,
    studio: input.studio ?? null,
    source_metadata: input.source_metadata ?? null,
    source: input.source ?? null,
    source_id: input.source_id ?? null,
    source_url: input.source_url ?? null,
    synced_at: null,
    created_at: now,
    updated_at: now
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

function buildSort(sort = 'updated_at:desc'): SQL {
  const { field, direction } = parseSort(sort)
  const column = SORT_FIELDS[field]
  return direction === 'asc' ? asc(column) : desc(column)
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&')
}

function buildMediaWhere(query: ListMediaQuery): SQL | undefined {
  const conditions: SQL[] = []

  if (query.type) {
    if (!isMediaType(query.type)) throw new HttpError(400, ERROR_MESSAGES.INVALID_MEDIA_TYPE)
    conditions.push(eq(media.type, query.type))
  }

  if (query.status) {
    if (!isStatus(query.status)) throw new HttpError(400, ERROR_MESSAGES.INVALID_STATUS)
    conditions.push(eq(media.status, query.status))
  }

  if (query.source) {
    conditions.push(eq(media.source, query.source))
  }

  if (query.q) {
    conditions.push(sql`lower(${media.title}) LIKE ${`%${escapeLikePattern(query.q.toLowerCase())}%`} ESCAPE '\\'`)
  }

  if (query.tag) {
    conditions.push(
      exists(
        db
          .select({ media_id: mediaTags.media_id })
          .from(mediaTags)
          .innerJoin(tags, eq(tags.id, mediaTags.tag_id))
          .where(and(eq(mediaTags.media_id, media.id), eq(tags.name, query.tag)))
      )
    )
  }

  if (query.air_date_from) {
    conditions.push(gte(media.air_date, query.air_date_from))
  }

  if (query.air_date_to) {
    conditions.push(lte(media.air_date, query.air_date_to))
  }

  if (query.ep_min !== undefined) {
    conditions.push(gte(media.total_episodes, query.ep_min))
  }

  if (query.ep_max !== undefined) {
    conditions.push(lte(media.total_episodes, query.ep_max))
  }

  return conditions.length > 0 ? and(...conditions) : undefined
}

export function listMedia(query: ListMediaQuery): PaginatedResponse<Media> {
  const page = toInt(query.page, DEFAULT_PAGE, DEFAULT_PAGE, MAX_PAGE)
  const limit = toInt(query.limit, DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT)
  const offset = (page - 1) * limit
  const whereClause = buildMediaWhere(query)

  const total = db
    .select({ total: count() })
    .from(media)
    .where(whereClause)
    .get()?.total ?? 0

  // Status counts for ALL matching records (not just current page)
  const statusCounts = db
    .select({ status: media.status, count: count() })
    .from(media)
    .where(whereClause)
    .groupBy(media.status)
    .all()
    .reduce((accumulator, row) => {
      accumulator[row.status] = row.count
      return accumulator
    }, {} as Record<string, number>)

  const rows = db
    .select()
    .from(media)
    .where(whereClause)
    .orderBy(buildSort(query.sort))
    .limit(limit)
    .offset(offset)
    .all()

  // Batch-load tags in a single query (avoids N+1)
  const tagsMap = getTagsForMediaBatch(rows.map((row) => row.id))

  return {
    data: rows.map((row) => rowToMedia(row, tagsMap)),
    pagination: { page, limit, total },
    status_counts: statusCounts
  }
}

export function getMediaById(id: string): Media {
  const row = db.select().from(media).where(eq(media.id, id)).get()
  if (!row) throw new HttpError(404, ERROR_MESSAGES.MEDIA_NOT_FOUND)
  return rowToMedia(row)
}

export function createMedia(input: CreateMediaInput): Media {
  validateMediaInput(input)

  const existing = db
    .select({ id: media.id })
    .from(media)
    .where(and(eq(media.title, input.title.trim()), eq(media.type, input.type)))
    .get()
  if (existing) throw new HttpError(409, 'Duplicate entry')

  const id = crypto.randomUUID()
  const values = createMediaValues(id, input)

  db.transaction((transaction) => {
    transaction.insert(media).values(values).run()
    setTagsForMedia(id, input.tags, transaction)
  })

  return getMediaById(id)
}

export function updateMedia(id: string, input: UpdateMediaInput): Media {
  getMediaById(id)
  validateMediaInput(input, true)

  const values = normalizeMediaInput(input)
  const hasMediaChanges = Object.keys(values).length > 0
  if (hasMediaChanges) values.updated_at = new Date().toISOString()

  if (hasMediaChanges || input.tags !== undefined) {
    db.transaction((transaction) => {
      if (hasMediaChanges) {
        transaction.update(media).set(values).where(eq(media.id, id)).run()
      }

      if (input.tags !== undefined) {
        setTagsForMedia(id, input.tags, transaction)
      }
    })
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
  db.delete(media).where(eq(media.id, id)).run()
}

function isChapterBased(type: string): boolean {
  return type === 'novel' || type === 'manga'
}

export function updateProgress(id: string, progress: MediaProgress, notes?: string | null, startedAt?: string | null): Media {
  const current = getMediaById(id)
  const now = startedAt || new Date().toISOString()
  const useChapter = isChapterBased(current.type)
  const progressKey = useChapter ? 'chapter' : 'episode'

  db.update(media).set({ current_progress: progress, updated_at: now }).where(eq(media.id, id)).run()

  const newValue = progress[progressKey] as number | undefined
  const oldValue = (current.current_progress?.[progressKey] as number | undefined) ?? 0
  if (newValue !== undefined && newValue > oldValue) {
    // Create a discrete entry for each episode/chapter watched
    for (let progressValue = oldValue + 1; progressValue <= newValue; progressValue++) {
      const valueProgress = { [progressKey]: progressValue }
      createWatchHistory({
        media_id: id,
        started_at: now,
        completed_at: now,
        progress_from: { [progressKey]: progressValue - 1 },
        progress_to: valueProgress,
        rating: null,
        notes: progressValue === newValue ? (notes ?? null) : null
      })
    }
  } else if (newValue !== undefined && newValue < oldValue) {
    // User decreased count — delete entries beyond new value
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
    // Find the most recent watch-history entry for this media to use as session start
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
  const mediaItem = createMedia({
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
      mediaId: mediaItem.id,
      coverUrl: details.cover_url,
      savePath: `${config.coversDir}/${mediaItem.id}`
    })
  }

  return mediaItem
}

export async function syncMedia(id: string): Promise<Media> {
  const mediaItem = getMediaById(id)
  if (!mediaItem.source || !mediaItem.source_id) throw new HttpError(400, ERROR_MESSAGES.MEDIA_NO_SOURCE)

  const dataSource = getDataSource(mediaItem.source)
  if (!dataSource) throw new HttpError(400, ERROR_MESSAGES.UNKNOWN_DATA_SOURCE)

  const details = await dataSource.getDetails(mediaItem.source_id, mediaItem.type)
  return updateMedia(id, {
    external_rating: details.external_rating ?? null,
    air_date: details.air_date ?? null,
    total_episodes: details.total_episodes ?? null,
    source_metadata: details.raw_metadata,
    source_url: details.source_url ?? null,
    synced_at: new Date().toISOString()
  } as UpdateMediaInput & { synced_at: string })
}
