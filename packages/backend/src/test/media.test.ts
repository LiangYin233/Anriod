import { describe, test, expect, beforeAll } from 'bun:test'
import { ERROR_MESSAGES } from '../constants'
import { initTestEnv, clearAllTables } from './helpers'

let listMedia: any, getMediaById: any, createMedia: any, updateMedia: any
let deleteMedia: any, updateProgress: any, updateStatus: any
let importMedia: any, syncMedia: any
let getTagsForMedia: any, listHistoryForMedia: any

beforeAll(async () => {
  await initTestEnv()
  await clearAllTables()

  const m = await import('../services/media')
  listMedia = m.listMedia
  getMediaById = m.getMediaById
  createMedia = m.createMedia
  updateMedia = m.updateMedia
  deleteMedia = m.deleteMedia
  updateProgress = m.updateProgress
  updateStatus = m.updateStatus
  importMedia = m.importMedia
  syncMedia = m.syncMedia

  const t = await import('../services/tag')
  getTagsForMedia = t.getTagsForMedia

  const h = await import('../services/history')
  listHistoryForMedia = h.listHistoryForMedia
})

const sampleAnime = {
  title: 'Test Anime',
  type: 'anime' as const,
  status: 'plan_to_watch' as const,
  total_episodes: 24,
  source: 'bangumi',
  source_id: '123',
  tags: ['科幻', '机甲'],
}

describe('media service — create', () => {
  test('creates media with minimal fields', () => {
    const media = createMedia({ title: 'Minimal', type: 'movie' })
    expect(media.id).toBeTruthy()
    expect(media.title).toBe('Minimal')
    expect(media.type).toBe('movie')
    expect(media.status).toBe('plan_to_watch')
    expect(media.current_progress).toBeNull()
    expect(Array.isArray(media.tags)).toBe(true)
  })

  test('creates media with all fields', () => {
    const media = createMedia(sampleAnime)
    expect(media.title).toBe('Test Anime')
    expect(media.type).toBe('anime')
    expect(media.status).toBe('plan_to_watch')
    expect(media.total_episodes).toBe(24)
    expect(media.source).toBe('bangumi')
    expect(media.source_id).toBe('123')
    expect(media.tags).toContain('科幻')
    expect(media.tags).toContain('机甲')
  })

  test('rejects duplicate title + type', () => {
    expect(() => createMedia({ title: 'Test Anime', type: 'anime' })).toThrow('Duplicate')
  })

  test('rejects empty title', () => {
    expect(() => createMedia({ title: '', type: 'anime' })).toThrow(ERROR_MESSAGES.TITLE_REQUIRED)
  })

  test('rejects blank title', () => {
    expect(() => createMedia({ title: '  ', type: 'anime' })).toThrow(ERROR_MESSAGES.TITLE_REQUIRED)
  })

  test('rejects invalid type', () => {
    expect(() => createMedia({ title: 'X', type: 'comic' as any })).toThrow(ERROR_MESSAGES.INVALID_MEDIA_TYPE)
  })

  test('rejects invalid rating range', () => {
    expect(() => createMedia({ title: 'X', type: 'anime', rating: 11 })).toThrow(ERROR_MESSAGES.INVALID_RATING)
    expect(() => createMedia({ title: 'X', type: 'anime', rating: -1 })).toThrow(ERROR_MESSAGES.INVALID_RATING)
  })
})

describe('media service — read / list', () => {
  let createdId: string

  beforeAll(() => {
    createdId = createMedia({ title: 'Reader 1', type: 'anime' }).id
    // Create a media with different status for filter/sort tests
    createMedia({ title: 'Dropped Item', type: 'tv', status: 'dropped', rating: 4 })
  })

  test('getMediaById returns correct media', () => {
    const found = getMediaById(createdId)
    expect(found.id).toBe(createdId)
    expect(found.title).toBe('Reader 1')
  })

  test('getMediaById throws 404 for non-existent', () => {
    expect(() => getMediaById('non-existent-id')).toThrow(ERROR_MESSAGES.MEDIA_NOT_FOUND)
  })

  test('listMedia paginates correctly', () => {
    const page1 = listMedia({ page: 1, limit: 1 })
    expect(page1.data.length).toBe(1)

    const page2 = listMedia({ page: 2, limit: 1 })
    expect(page2.data.length).toBe(1)
    expect(page2.data[0].id).not.toBe(page1.data[0].id)
  })

  test('listMedia filters by type', () => {
    const result = listMedia({ type: 'anime' })
    expect(result.data.every((m: any) => m.type === 'anime')).toBe(true)
  })

  test('listMedia filters by search query', () => {
    const result = listMedia({ q: 'Reader' })
    expect(result.data.length).toBeGreaterThanOrEqual(1)
  })

  test('listMedia filters by status — includes matching, excludes non-matching', () => {
    const result = listMedia({ status: 'plan_to_watch' })
    expect(result.data.length).toBeGreaterThanOrEqual(1)
    expect(result.data.every((m: any) => m.status === 'plan_to_watch')).toBe(true)
  })

  test('listMedia filters by source', () => {
    const result = listMedia({ source: 'bangumi' })
    expect(result.data.every((m: any) => m.source === 'bangumi')).toBe(true)
  })

  test('listMedia returns status_counts', () => {
    const result = listMedia({})
    expect(result.status_counts).toBeDefined()
    expect(typeof result.status_counts!.plan_to_watch).toBe('number')
  })

  test('listMedia sorts by rating descending', () => {
    // Create items with explicit ratings so the sort is testable
    createMedia({ title: 'Low Rating', type: 'anime', rating: 2 })
    createMedia({ title: 'High Rating', type: 'anime', rating: 9 })
    createMedia({ title: 'Mid Rating', type: 'anime', rating: 5 })

    const result = listMedia({ sort: 'rating:desc' })
    const ratings = result.data.map((m: any) => m.rating).filter((r: any) => r !== null)
    expect(ratings.length).toBeGreaterThanOrEqual(3)
    for (let i = 1; i < ratings.length; i++) {
      expect(ratings[i - 1]).toBeGreaterThanOrEqual(ratings[i])
    }
  })
})

