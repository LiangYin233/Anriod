import { describe, test, expect, beforeAll } from 'bun:test'
import { initTestEnv, clearAllTables } from './helpers'

let listTags: any, createTag: any, getTagById: any, getTagByName: any, deleteTag: any
let setTagsForMedia: any, getTagsForMedia: any, createMedia: any

beforeAll(async () => {
  await initTestEnv()
  await clearAllTables()

  const tagModule = await import('../services/tag')
  listTags = tagModule.listTags
  createTag = tagModule.createTag
  getTagById = tagModule.getTagById
  getTagByName = tagModule.getTagByName
  deleteTag = tagModule.deleteTag
  setTagsForMedia = tagModule.setTagsForMedia
  getTagsForMedia = tagModule.getTagsForMedia

  const mediaModule = await import('../services/media')
  createMedia = mediaModule.createMedia
})

describe('tag service', () => {
  test('listTags returns empty array initially', () => {
    expect(listTags()).toEqual([])
  })

  test('createTag creates a tag', () => {
    const tag = createTag('科幻')
    expect(tag.name).toBe('科幻')
    expect(tag.id).toBeGreaterThan(0)
    expect(typeof tag.created_at).toBe('string')
  })

  test('createTag is idempotent (INSERT OR IGNORE)', () => {
    const t1 = createTag('冒险')
    const t2 = createTag('冒险')
    expect(t2.id).toBe(t1.id)
  })

  test('createTag trims whitespace', () => {
    const tag = createTag('  动作  ')
    expect(tag.name).toBe('动作')
  })

  test('createTag rejects empty name', () => {
    expect(() => createTag('')).toThrow()
    expect(() => createTag('  ')).toThrow()
  })

  test('getTagById returns the correct tag', () => {
    const created = createTag('RPG')
    const found = getTagById(created.id)
    expect(found).not.toBeNull()
    expect(found!.name).toBe('RPG')
  })

  test('getTagById returns null for non-existent id', () => {
    expect(getTagById(999999)).toBeNull()
  })

  test('getTagByName returns the correct tag', () => {
    createTag('SLG')
    const found = getTagByName('SLG')
    expect(found).not.toBeNull()
    expect(found!.name).toBe('SLG')
  })

  test('getTagByName returns null for non-existent name', () => {
    expect(getTagByName('non_existent_tag')).toBeNull()
  })

  test('listTags returns all created tags', () => {
    const tags = listTags()
    const names = tags.map((t: any) => t.name)
    expect(names.length).toBeGreaterThanOrEqual(5)
    // Verify completeness — all tags created earlier are present
    const lower = names.map((x: string) => x.toLowerCase())
    expect(lower).toContain('科幻')
    expect(lower).toContain('冒险')
    expect(lower).toContain('动作')
    expect(lower).toContain('rpg')
    expect(lower).toContain('slg')
  })

  test('deleteTag removes the tag', () => {
    const tag = createTag('临时标签')
    deleteTag(tag.id)
    expect(getTagById(tag.id)).toBeNull()
  })

  test('setTagsForMedia replaces tags on a media', () => {
    const media = createMedia({ title: 'Tagged Media', type: 'anime' })
    setTagsForMedia(media.id, ['a', 'b', 'c'])
    expect(getTagsForMedia(media.id)).toEqual(['a', 'b', 'c'])

    setTagsForMedia(media.id, ['d', 'e'])
    expect(getTagsForMedia(media.id)).toEqual(['d', 'e'])
  })
})
