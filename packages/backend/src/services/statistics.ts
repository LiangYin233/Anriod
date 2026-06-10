import type { MediaType, StatisticsOverview, Status, TagStatistic, TimelinePoint } from '@anriod/shared'
import { MEDIA_TYPE_VALUES, STATUS_VALUES } from '@anriod/shared'
import { all, get } from '../db/helpers'

function zeroRecord<T extends string>(keys: readonly T[]): Record<T, number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<T, number>
}

export function getOverview(): StatisticsOverview {
  const byStatus = zeroRecord<Status>(STATUS_VALUES)
  const byType = zeroRecord<MediaType>(MEDIA_TYPE_VALUES)

  for (const row of all<{ status: Status; count: number }>('SELECT status, COUNT(*) AS count FROM media GROUP BY status')) {
    byStatus[row.status] = row.count
  }

  for (const row of all<{ type: MediaType; count: number }>('SELECT type, COUNT(*) AS count FROM media GROUP BY type')) {
    byType[row.type] = row.count
  }

  const total = get<{ total: number }>('SELECT COUNT(*) AS total FROM media')?.total ?? 0

  // Rating stats
  const ratings = all<{ rating: number }>('SELECT rating FROM media WHERE rating IS NOT NULL')
  const ratedCount = ratings.length
  const avgRating = ratedCount > 0
    ? ratings.reduce((s, r) => s + r.rating, 0) / ratedCount
    : null

  // Standard deviation
  let stddev: number | null = null
  if (ratedCount > 1 && avgRating !== null) {
    const variance = ratings.reduce((s, r) => s + (r.rating - avgRating) ** 2, 0) / ratedCount
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
  return all<TimelinePoint>(
    `SELECT substr(COALESCE(completed_at, started_at), 1, 7) AS period, COUNT(*) AS count
     FROM watch_history
     GROUP BY period
     ORDER BY period ASC`
  )
}

export function getTagStatistics(): TagStatistic[] {
  return all<TagStatistic>(
    `SELECT t.name AS tag, COUNT(mt.media_id) AS count
     FROM tags t
     LEFT JOIN media_tags mt ON mt.tag_id = t.id
     GROUP BY t.id
     ORDER BY count DESC, t.name ASC`
  )
}

export function getRatingDistribution(): Array<{ rating: number; count: number }> {
  // Round to nearest integer for binning
  return all<{ rating: number; count: number }>(
    `SELECT CAST(ROUND(rating) AS INTEGER) AS rating, COUNT(*) AS count
     FROM media
     WHERE rating IS NOT NULL
     GROUP BY rating
     ORDER BY rating ASC`
  )
}
