import { Hono } from 'hono'
import { getDataSource, listDataSources } from '../datasources/registry'
import { searchExternal } from '../services/search'

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
