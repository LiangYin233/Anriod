import { describe, test, expect, beforeAll } from 'bun:test'
import { ERROR_MESSAGES } from '../constants'
import { initTestEnv, clearAllTables } from './helpers'

let createMedia: any, listMedia: any, deleteMedia: any
let exportAll: any, importAll: any

beforeAll(async () => {
  await initTestEnv()
  await clearAllTables()

  const m = await import('../services/media')
  createMedia = m.createMedia
  listMedia = m.listMedia
  deleteMedia = m.deleteMedia

  const b = await import('../services/backup')
  exportAll = b.exportAll
  importAll = b.importAll
})

describe('backup — export', () => {
  test('exports empty database', () => {
    const data = exportAll()
    expect(data.version).toBe(2)
    expect(data.exported_at).toBeTruthy()
    expect(data.media).toEqual([])
    expect(data.tags).toEqual([])
    expect(data.watch_records).toEqual([])
  })
})

describe('backup — round-trip', () => {
  let media: any
  let exported: any

  beforeAll(() => {
    media = createMedia({
      title: 'Backup Test',
      type: 'anime',
      rating: 9,
      total_episodes: 12,
      tags: ['经典', '必看'],
    })

    exported = exportAll()
  })

  test('exported data contains the created media', () => {
    const found = exported.media.find((m: any) => m.id === media.id)
    expect(found).toBeDefined()
    expect(found!.title).toBe('Backup Test')
    expect(found!.rating).toBe(9)
    expect(found!.tags).toContain('经典')
    expect(found!.tags).toContain('必看')
  })

  test('tags are exported', () => {
    const tagNames = exported.tags.map((t: any) => t.name)
    expect(tagNames).toContain('经典')
    expect(tagNames).toContain('必看')
  })

  test('import restores data after delete', () => {
    const all = listMedia({}).data
    for (const item of all) {
      deleteMedia(item.id)
    }
    expect(listMedia({}).data.length).toBe(0)

    importAll(exported)

    const restored = listMedia({}).data
    const found = restored.find((m: any) => m.id === media.id)
    expect(found).toBeDefined()
    expect(found!.title).toBe('Backup Test')
    expect(found!.rating).toBe(9)
    expect(found!.tags).toContain('经典')
  })
})

describe('backup — validation', () => {
  test('rejects invalid format', () => {
    expect(() => importAll(null as any)).toThrow(ERROR_MESSAGES.INVALID_EXPORT_FORMAT)
    expect(() => importAll({ version: 1 } as any)).toThrow(ERROR_MESSAGES.INVALID_EXPORT_FORMAT)
    expect(() => importAll({ version: 2 } as any)).toThrow(ERROR_MESSAGES.EXPORT_MISSING_ARRAYS)
  })
})
