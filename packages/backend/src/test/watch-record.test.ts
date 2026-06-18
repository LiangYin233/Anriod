import { describe, test, expect, beforeAll } from 'bun:test'
import { ERROR_MESSAGES } from '../constants'
import { initTestEnv, clearAllTables } from './helpers'

let createMedia: any
let listRecords: any, createWatchRecord: any
let getRecordById: any, updateWatchRecord: any, deleteWatchRecord: any
let listRecordsForMedia: any
let mediaId: string

beforeAll(async () => {
  await initTestEnv()
  await clearAllTables()

  const m = await import('../services/media')
  createMedia = m.createMedia

  const h = await import('../services/watch-record')
  listRecords = h.listRecords
  createWatchRecord = h.createWatchRecord
  getRecordById = h.getRecordById
  updateWatchRecord = h.updateWatchRecord
  deleteWatchRecord = h.deleteWatchRecord
  listRecordsForMedia = h.listRecordsForMedia

  const media = createMedia({ title: 'Record Source', type: 'anime' })
  mediaId = media.id
})

describe('watch record service', () => {
  test('listRecords returns empty initially', () => {
    const result = listRecords({})
    expect(result.data).toEqual([])
  })

  test('createWatchRecord creates a record', () => {
    const entry = createWatchRecord({
      media_id: mediaId,
      episode: 1,
    })
    expect(entry.media_id).toBe(mediaId)
    expect(entry.episode).toBe(1)
    expect(entry.id).toBeGreaterThan(0)
    expect(entry.watched_at).toBeTruthy()
  })

  test('getRecordById returns correct entry', () => {
    const all = listRecords({})
    const entry = getRecordById(all.data[0].id)
    expect(entry.id).toBe(all.data[0].id)
  })

  test('getRecordById throws for non-existent', () => {
    expect(() => getRecordById(999999)).toThrow(ERROR_MESSAGES.RECORD_NOT_FOUND)
  })

  test('listRecords paginates', () => {
    const page1 = listRecords({ page: 1, limit: 1 })
    expect(page1.data.length).toBe(1)
    expect(page1.pagination.total).toBeGreaterThanOrEqual(1)
  })

  test('listRecords filters by media_id', () => {
    const result = listRecords({ media_id: mediaId })
    expect(result.data.every((h: any) => h.media_id === mediaId)).toBe(true)

    const empty = listRecords({ media_id: 'no-such-id' })
    expect(empty.data).toEqual([])
  })

  test('listRecordsForMedia returns entries for media', () => {
    const entries = listRecordsForMedia(mediaId)
    expect(entries.length).toBeGreaterThanOrEqual(1)
    expect(entries.every((h: any) => h.media_id === mediaId)).toBe(true)
    expect(entries[0].media_title).toBe('Record Source')
  })

  test('listRecordsForMedia throws for non-existent media', () => {
    expect(() => listRecordsForMedia('bad-id')).toThrow(ERROR_MESSAGES.MEDIA_NOT_FOUND)
  })

  test('updateWatchRecord updates fields', () => {
    const entry = createWatchRecord({
      media_id: mediaId,
      episode: 2,
    })
    const updated = updateWatchRecord(entry.id, {
      episode: 5,
    })
    expect(updated.episode).toBe(5)
  })

  test('deleteWatchRecord removes entry', () => {
    const entry = createWatchRecord({
      media_id: mediaId,
      episode: 99,
    })
    deleteWatchRecord(entry.id)
    expect(() => getRecordById(entry.id)).toThrow(ERROR_MESSAGES.RECORD_NOT_FOUND)
  })
})
