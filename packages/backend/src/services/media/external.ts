import type { ImportMediaInput, Media } from '@anriod/shared'
import { config } from '../../config'
import { ERROR_MESSAGES } from '../../constants'
import { getDataSource } from '../../datasources/registry'
import { HttpError } from '../../middleware/error'
import { downloadQueue } from '../../utils/download-queue'
import { createMedia, getMediaById, updateMedia } from './crud'

export async function importMedia(input: ImportMediaInput): Promise<Media> {
  const dataSource = getDataSource(input.source)
  if (!dataSource) throw new HttpError(400, ERROR_MESSAGES.UNKNOWN_DATA_SOURCE)

  const details = await dataSource.getDetails(input.source_id, input.type)
  const mediaItem = createMedia({
    title: details.title,
    type: details.media_type,
    status: input.status ?? 'plan_to_watch',
    cover_url: details.cover_url,
    description: details.description,
    external_rating: details.external_rating ?? null,
    air_date: details.air_date ?? null,
    total_episodes: details.total_episodes ?? null,
    studio: details.studio ?? null,
    source_metadata: details.raw_metadata,
    source: details.source,
    source_id: details.source_id,
    source_url: details.source_url ?? null
  })

  if (details.cover_url) {
    downloadQueue.add({
      mediaId: mediaItem.id,
      coverUrl: details.cover_url,
      savePath: `${config.coversDir}/${mediaItem.id}`
    })
  }

  return mediaItem
}

export async function syncMedia(id: string): Promise<Media> {
  const mediaItem = getMediaById(id)
  if (!mediaItem.source || !mediaItem.source_id) throw new HttpError(400, ERROR_MESSAGES.MEDIA_NO_SOURCE)

  const dataSource = getDataSource(mediaItem.source)
  if (!dataSource) throw new HttpError(400, ERROR_MESSAGES.UNKNOWN_DATA_SOURCE)

  const details = await dataSource.getDetails(mediaItem.source_id, mediaItem.type)
  return updateMedia(id, {
    external_rating: details.external_rating ?? null,
    air_date: details.air_date ?? null,
    total_episodes: details.total_episodes ?? null,
    source_metadata: details.raw_metadata,
    source_url: details.source_url ?? null
  }, { synced_at: new Date().toISOString() })
}
