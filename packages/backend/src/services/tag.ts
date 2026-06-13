import type { Tag } from '@anriod/shared'
import { all, get, run, transaction } from '../db/helpers'
import { HttpError } from '../middleware/error'
import { ERROR_MESSAGES } from '../constants'

export function listTags(): Tag[] {
  return all<Tag>('SELECT id, name, created_at FROM tags ORDER BY name ASC')
}

export function getTagById(id: number): Tag | null {
  return get<Tag>('SELECT id, name, created_at FROM tags WHERE id = ?', [id])
}

export function getTagByName(name: string): Tag | null {
  return get<Tag>('SELECT id, name, created_at FROM tags WHERE name = ?', [name])
}

export function createTag(name: string): Tag {
  const normalized = name.trim()
  if (!normalized) throw new HttpError(400, ERROR_MESSAGES.TAG_NAME_REQUIRED)

  run('INSERT OR IGNORE INTO tags (name) VALUES (?)', [normalized])
  const tag = getTagByName(normalized)
  if (!tag) throw new HttpError(500, ERROR_MESSAGES.TAG_CREATE_FAILED)
  return tag
}

export function deleteTag(id: number) {
  run('DELETE FROM tags WHERE id = ?', [id])
}

export function getTagsForMedia(mediaId: string): string[] {
  return all<{ name: string }>(
    `SELECT t.name
     FROM tags t
     INNER JOIN media_tags mt ON mt.tag_id = t.id
     WHERE mt.media_id = ?
     ORDER BY t.name ASC`,
    [mediaId]
  ).map((row) => row.name)
}

/** Batch-load tags for multiple media IDs in a single query */
export function getTagsForMediaBatch(mediaIds: string[]): Map<string, string[]> {
  if (mediaIds.length === 0) return new Map()

  const placeholders = mediaIds.map(() => '?').join(', ')
  const rows = all<{ media_id: string; name: string }>(
    `SELECT mt.media_id, t.name
     FROM media_tags mt
     INNER JOIN tags t ON t.id = mt.tag_id
     WHERE mt.media_id IN (${placeholders})
     ORDER BY t.name ASC`,
    mediaIds
  )

  const result = new Map<string, string[]>()
  for (const row of rows) {
    const tags = result.get(row.media_id)
    if (tags) {
      tags.push(row.name)
    } else {
      result.set(row.media_id, [row.name])
    }
  }
  // Ensure every requested ID has an entry (even if empty)
  for (const id of mediaIds) {
    if (!result.has(id)) result.set(id, [])
  }
  return result
}

export function addTagToMedia(mediaId: string, tagId: number) {
  if (!getTagById(tagId)) throw new HttpError(404, ERROR_MESSAGES.TAG_NOT_FOUND)
  run('INSERT OR IGNORE INTO media_tags (media_id, tag_id) VALUES (?, ?)', [mediaId, tagId])
}

export function removeTagFromMedia(mediaId: string, tagId: number) {
  run('DELETE FROM media_tags WHERE media_id = ? AND tag_id = ?', [mediaId, tagId])
}

export function setTagsForMedia(mediaId: string, tagNames: string[] = []) {
  const uniqueNames = [...new Set(tagNames.map((name) => name.trim()).filter(Boolean))]

  transaction(() => {
    run('DELETE FROM media_tags WHERE media_id = ?', [mediaId])

    for (const name of uniqueNames) {
      const tag = createTag(name)
      run('INSERT OR IGNORE INTO media_tags (media_id, tag_id) VALUES (?, ?)', [mediaId, tag.id])
    }
  })
}
