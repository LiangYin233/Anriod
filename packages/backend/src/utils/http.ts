import type { Context } from 'hono'
import { MEDIA_TYPE_VALUES, STATUS_VALUES, type MediaType, type Status } from '@anriod/shared'

export function isMediaType(value: unknown): value is MediaType {
  return typeof value === 'string' && (MEDIA_TYPE_VALUES as readonly string[]).includes(value)
}

export function isStatus(value: unknown): value is Status {
  return typeof value === 'string' && (STATUS_VALUES as readonly string[]).includes(value)
}

export function toInt(value: unknown, fallback: number, min = 1, max = 100): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(parsed)))
}

export function parseJsonField<T>(value: unknown): T | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string') return value as T

  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

export async function readJson<T = Record<string, unknown>>(c: Context): Promise<T> {
  try {
    return (await c.req.json()) as T
  } catch {
    throw new Error('Invalid JSON body')
  }
}

export function jsonString(value: unknown): string | null {
  if (value === undefined || value === null) return null
  return JSON.stringify(value)
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function ok<T>(data: T) {
  return data
}
