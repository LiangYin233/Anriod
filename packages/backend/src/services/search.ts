import type { SearchResult } from '@anriod/shared'
import { dataSources, getDataSource } from '../datasources/registry'
import { HttpError } from '../middleware/error'
import { isMediaType } from '../utils/http'
import { ERROR_MESSAGES } from '../constants'

export async function searchExternal(query: { query?: string; type?: string; source?: string }): Promise<SearchResult[]> {
  const keyword = query.query?.trim()
  if (!keyword) throw new HttpError(400, ERROR_MESSAGES.SEARCH_QUERY_REQUIRED)

  const mediaType = isMediaType(query.type) ? query.type : undefined
  const sources = query.source ? [query.source] : Object.keys(dataSources)

  const errors: string[] = []
  const results: SearchResult[] = []

  for (const sourceName of sources) {
    const dataSource = getDataSource(sourceName)
    if (!dataSource) {
      errors.push(`${sourceName}: unknown source`)
      continue
    }
    try {
      const items = await dataSource.search(keyword, mediaType)
      results.push(...items)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${sourceName}: ${msg}`)
      console.error(`[search] ${sourceName} failed:`, msg)
    }
  }

  // If all sources failed, report the errors
  if (results.length === 0 && errors.length > 0) {
    throw new HttpError(502, `所有数据源请求失败: ${errors.join('; ')}`)
  }

  return results
}
