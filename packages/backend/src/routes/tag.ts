import { Hono } from 'hono'
import { createTag, deleteTag, listTags } from '../services/tag'
import { readJson } from '../utils/http'

export const tagRoutes = new Hono()

tagRoutes.get('/', (c) => c.json(listTags()))

tagRoutes.post('/', async (c) => {
  const body = await readJson<{ name: string }>(c)
  return c.json(createTag(body.name), 201)
})

tagRoutes.delete('/:id', (c) => {
  deleteTag(Number(c.req.param('id')))
  return c.body(null, 204)
})
