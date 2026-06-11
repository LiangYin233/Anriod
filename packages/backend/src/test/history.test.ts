import { describe, test, expect, beforeAll } from 'bun:test'
import { initTestEnv, clearAllTables } from './helpers'

let createMedia: any, listHistory: any, createWatchHistory: any
let getHistoryById: any, updateWatchHistory: any, deleteWatchHistory: any
let listHistoryForMedia: any
let mediaId: string

beforeAll(async () => {
  await initTestEnv()
  await clearAllTables()

  const m = await import('../services/media')
  createMedia = m.createMedia

  const h = await import('../services/history')
  listHistory = h.listHistory
  createWatchHistory = h.createWatchHistory
  getHistoryById = h.getHistoryById
  updateWatchHistory = h.updateWatchHistory
  deleteWatchHistory = h.deleteWatchHistory
  listHistoryForMedia = h.listHistoryForMedia

  const media = createMedia({ title: 'History Source', type: 'anime' })
  mediaId = media.id
})

describe('watch history service', () => {
  test('listHistory returns empty initially', () => {
    const result = listHistory({})
    expect(result.data).toEqual([])
  })

  test('createWatchHistory creates a record', () => {
    const entry = createWatchHistory({
      media_id: mediaId,
      progress_from: { episode: 0 },
      progress_to: { episode: 1 },
      notes: 'First episode',
    })
    expect(entry.media_id).toBe(mediaId)
    expect(entry.progress_to?.episode).toBe(1)
    expect(entry.notes).toBe('First episode')
    expect(entry.id).toBeGreaterThan(0)
    expect(entry.started_at).toBeTruthy()
  })

  test('getHistoryById returns correct entry', () => {
    const all = listHistory({})
    const entry = getHistoryById(all.data[0].id)
    expect(entry.id).toBe(all.data[0].id)
  })

  test('getHistoryById throws for non-existent', () => {
    expect(() => getHistoryById(999999)).toThrow('History record not found')
  })

  test('listHistory paginates', () => {
    const page1 = listHistory({ page: 1, limit: 1 })
    expect(page1.data.length).toBe(1)
    expect(page1.pagination.total).toBeGreaterThanOrEqual(1)
  })

  test('listHistory filters by media_id', () => {
    const result = listHistory({ media_id: mediaId })
    expect(result.data.every((h: any) => h.media_id === mediaId)).toBe(true)

    const empty = listHistory({ media_id: 'no-such-id' })
    expect(empty.data).toEqual([])
  })

  test('listHistoryForMedia returns entries for media', () => {
    const entries = listHistoryForMedia(mediaId)
    expect(entries.length).toBeGreaterThanOrEqual(1)
    expect(entries.every((h: any) => h.media_id === mediaId)).toBe(true)
    expect(entries[0].media_title).toBe('History Source')
  })

  test('listHistoryForMedia throws for non-existent media', () => {
    expect(() => listHistoryForMedia('bad-id')).toThrow('Media not found')
  })

  test('updateWatchHistory updates fields', () => {
    const entry = createWatchHistory({
      media_id: mediaId,
      progress_to: { episode: 2 },
    })
    const updated = updateWatchHistory(entry.id, {
      notes: 'Updated notes',
      rating: 8,
    })
    expect(updated.notes).toBe('Updated notes')
    expect(updated.rating).toBe(8)
    expect(updated.progress_to?.episode).toBe(2)
  })

  test('deleteWatchHistory removes entry', () => {
    const entry = createWatchHistory({
      media_id: mediaId,
      progress_to: { episode: 99 },
    })
    deleteWatchHistory(entry.id)
    expect(() => getHistoryById(entry.id)).toThrow('History record not found')
  })
})
