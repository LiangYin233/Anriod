import { Hono } from 'hono'
import { exportAll, importAll, type ExportData } from '../services/backup'
import { readJson } from '../utils/http'

export const backupRoutes = new Hono()

backupRoutes.get('/export', (c) => {
  const data = exportAll()
  return c.json(data)
})

backupRoutes.post('/import', async (c) => {
  const data = await readJson<ExportData>(c)
  importAll(data)
  return c.json({ ok: true })
})
