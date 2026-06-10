import { sqlite } from './client'

export type SqlValue = string | number | boolean | null | Uint8Array

export function all<T>(sql: string, params: SqlValue[] = []): T[] {
  return sqlite.query(sql).all(...(params as any[])) as T[]
}

export function get<T>(sql: string, params: SqlValue[] = []): T | null {
  return (sqlite.query(sql).get(...(params as any[])) as T | null) ?? null
}

export function run(sql: string, params: SqlValue[] = []) {
  return sqlite.query(sql).run(...(params as any[]))
}

export function transaction<T>(callback: () => T): T {
  const tx = sqlite.transaction(callback)
  return tx()
}
