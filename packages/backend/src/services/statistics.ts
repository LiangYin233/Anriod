import type { MediaType, StatisticsOverview, Status, TagStatistic, TimelinePoint } from '@anriod/shared'
import { MEDIA_TYPE_VALUES, STATUS_VALUES } from '@anriod/shared'
import { asc, count, desc, eq, isNotNull } from 'drizzle-orm'
import { db } from '../db/client'
import { media, mediaTags, tags, watchHistory } from '../db/schema'

function zeroRecord<T extends string>(keys: readonly T[]): Record<T, number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<T, number>
}

export function getOverview(): StatisticsOverview {
  const byStatus = zeroRecord<Status>(STATUS_VALUES)
  const byType = zeroRecord<MediaType>(MEDIA_TYPE_VALUES)

  for (const row of db.select({ status: media.status, count: count() }).from(media).groupBy(media.status).all()) {
    byStatus[row.status] = row.count
  }

  for (const row of db.select({ type: media.type, count: count() }).from(media).groupBy(media.type).all()) {
    byType[row.type] = row.count
  }

  const total = db.select({ total: count() }).from(media).get()?.total ?? 0

  // Rating stats
  const ratings = db
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

  // Standard deviation
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

export function getTimeline(): TimelinePoint[] {
  const countsByPeriod = new Map<string, number>()
  const rows = db
    .select({ started_at: watchHistory.started_at, completed_at: watchHistory.completed_at })
    .from(watchHistory)
    .all()

  for (const row of rows) {
    const period = (row.completed_at ?? row.started_at).slice(0, 7)
    countsByPeriod.set(period, (countsByPeriod.get(period) ?? 0) + 1)
  }

  return [...countsByPeriod.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([period, count]) => ({ period, count }))
}

export function getTagStatistics(): TagStatistic[] {
  const mediaCount = count(mediaTags.media_id)

  return db
    .select({ tag: tags.name, count: mediaCount })
    .from(tags)
    .leftJoin(mediaTags, eq(mediaTags.tag_id, tags.id))
    .groupBy(tags.id)
    .orderBy(desc(mediaCount), asc(tags.name))
    .all()
}

export function getRatingDistribution(): Array<{ rating: number; count: number }> {
  // Round to nearest integer for binning
  const countsByRating = new Map<number, number>()
  const ratings = db
    .select({ rating: media.rating })
    .from(media)
    .where(isNotNull(media.rating))
    .all()
    .map((row) => row.rating)
    .filter((rating): rating is number => rating !== null)

  for (const rating of ratings) {
    const roundedRating = Math.round(rating)
    countsByRating.set(roundedRating, (countsByRating.get(roundedRating) ?? 0) + 1)
  }

  return [...countsByRating.entries()]
    .sort(([left], [right]) => left - right)
    .map(([rating, count]) => ({ rating, count }))
}
