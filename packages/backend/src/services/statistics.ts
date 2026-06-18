import type { MediaType, StatisticsOverview, Status, TagStatistic, TimelinePoint } from '@anriod/shared'
import { MEDIA_TYPE_VALUES, STATUS_VALUES } from '@anriod/shared'
import { asc, count, desc, eq, isNotNull, sql } from 'drizzle-orm'
import { db, type AppDbExecutor } from '../db/client'
import { media, mediaTags, tags, watchRecord } from '../db/schema'

function zeroRecord<T extends string>(keys: readonly T[]): Record<T, number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<T, number>
}

export function getOverview(database: AppDbExecutor = db): StatisticsOverview {
  const byStatus = zeroRecord<Status>(STATUS_VALUES)
  const byType = zeroRecord<MediaType>(MEDIA_TYPE_VALUES)

  for (const row of database.select({ status: media.status, count: count() }).from(media).groupBy(media.status).all()) {
    byStatus[row.status] = row.count
  }

  for (const row of database.select({ type: media.type, count: count() }).from(media).groupBy(media.type).all()) {
    byType[row.type] = row.count
  }

  const total = database.select({ total: count() }).from(media).get()?.total ?? 0

  const ratings = database
    .select({ rating: media.rating })
    .from(media)
    .where(isNotNull(media.rating))
    .all()
    .map((row) => row.rating)
    .filter((rating): rating is number => rating !== null)
  const ratedCount = ratings.length
  const avgRating = ratedCount > 0
    ? ratings.reduce((sum, rating) => sum + rating, 0) / ratedCount
    : null

  let stddev: number | null = null
  if (ratedCount > 1 && avgRating !== null) {
    const variance = ratings.reduce((sum, rating) => sum + (rating - avgRating) ** 2, 0) / ratedCount
    stddev = Math.sqrt(variance)
  }

  return {
    total,
    by_status: byStatus,
    by_type: byType,
    completed: byStatus.completed,
    watching: byStatus.watching,
    average_rating: avgRating,
    rated_count: ratedCount,
    rating_stddev: stddev
  }
}

export function getTimeline(database: AppDbExecutor = db): TimelinePoint[] {
  return database
    .select({
      period: sql<string>`strftime('%Y-%m', ${watchRecord.watched_at})`,
      count: count()
    })
    .from(watchRecord)
    .groupBy(sql`strftime('%Y-%m', ${watchRecord.watched_at})`)
    .orderBy(sql`strftime('%Y-%m', ${watchRecord.watched_at})`)
    .all()
    .map((row) => ({ period: row.period, count: row.count }))
}

export function getTagStatistics(database: AppDbExecutor = db): TagStatistic[] {
  const mediaCount = count(mediaTags.media_id)

  return database
    .select({ tag: tags.name, count: mediaCount })
    .from(tags)
    .leftJoin(mediaTags, eq(mediaTags.tag_id, tags.id))
    .groupBy(tags.id)
    .orderBy(desc(mediaCount), asc(tags.name))
    .all()
}

export function getRatingDistribution(database: AppDbExecutor = db): Array<{ rating: number; count: number }> {
  return database
    .select({
      rating: sql<number>`ROUND(${media.rating})`,
      count: count()
    })
    .from(media)
    .where(isNotNull(media.rating))
    .groupBy(sql`ROUND(${media.rating})`)
    .orderBy(sql`ROUND(${media.rating})`)
    .all()
    .map((row) => ({ rating: row.rating, count: row.count }))
}
