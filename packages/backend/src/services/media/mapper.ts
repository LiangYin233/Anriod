import type { CreateMediaInput, Media, UpdateMediaInput } from '@anriod/shared'
import type { MediaRow, NewMediaRow } from '../../db/schema'
import { getTagsForMedia } from '../tag'

export function rowToMedia(row: MediaRow, tagsMap?: Map<string, string[]>): Media {
  return {
    ...row,
    tags: tagsMap?.get(row.id) ?? getTagsForMedia(row.id)
  }
}

export function normalizeMediaInput(
  input: CreateMediaInput | UpdateMediaInput,
  extra?: { synced_at?: string | null }
): Partial<NewMediaRow> {
  const values: Partial<NewMediaRow> = {}

  if (input.title !== undefined) values.title = input.title
  if (input.type !== undefined) values.type = input.type
  if (input.status !== undefined) values.status = input.status
  if (input.rating !== undefined) values.rating = input.rating
  if (input.current_progress !== undefined) values.current_progress = input.current_progress
  if (input.cover_url !== undefined) values.cover_url = input.cover_url
  if (input.description !== undefined) values.description = input.description
  if (input.external_rating !== undefined) values.external_rating = input.external_rating
  if (input.air_date !== undefined) values.air_date = input.air_date
  if (input.total_episodes !== undefined) values.total_episodes = input.total_episodes
  if (input.studio !== undefined) values.studio = input.studio
  if (input.source_metadata !== undefined) values.source_metadata = input.source_metadata
  if (input.source !== undefined) values.source = input.source
  if (input.source_id !== undefined) values.source_id = input.source_id
  if (input.source_url !== undefined) values.source_url = input.source_url
  if (extra?.synced_at !== undefined) values.synced_at = extra.synced_at

  return values
}

export function createMediaValues(id: string, input: CreateMediaInput): NewMediaRow {
  const now = new Date().toISOString()

  return {
    id,
    title: input.title,
    type: input.type,
    status: input.status ?? 'plan_to_watch',
    rating: input.rating ?? null,
    current_progress: input.current_progress ?? null,
    cover_url: input.cover_url ?? null,
    description: input.description ?? null,
    external_rating: input.external_rating ?? null,
    air_date: input.air_date ?? null,
    total_episodes: input.total_episodes ?? null,
    studio: input.studio ?? null,
    source_metadata: input.source_metadata ?? null,
    source: input.source ?? null,
    source_id: input.source_id ?? null,
    source_url: input.source_url ?? null,
    synced_at: null,
    created_at: now,
    updated_at: now
  }
}
