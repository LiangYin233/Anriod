import { drizzle } from 'drizzle-orm/bun-sqlite'
import * as schema from './schema'
import { sqlite } from './connection'
import { syncSchema } from './schema-sync'

export const db = drizzle(sqlite, { schema })

type AppDb = typeof db
type AppTransaction = Parameters<Parameters<AppDb['transaction']>[0]>[0]
export type AppDbExecutor = Pick<AppDb | AppTransaction, 'select' | 'insert' | 'update' | 'delete'>

export function initializeDatabase() {
  syncSchema()
}
