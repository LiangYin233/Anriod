import { Hono } from 'hono'
import type { DiscoverResponse, DiscoverSection } from '@anriod/shared'
import { dataSources } from '../datasources/registry'
import { HttpError } from '../middleware/error'

// ── In-memory cache ──
let cached: { data: DiscoverResponse; expiresAt: number } | null = null

function getMidnight(): number {
  const now = new Date()
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0)
  return midnight.getTime()
}

export const discoverRoutes = new Hono()

/**
 * GET /api/discover
 * Aggregate discover content from all enabled data sources.
 * Results are cached in-memory until 24:00 of the current day.
 */
discoverRoutes.get('/', async (c) => {
  // Check cache
  const now = Date.now()
  if (cached && cached.expiresAt > now) {
    return c.json(cached.data)
  }

  const sections: DiscoverSection[] = []
  const errors: string[] = []
  const sourceNames = Object.keys(dataSources)

  if (sourceNames.length === 0) {
    throw new HttpError(400, 'No data sources are enabled. Check your config.yaml.')
  }

  for (const [name, ds] of Object.entries(dataSources)) {
    if (typeof ds.getDiscover !== 'function') continue

    try {
      const result = await ds.getDiscover()
      sections.push(...result)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${name}: ${msg}`)
      console.error(`[discover] ${name} failed:`, msg)
    }
  }

  const response: DiscoverResponse = { sections }

  // If all sources failed, report error
  if (sections.length === 0 && errors.length > 0) {
    throw new HttpError(502, `所有数据源请求失败: ${errors.join('; ')}`)
  }

  if (errors.length > 0) {
    console.warn(`[discover] partial failures:`, errors)
  }

  // Cache until midnight
  cached = { data: response, expiresAt: getMidnight() }

  return c.json(response)
})
