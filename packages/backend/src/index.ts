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

/** Try to extract a remote cover URL from a media row's source metadata. */
function extractCoverFromMeta(meta: unknown): string | undefined {
  if (!meta || typeof meta !== 'object') return undefined
  const m = meta as Record<string, unknown>

  // Bangumi: images.large / images.common / images.medium ...
  const images = m.images as Record<string, string> | undefined
  if (images) {
    return images.large || images.common || images.medium || images.grid
  }

  // TMDB: poster_path
  const poster = m.poster_path as string | null | undefined
  if (poster) return `https://image.tmdb.org/t/p/w500${poster}`

  return undefined
}

/**
 * If the given media has a recoverable cover URL, return it for 302 redirect.
 * Checks cover_url first (may still be remote if download never ran),
 * then falls back to source_metadata.
 */
function findCoverRedirect(mediaId: string): string | undefined {
  if (!mediaId) return undefined
  const row = db.select({ cover_url: media.cover_url, source_metadata: media.source_metadata })
    .from(media)
    .where(eq(media.id, mediaId))
    .get()
  if (!row) return undefined

  if (row.cover_url) {
    // Still a remote URL (download never completed, or DB restored)
    if (typeof row.cover_url === 'string' && row.cover_url.startsWith('http')) {
      return row.cover_url
    }
  }

  // Extract from the original API metadata (covers cases where
  // download-queue already overwrote cover_url with the local path)
  return extractCoverFromMeta(row.source_metadata)
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
  const redirect = findCoverRedirect(mediaId)
  if (redirect) {
    return c.redirect(redirect)
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
