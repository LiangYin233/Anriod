import type { ListMediaQuery, Media, MediaProgress, PaginatedResponse } from '@anriod/shared'
import { and, asc, count, desc, eq, exists, gte, inArray, lte, sql, type SQL } from 'drizzle-orm'
import { DEFAULT_LIMIT, DEFAULT_PAGE, ERROR_MESSAGES, MAX_LIMIT, MAX_PAGE } from '../../constants'
import { db } from '../../db/client'
import { media, mediaTags, tags, watchRecord } from '../../db/schema'
import { HttpError } from '../../middleware/error'
import { isMediaType, isStatus, toInt } from '../../utils/http'
import { getTagsForMediaBatch } from '../tag'
import { rowToMedia } from './mapper'

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

  const tagsMap = getTagsForMediaBatch(rows.map((row) => row.id))

  const progressMap = new Map<string, MediaProgress>()
  if (rows.length > 0) {
    const mediaIds = rows.map((r) => r.id)
    const aggs = db
      .select({
        media_id: watchRecord.media_id,
        max_episode: sql<number>`MAX(${watchRecord.episode})`,
        max_chapter: sql<number>`MAX(${watchRecord.chapter})`
      })
      .from(watchRecord)
      .where(inArray(watchRecord.media_id, mediaIds))
      .groupBy(watchRecord.media_id)
      .all()

    const typeMap = new Map(rows.map((r) => [r.id, r.type]))
    const CHAPTER_TYPES = new Set(['novel', 'manga'])
    for (const agg of aggs) {
      const type = typeMap.get(agg.media_id) ?? ''
      const isChapter = CHAPTER_TYPES.has(type)
      if (isChapter && agg.max_chapter != null && agg.max_chapter > 0) {
        progressMap.set(agg.media_id, { chapter: agg.max_chapter })
      } else if (!isChapter && agg.max_episode != null && agg.max_episode > 0) {
        progressMap.set(agg.media_id, { episode: agg.max_episode })
      }
    }
  }

  return {
    data: rows.map((row) => rowToMedia(row, tagsMap, progressMap)),
    pagination: { page, limit, total },
    status_counts: statusCounts
  }
}