describe('media service — update', () => {
  test('updates title and rating', () => {
    const media = createMedia({ title: 'Update Me', type: 'tv' })
    const updated = updateMedia(media.id, { title: 'Updated', rating: 8 })
    expect(updated.title).toBe('Updated')
    expect(updated.rating).toBe(8)
  })

  test('partial update preserves other fields', () => {
    const media = createMedia({ title: 'Partial', type: 'novel', notes: 'original notes' })
    const updated = updateMedia(media.id, { rating: 5 })
    expect(updated.rating).toBe(5)
    expect(updated.notes).toBe('original notes')
  })

  test('updates tags', () => {
    const media = createMedia({ title: 'Tag Test', type: 'anime', tags: ['a', 'b'] })
    const updated = updateMedia(media.id, { tags: ['c', 'd'] })
    expect(updated.tags).toEqual(['c', 'd'])
  })

  test('update with no-op keeps same values', () => {
    const media = createMedia({ title: 'No Op', type: 'anime', rating: 7 })
    const updated = updateMedia(media.id, {})
    expect(updated.rating).toBe(7)
    expect(updated.title).toBe('No Op')
  })
})

describe('media service — delete', () => {
  test('deletes media', () => {
    const media = createMedia({ title: 'Delete Me', type: 'movie' })
    deleteMedia(media.id)
    expect(() => getMediaById(media.id)).toThrow(ERROR_MESSAGES.MEDIA_NOT_FOUND)
  })

  test('delete cascades to media_tags', () => {
    const media = createMedia({ title: 'Cascade Test', type: 'anime', tags: ['科幻'] })
    expect(getTagsForMedia(media.id)).toContain('科幻')
    deleteMedia(media.id)
    expect(getTagsForMedia(media.id)).toEqual([])
  })

  test('delete throws on non-existent media', () => {
    expect(() => deleteMedia('non-existent-id')).toThrow(ERROR_MESSAGES.MEDIA_NOT_FOUND)
  })
})

describe('media service — progress', () => {
  test('updateProgress increases episode count', () => {
    const media = createMedia({ title: 'Progress 1', type: 'anime', total_episodes: 12 })
    const p1 = updateProgress(media.id, { episode: 5 })
    expect(p1.current_progress?.episode).toBe(5)

    const p2 = updateProgress(media.id, { episode: 8 })
    expect(p2.current_progress?.episode).toBe(8)
  })

  test('updateProgress creates history entries for incremental progress', () => {
    const media = createMedia({ title: 'Progress History', type: 'anime', total_episodes: 12 })
    updateProgress(media.id, { episode: 3 })

    const history = listHistoryForMedia(media.id)
    expect(history.length).toBe(3)
    // All entries should have episode values
    expect(history.every((h: any) => h.progress_to?.episode)).toBe(true)
    // Entries are ordered by started_at DESC; all created at same time
    const episodes = history.map((h: any) => h.progress_to.episode).sort((a: number, b: number) => a - b)
    expect(episodes).toEqual([1, 2, 3])
  })

  test('decreasing progress removes excess history entries', () => {
    const media = createMedia({ title: 'Decrease Test', type: 'anime', total_episodes: 12 })
    updateProgress(media.id, { episode: 5 })
    updateProgress(media.id, { episode: 3 })
    const history = listHistoryForMedia(media.id)
    expect(history.length).toBe(3)
  })
})

describe('media service — status transitions', () => {
  test('updateStatus changes status', () => {
    const media = createMedia({ title: 'Status Test', type: 'anime' })
    const updated = updateStatus(media.id, 'watching')
    expect(updated.status).toBe('watching')
  })

  test('rejects invalid status', () => {
    const media = createMedia({ title: 'Invalid Status', type: 'anime' })
    expect(() => updateStatus(media.id, 'invalid' as any)).toThrow()
  })

  test('completing creates a finished history entry', () => {
    const media = createMedia({ title: 'Complete Test', type: 'anime', total_episodes: 12 })
    updateProgress(media.id, { episode: 12 })
    updateStatus(media.id, 'completed')

    const history = listHistoryForMedia(media.id)
    const completeEntry = history.find((h: any) => h.completed_at !== null)
    expect(completeEntry).toBeDefined()
  })

  test('marking as watching creates an open-ended history entry', () => {
    const media = createMedia({ title: 'Watch Start', type: 'anime' })
    updateStatus(media.id, 'watching')

    const history = listHistoryForMedia(media.id)
    const openEntry = history.find((h: any) => h.completed_at === null)
    expect(openEntry).toBeDefined()
  })
})

describe('media service — import / sync (disabled source)', () => {
  test('importMedia throws for disabled datasource', async () => {
    await expect(
      importMedia({ source: 'bangumi', source_id: '123' })
    ).rejects.toThrow(ERROR_MESSAGES.UNKNOWN_DATA_SOURCE)
  })

  test('syncMedia throws for non-existent media', async () => {
    await expect(syncMedia('bad-id')).rejects.toThrow(ERROR_MESSAGES.MEDIA_NOT_FOUND)
  })

  test('syncMedia throws for media without source', async () => {
    const media = createMedia({ title: 'No Source', type: 'movie' })
    await expect(syncMedia(media.id)).rejects.toThrow(ERROR_MESSAGES.MEDIA_NO_SOURCE)
  })
})
