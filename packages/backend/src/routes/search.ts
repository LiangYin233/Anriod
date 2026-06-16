import { Hono } from 'hono'
import { isMediaType } from '../utils/http'
import { getDataSource, listDataSources } from '../datasources/registry'
import { searchExternal } from '../services/search'
import { HttpError } from '../middleware/error'
import { ERROR_MESSAGES } from '../constants'

export const searchRoutes = new Hono()

searchRoutes.get('/', async (c) =>
  c.json(
    await searchExternal({
      query: c.req.query('query'),
      type: c.req.query('type'),
      source: c.req.query('source')
    })
  )
)

searchRoutes.get('/sources', (c) => {
  const sources = listDataSources().map((name) => {
    const ds = getDataSource(name)
    return {
      name,
      supportedTypes: ds?.supportedTypes ?? []
    }
  })
  return c.json({ data: sources })
})

/**
 * GET /api/search/details
 * Fetch full work details from an external data source without importing.
 * Query params: source (required), source_id (required), type (optional)
 */
searchRoutes.get('/details', async (c) => {
  const sourceName = c.req.query('source')
  const sourceId = c.req.query('source_id')
  const mediaType = c.req.query('type')

  if (!sourceName || !sourceId) {
    throw new HttpError(400, ERROR_MESSAGES.SOURCE_ID_REQUIRED)
  }

  const ds = getDataSource(sourceName)
  if (!ds) {
    const available = listDataSources().join(', ')
    throw new HttpError(400, `${ERROR_MESSAGES.UNKNOWN_DATA_SOURCE}。可用数据源：${available}`)
  }

  const type = mediaType && isMediaType(mediaType) ? mediaType : undefined
  const details = await ds.getDetails(sourceId, type)
  return c.json(details)
})

/**
 * GET /api/search/credits
 * Fetch cast and crew for a work from an external data source.
 * Query params: source (required), source_id (required), type (optional)
 */
searchRoutes.get('/credits', async (c) => {
  const sourceName = c.req.query('source')
  const sourceId = c.req.query('source_id')
  const mediaType = c.req.query('type')

  if (!sourceName || !sourceId) {
    throw new HttpError(400, ERROR_MESSAGES.SOURCE_ID_REQUIRED)
  }

  const ds = getDataSource(sourceName)
  if (!ds) {
    const available = listDataSources().join(', ')
    throw new HttpError(400, `${ERROR_MESSAGES.UNKNOWN_DATA_SOURCE}。可用数据源：${available}`)
  }

  if (typeof ds.getCredits !== 'function') {
    throw new HttpError(400, ERROR_MESSAGES.DATA_SOURCE_NO_CREDITS)
  }

  const type = mediaType && isMediaType(mediaType) ? mediaType : undefined
  const credits = await ds.getCredits(sourceId, type)
  return c.json(credits)
})
