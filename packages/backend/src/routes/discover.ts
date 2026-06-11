import { Hono } from 'hono'
import type { DiscoverResponse, DiscoverSection } from '@anriod/shared'
import { dataSources } from '../datasources/registry'
import { HttpError } from '../middleware/error'

export const discoverRoutes = new Hono()

/**
 * GET /api/discover
 * Aggregate discover content from all enabled data sources.
 * Each data source may contribute 0+ sections.
 */
discoverRoutes.get('/', async (c) => {
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

  // If some sources failed, attach errors as non-enumerable metadata
  if (errors.length > 0) {
    console.warn(`[discover] partial failures:`, errors)
  }

  return c.json(response)
})
