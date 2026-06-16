import { Hono } from 'hono'
import { getDiscover } from '../services/discover'

export const discoverRoutes = new Hono()

/**
 * GET /api/discover
 * Aggregate discover content from all enabled data sources.
 * Results are cached in-memory until 24:00 of the current day.
 */
discoverRoutes.get('/', async (c) => c.json(await getDiscover()))
