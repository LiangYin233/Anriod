import { Hono } from 'hono'
import type { CreateMediaInput, ImportMediaInput, UpdateMediaInput, UpdateStatusInput } from '@anriod/shared'
import { addTagToMedia, removeTagFromMedia } from '../services/tag'
import {
  createMedia,
  deleteMedia,
  getMediaById,
  importMedia,
  listMedia,
  markEpisodesWatched,
  markSingleEpisode,
  syncMedia,
  undoEpisodeWatch,
  updateMedia,
  updateStatus
} from '../services/media'
import { listRecordsForMedia } from '../services/watch-record'
import { parseOptionalInt, readJson, toInt } from '../utils/http'
import { DEFAULT_LIMIT, MAX_LIMIT } from '../constants'

export const mediaRoutes = new Hono()

mediaRoutes.get('/', (c) => {
  return c.json(
    listMedia({
      type: c.req.query('type') as any,
      status: c.req.query('status') as any,
      tag: c.req.query('tag'),
      source: c.req.query('source'),
      page: toInt(c.req.query('page'), 1),
      limit: toInt(c.req.query('limit'), DEFAULT_LIMIT, 1, MAX_LIMIT),
      sort: c.req.query('sort'),
      q: c.req.query('q'),
      air_date_from: c.req.query('air_date_from'),
      air_date_to: c.req.query('air_date_to'),
      ep_min: parseOptionalInt(c.req.query('ep_min')),
      ep_max: parseOptionalInt(c.req.query('ep_max'))
    })
  )
})

mediaRoutes.post('/', async (c) => {
  const body = await readJson<CreateMediaInput>(c)
  return c.json(createMedia(body), 201)
})

mediaRoutes.post('/import', async (c) => {
  const body = await readJson<ImportMediaInput>(c)
  return c.json(await importMedia(body), 201)
})

mediaRoutes.get('/:id', (c) => c.json(getMediaById(c.req.param('id'))))

mediaRoutes.put('/:id', async (c) => {
  const body = await readJson<UpdateMediaInput>(c)
  return c.json(updateMedia(c.req.param('id'), body))
})

mediaRoutes.delete('/:id', (c) => {
  deleteMedia(c.req.param('id'))
  return c.body(null, 204)
})

mediaRoutes.patch('/:id/status', async (c) => {
  const body = await readJson<UpdateStatusInput>(c)
  return c.json(updateStatus(c.req.param('id'), body.status))
})

mediaRoutes.post('/:id/sync', async (c) => c.json(await syncMedia(c.req.param('id'))))

mediaRoutes.post('/:id/records/episodes/batch', async (c) => {
  const body = await readJson<{ episodes: number[] }>(c)
  return c.json(markEpisodesWatched(c.req.param('id'), body.episodes))
})

mediaRoutes.post('/:id/records/episodes/single', async (c) => {
  const body = await readJson<{ episode: number }>(c)
  return c.json(markSingleEpisode(c.req.param('id'), body.episode))
})

mediaRoutes.delete('/:id/records/episodes/:ep', (c) => {
  return c.json(undoEpisodeWatch(c.req.param('id'), Number(c.req.param('ep'))))
})

mediaRoutes.get('/:id/records', (c) => c.json(listRecordsForMedia(c.req.param('id'))))

mediaRoutes.post('/:id/tags', async (c) => {
  const body = await readJson<{ tag_id: number }>(c)
  addTagToMedia(c.req.param('id'), Number(body.tag_id))
  return c.json(getMediaById(c.req.param('id')))
})

mediaRoutes.delete('/:id/tags/:tagId', (c) => {
  removeTagFromMedia(c.req.param('id'), Number(c.req.param('tagId')))
  return c.json(getMediaById(c.req.param('id')))
})
