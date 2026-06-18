import { Hono } from 'hono'
import type { CreateWatchRecordInput, UpdateWatchRecordInput } from '@anriod/shared'
import { createWatchRecord, deleteWatchRecord, listRecords, updateWatchRecord } from '../services/watch-record'
import { readJson, toInt } from '../utils/http'
import { DEFAULT_LIMIT, MAX_LIMIT } from '../constants'

export const recordRoutes = new Hono()

recordRoutes.get('/', (c) =>
  c.json(
    listRecords({
      page: toInt(c.req.query('page'), 1),
      limit: toInt(c.req.query('limit'), DEFAULT_LIMIT, 1, MAX_LIMIT),
      media_id: c.req.query('media_id')
    })
  )
)

recordRoutes.post('/', async (c) => {
  const body = await readJson<CreateWatchRecordInput>(c)
  return c.json(createWatchRecord(body), 201)
})

recordRoutes.put('/:id', async (c) => {
  const body = await readJson<UpdateWatchRecordInput>(c)
  return c.json(updateWatchRecord(Number(c.req.param('id')), body))
})

recordRoutes.delete('/:id', (c) => {
  deleteWatchRecord(Number(c.req.param('id')))
  return c.body(null, 204)
})
