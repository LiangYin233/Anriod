import { Hono } from 'hono'
import { runSync, triggerCoverMigration } from '../services/sync'

export const syncRoutes = new Hono()

syncRoutes.post('/trigger', async (c) => {
  const result = await runSync()
  return c.json(result)
})

syncRoutes.post('/covers', (c) => {
  const result = triggerCoverMigration()
  return c.json(result)
})
