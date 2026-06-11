import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger as honoLogger } from 'hono/logger'
import { basename, join } from 'node:path'
import { config } from './config'
import { logger } from './logger'
import { initializeDatabase } from './db/client'
import { authMiddleware } from './middleware/auth'
import { handleError, notFound } from './middleware/error'
import { backupRoutes } from './routes/backup'
import { discoverRoutes } from './routes/discover'
import { historyRoutes } from './routes/history'
import { mediaRoutes } from './routes/media'
import { searchRoutes } from './routes/search'
import { syncRoutes } from './routes/sync'
import { statisticsRoutes } from './routes/statistics'
import { tagRoutes } from './routes/tag'
import { startSyncScheduler } from './services/sync'

initializeDatabase()

const app = new Hono()

app.use('*', honoLogger())
app.use('*', cors())
app.onError(handleError)
app.notFound(notFound)

app.get('/health', (c) => c.json({ ok: true, service: 'anriod-backend' }))

app.get('/covers/:filename', async (c) => {
  const filename = basename(c.req.param('filename'))
  const coverFile = Bun.file(join(config.coversDir, filename))

  if (await coverFile.exists()) {
    return new Response(coverFile)
  }

  return new Response(Bun.file(join(config.backendRoot, 'assets/placeholder.svg')), {
    headers: { 'Content-Type': 'image/svg+xml' }
  })
})

app.use('/api/*', authMiddleware)
app.route('/api/media', mediaRoutes)
app.route('/api/tags', tagRoutes)
app.route('/api/history', historyRoutes)
app.route('/api/search', searchRoutes)
app.route('/api/backup', backupRoutes)
app.route('/api/sync', syncRoutes)
app.route('/api/statistics', statisticsRoutes)
app.route('/api/discover', discoverRoutes)

const server = Bun.serve({
  hostname: config.server.host,
  port: config.server.port,
  fetch: app.fetch,
  reusePort: false
})

startSyncScheduler()

logger.success('Anriod Backend Server 已启动')
logger.info(`地址: http://${server.hostname}:${server.port}`)
logger.info(`数据库: ${config.databasePath}`)
logger.info(`同步: ${config.sync.cron || '未启用'}`)
