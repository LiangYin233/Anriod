import type { Tag } from '@anriod/shared'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { db, type AppDbExecutor } from '../db/client'
import { mediaTags, tags } from '../db/schema'
import { HttpError } from '../middleware/error'
import { ERROR_MESSAGES } from '../constants'

export function listTags(): Tag[] {
  return db.select().from(tags).orderBy(asc(tags.name)).all()
}

export function getTagById(id: number, database: AppDbExecutor = db): Tag | null {
  return database.select().from(tags).where(eq(tags.id, id)).get() ?? null
}

export function getTagByName(name: string, database: AppDbExecutor = db): Tag | null {
  return database.select().from(tags).where(eq(tags.name, name)).get() ?? null
}

export function createTag(name: string, database: AppDbExecutor = db): Tag {
  const normalized = name.trim()
  if (!normalized) throw new HttpError(400, ERROR_MESSAGES.TAG_NAME_REQUIRED)

  database.insert(tags).values({ name: normalized, created_at: new Date().toISOString() }).onConflictDoNothing().run()
  const tag = getTagByName(normalized, database)
  if (!tag) throw new HttpError(500, ERROR_MESSAGES.TAG_CREATE_FAILED)
  return tag
}

export function deleteTag(id: number) {
  db.delete(tags).where(eq(tags.id, id)).run()
}

export function getTagsForMedia(mediaId: string): string[] {
  return db
    .select({ name: tags.name })
    .from(tags)
    .innerJoin(mediaTags, eq(mediaTags.tag_id, tags.id))
    .where(eq(mediaTags.media_id, mediaId))
    .orderBy(asc(tags.name))
    .all()
    .map((row) => row.name)
}

/** Batch-load tags for multiple media IDs in a single query */
export function getTagsForMediaBatch(mediaIds: string[]): Map<string, string[]> {
  if (mediaIds.length === 0) return new Map()

  const rows = db
    .select({ media_id: mediaTags.media_id, name: tags.name })
    .from(mediaTags)
    .innerJoin(tags, eq(tags.id, mediaTags.tag_id))
    .where(inArray(mediaTags.media_id, mediaIds))
    .orderBy(asc(mediaTags.media_id), asc(tags.name))
    .all()

  const result = new Map<string, string[]>()
  for (const row of rows) {
    const existingTags = result.get(row.media_id)
    if (existingTags) {
      existingTags.push(row.name)
    } else {
      result.set(row.media_id, [row.name])
    }
  }
  // Ensure every requested ID has an entry (even if empty)
  for (const mediaId of mediaIds) {
    if (!result.has(mediaId)) result.set(mediaId, [])
  }
  return result
}

export function addTagToMedia(mediaId: string, tagId: number) {
  if (!getTagById(tagId)) throw new HttpError(404, ERROR_MESSAGES.TAG_NOT_FOUND)
  db.insert(mediaTags).values({ media_id: mediaId, tag_id: tagId }).onConflictDoNothing().run()
}

export function removeTagFromMedia(mediaId: string, tagId: number) {
  db.delete(mediaTags).where(and(eq(mediaTags.media_id, mediaId), eq(mediaTags.tag_id, tagId))).run()
}

export function setTagsForMedia(mediaId: string, tagNames: string[] = [], database?: AppDbExecutor) {
  const uniqueNames = [...new Set(tagNames.map((name) => name.trim()).filter(Boolean))]

  const replaceTags = (executor: AppDbExecutor) => {
    executor.delete(mediaTags).where(eq(mediaTags.media_id, mediaId)).run()

    for (const name of uniqueNames) {
      const tag = createTag(name, executor)
      executor.insert(mediaTags).values({ media_id: mediaId, tag_id: tag.id }).onConflictDoNothing().run()
    }
  }

  if (database) {
    replaceTags(database)
    return
  }

  db.transaction((transaction) => {
    replaceTags(transaction)
  })
}
