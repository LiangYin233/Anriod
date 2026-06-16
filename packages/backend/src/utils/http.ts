import { proxyFetchOptions } from './proxy'
import type { Context } from 'hono'
import { MEDIA_TYPE_VALUES, STATUS_VALUES, type MediaType, type Status } from '@anriod/shared'

const DEFAULT_TIMEOUT_MS = 10_000

/**
 * Thin wrapper around fetch for data source HTTP requests.
 * Automatically injects proxy options and enforces a timeout.
 *
 * Every data source call goes through this so timeout / retry / logging
 * can be managed in one place.
 */
export async function dataSourceFetch(
  url: string,
  options: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...proxyFetchOptions(),
      ...options,
      signal: controller.signal
    })
    return response
  } finally {
    clearTimeout(timer)
  }
}

export function isMediaType(value: unknown): value is MediaType {
  return typeof value === 'string' && (MEDIA_TYPE_VALUES as readonly string[]).includes(value)
}

export function isStatus(value: unknown): value is Status {
  return typeof value === 'string' && (STATUS_VALUES as readonly string[]).includes(value)
}

export function parseOptionalInt(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.trunc(parsed) : undefined
}

export function toInt(value: unknown, fallback: number, min = 1, max = 100): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(parsed)))
}

export async function readJson<T = Record<string, unknown>>(c: Context): Promise<T> {
  try {
    return (await c.req.json()) as T
  } catch {
    throw new Error('Invalid JSON body')
  }
}
