import { Hono } from 'hono'
import type { CreateWatchHistoryInput, UpdateWatchHistoryInput } from '@anriod/shared'
import { createWatchHistory, deleteWatchHistory, listHistory, updateWatchHistory } from '../services/history'
import { readJson, toInt } from '../utils/http'
import { DEFAULT_LIMIT, MAX_LIMIT } from '../constants'

export const historyRoutes = new Hono()

historyRoutes.get('/', (c) =>
  c.json(
    listHistory({
      page: toInt(c.req.query('page'), 1),
      limit: toInt(c.req.query('limit'), DEFAULT_LIMIT, 1, MAX_LIMIT),
      media_id: c.req.query('media_id')
    })
  )
)

historyRoutes.post('/', async (c) => {
  const body = await readJson<CreateWatchHistoryInput>(c)
  return c.json(createWatchHistory(body), 201)
})

historyRoutes.put('/:id', async (c) => {
  const body = await readJson<UpdateWatchHistoryInput>(c)
  return c.json(updateWatchHistory(Number(c.req.param('id')), body))
})

historyRoutes.delete('/:id', (c) => {
  deleteWatchHistory(Number(c.req.param('id')))
  return c.body(null, 204)
})
