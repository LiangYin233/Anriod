import type { DiscoverResponse, DiscoverSection } from '@anriod/shared'
import { ERROR_MESSAGES } from '../constants'
import { dataSources } from '../datasources/registry'
import { HttpError } from '../middleware/error'

let cached: { data: DiscoverResponse; expiresAt: number } | null = null

function getMidnight(): number {
  const now = new Date()
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0)
  return midnight.getTime()
}

export async function getDiscover(): Promise<DiscoverResponse> {
  const now = Date.now()
  if (cached && cached.expiresAt > now) {
    return cached.data
  }

  const sections: DiscoverSection[] = []
  const errors: string[] = []
  if (Object.keys(dataSources).length === 0) {
    throw new HttpError(400, ERROR_MESSAGES.NO_DATA_SOURCES)
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

  if (sections.length === 0 && errors.length > 0) {
    throw new HttpError(502, `所有数据源请求失败: ${errors.join('; ')}`)
  }

  if (errors.length > 0) {
    console.warn(`[discover] partial failures:`, errors)
  }

  cached = { data: response, expiresAt: getMidnight() }

  return response
}
