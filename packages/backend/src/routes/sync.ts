import { Hono } from 'hono'
import { runSync } from '../services/sync'

export const syncRoutes = new Hono()

syncRoutes.post('/trigger', async (c) => {
  const result = await runSync()
  return c.json(result)
})
