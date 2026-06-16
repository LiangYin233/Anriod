import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger as honoLogger } from 'hono/logger'
import { basename, extname, join } from 'node:path'
import { eq } from 'drizzle-orm'
import { config } from './config'
import { logger } from './logger'
import { initializeDatabase, db } from './db/client'
import { media } from './db/schema'
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
import { downloadQueue } from './utils/download-queue'

/** Look up the remote cover URL for a media item and return it for 302 redirect. */
function findCoverUrl(mediaId: string): string | undefined {
  if (!mediaId) return undefined
  const row = db.select({ cover_url: media.cover_url })
    .from(media)
    .where(eq(media.id, mediaId))
    .get()
  if (row?.cover_url && typeof row.cover_url === 'string' && row.cover_url.startsWith('http')) {
    return row.cover_url
  }
  return undefined
}

export const app = new Hono()

app.use('*', honoLogger())
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}))
app.onError(handleError)
app.notFound(notFound)

app.get('/health', (c) => c.json({ ok: true, service: 'anriod-backend' }))

app.get('/covers/:filename', async (c) => {
  const filename = basename(c.req.param('filename'))
  const coverFile = Bun.file(join(config.coversDir, filename))

  if (await coverFile.exists()) {
    return new Response(coverFile)
  }

  // Local file missing — try to recover a remote URL from the database
  const mediaId = filename.replace(extname(filename), '')
  const remoteUrl = findCoverUrl(mediaId)
  if (remoteUrl) {
    // Queue a background download so the local file is ready next time
    downloadQueue.add({ mediaId, coverUrl: remoteUrl, savePath: `${config.coversDir}/${mediaId}` })
    return c.redirect(remoteUrl)
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

let server: ReturnType<typeof Bun.serve> | null = null

export function startServer() {
  if (server) return server

  initializeDatabase()

  server = Bun.serve({
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

  return server
}

if (import.meta.main) {
  startServer()
}
