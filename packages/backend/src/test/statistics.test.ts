import { describe, test, expect, beforeAll } from 'bun:test'
import { initTestEnv, clearAllTables } from './helpers'

let createMedia: any, updateStatus: any, updateProgress: any
let getOverview: any, getTimeline: any, getTagStatistics: any, getRatingDistribution: any

beforeAll(async () => {
  await initTestEnv()

  const m = await import('../services/media')
  createMedia = m.createMedia
  updateStatus = m.updateStatus
  updateProgress = m.updateProgress

  const s = await import('../services/statistics')
  getOverview = s.getOverview
  getTimeline = s.getTimeline
  getTagStatistics = s.getTagStatistics
  getRatingDistribution = s.getRatingDistribution
})

describe('statistics — overview empty', () => {
  beforeAll(async () => {
    await clearAllTables()
  })

  test('returns zeros when no media exists', () => {
    const stats = getOverview()
    expect(stats.total).toBe(0)
    expect(stats.completed).toBe(0)
    expect(stats.watching).toBe(0)
    expect(stats.average_rating).toBeNull()
    expect(stats.rated_count).toBe(0)
    expect(stats.rating_stddev).toBeNull()
    Object.values(stats.by_status).forEach((v) => expect(v).toBe(0))
    Object.values(stats.by_type).forEach((v) => expect(v).toBe(0))
  })
})

describe('statistics — counts', () => {
  beforeAll(async () => {
    await clearAllTables()
    createMedia({ title: 'S1', type: 'anime', status: 'watching' })
    createMedia({ title: 'S2', type: 'game', status: 'completed' })
    createMedia({ title: 'S3', type: 'movie', status: 'completed', rating: 8 })
    createMedia({ title: 'S4', type: 'novel', status: 'plan_to_watch' })
  })

  test('reflects created media counts', () => {
    const stats = getOverview()
    expect(stats.total).toBe(4)
    expect(stats.by_status.watching).toBe(1)
    expect(stats.by_status.completed).toBe(2)
    expect(stats.by_status.plan_to_watch).toBe(1)
    expect(stats.by_type.anime).toBe(1)
    expect(stats.by_type.game).toBe(1)
    expect(stats.by_type.movie).toBe(1)
    expect(stats.by_type.novel).toBe(1)
  })

  test('calculates average rating and stddev correctly', () => {
    const stats = getOverview()
    expect(stats.average_rating).toBe(8)
    expect(stats.rated_count).toBe(1)

    createMedia({ title: 'S5', type: 'anime', rating: 6 })
    const stats2 = getOverview()
    expect(stats2.average_rating).toBe(7)
    expect(stats2.rated_count).toBe(2)
    expect(stats2.rating_stddev).toBeCloseTo(1, 0)
  })
})

describe('statistics — timeline', () => {
  beforeAll(async () => {
    await clearAllTables()
  })

  test('timeline is empty with no watch history', () => {
    expect(getTimeline()).toEqual([])
  })

  test('timeline reflects watch history after progress updates', () => {
    const media = createMedia({ title: 'Timeline Test', type: 'anime' })
    updateProgress(media.id, { episode: 2 })

    const timeline = getTimeline()
    expect(timeline.length).toBeGreaterThanOrEqual(1)
    expect(timeline[0].count).toBeGreaterThanOrEqual(1)
    expect(timeline[0].period).toMatch(/^\d{4}-\d{2}$/)
  })
})

describe('statistics — tags', () => {
  beforeAll(async () => {
    await clearAllTables()
    createMedia({ title: 'Tag Stats 1', type: 'anime', tags: ['动作', '科幻'] })
    createMedia({ title: 'Tag Stats 2', type: 'anime', tags: ['动作'] })
  })

  test('tag statistics returns frequencies', () => {
    const tagStats = getTagStatistics()
    const actionTag = tagStats.find((t: any) => t.tag === '动作')
    const sciFiTag = tagStats.find((t: any) => t.tag === '科幻')

    expect(actionTag).toBeDefined()
    expect(actionTag.count).toBe(2)
    expect(sciFiTag).toBeDefined()
    expect(sciFiTag.count).toBe(1)
  })
})

describe('statistics — rating distribution', () => {
  beforeAll(async () => {
    await clearAllTables()
    createMedia({ title: 'RD 1', type: 'anime', rating: 7 })
    createMedia({ title: 'RD 2', type: 'anime', rating: 8 })
    createMedia({ title: 'RD 3', type: 'anime', rating: 7 })
  })

  test('rating distribution returns bins', () => {
    const dist = getRatingDistribution()
    const r7 = dist.find((d: any) => d.rating === 7)
    const r8 = dist.find((d: any) => d.rating === 8)

    expect(r7?.count).toBe(2)
    expect(r8?.count).toBe(1)
  })
})
