/**
 * Runtime DDL generation from drizzle-orm schema definitions.
 *
 * Iterates over all drizzle table objects (imported from ./schema), extracts
 * column types, constraints, indexes, and foreign keys via `getTableConfig`,
 * then produces and executes `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS`
 * statements.  This makes the ORM definitions the single source of truth —
 * no duplicated raw SQL strings that can drift out of sync.
 */

import { SQL } from 'drizzle-orm'
import { getTableConfig } from 'drizzle-orm/sqlite-core'
import type { SQLiteTable, Index } from 'drizzle-orm/sqlite-core'
import * as schema from './schema'
import { sqlite } from './connection'

// ── helpers ────────────────────────────────────────────────────────────

/**
 * Convert a drizzle column default value into a SQL DEFAULT clause string.
 * Returns `null` when there is no default.
 *
 * Handles three cases:
 * 1. `undefined` — no default
 * 2. string / number literals — `DEFAULT 'foo'` / `DEFAULT 42`
 * 3. drizzle `SQL` expressions — `DEFAULT CURRENT_TIMESTAMP` etc.
 */
function defaultClause(defaultValue: unknown): string | null {
  if (defaultValue === undefined || defaultValue === null) return null

  // Plain JS primitives → SQL literal
  if (typeof defaultValue === 'string') {
    return `'${defaultValue.replace(/'/g, "''")}'`
  }
  if (typeof defaultValue === 'number' || typeof defaultValue === 'boolean') {
    return String(defaultValue)
  }

  // drizzle SQL expression, e.g. sql`CURRENT_TIMESTAMP`
  if (defaultValue instanceof SQL) {
    const chunks: unknown[] = defaultValue.queryChunks
    return chunks
      .map((chunk) => {
        if (typeof chunk === 'string') return chunk
        // StringChunk: drizzle wraps string literals in this class
        if (chunk !== null && typeof chunk === 'object' && 'value' in chunk) {
          const arr = (chunk as { value: unknown }).value
          if (Array.isArray(arr)) return arr.join('')
        }
        // For nested SQL or other chunk types we can't safely stringify
        return ''
      })
      .join('')
  }

  return null
}

/**
 * Detect whether a column's config indicates `autoIncrement`.
 *
 * drizzle stores per-dialect runtime config (including `autoIncrement` for
 * integer columns) in a protected `config` bag — we access it via a narrow
 * dynamic key rather than making it part of the public API.
 */
function isAutoIncrement(column: object): boolean {
  // Only INTEGER columns can be auto-increment in SQLite.
  if ((column as { getSQLType(): string }).getSQLType().toUpperCase() !== 'INTEGER') return false
  return (column as { config?: { autoIncrement?: boolean } }).config?.autoIncrement === true
}

// ── DDL generators ─────────────────────────────────────────────────────

/** Build a single column definition line for a CREATE TABLE statement. */
function generateColumnDef(column: {
  name: string
  primary: boolean
  notNull: boolean
  isUnique: boolean
  default: unknown
  getSQLType(): string
}): string {
  const parts: string[] = [column.name, column.getSQLType()]

  // Primary key — single column only (composite PKs are handled at table level)
  if (column.primary) {
    if (isAutoIncrement(column)) {
      parts.push('PRIMARY KEY AUTOINCREMENT')
    } else {
      parts.push('PRIMARY KEY')
    }
  }

  if (column.notNull) parts.push('NOT NULL')

  const def = defaultClause(column.default)
  if (def !== null) {
    parts.push(`DEFAULT ${def}`)
  }

  if (column.isUnique) parts.push('UNIQUE')

  return parts.join(' ')
}

/** Build a table-level PRIMARY KEY clause for composite keys. */
function generatePrimaryKeyClause(
  table: SQLiteTable
): string | null {
  const { primaryKeys } = getTableConfig(table)
  if (primaryKeys.length === 0) return null

  for (const pk of primaryKeys) {
    // Single-column PKs are already handled in the column definition.
    if (pk.columns.length <= 1) continue
    const colNames = pk.columns.map((col) => col.name).join(', ')
    return `PRIMARY KEY (${colNames})`
  }

  return null
}

/** Build one or more FOREIGN KEY clauses for a CREATE TABLE statement. */
function generateForeignKeyClauses(table: SQLiteTable): string[] {
  const { foreignKeys } = getTableConfig(table)
  const clauses: string[] = []

  for (const fk of foreignKeys) {
    const ref = fk.reference()
    const localCols = ref.columns.map((col) => col.name).join(', ')
    const foreignTableName = getTableConfig(ref.foreignTable).name
    const foreignCols = ref.foreignColumns.map((col) => col.name).join(', ')

    let clause = `FOREIGN KEY (${localCols}) REFERENCES ${foreignTableName}(${foreignCols})`
    if (fk.onDelete) clause += ` ON DELETE ${fk.onDelete.toUpperCase().replace(/\s+/g, ' ')}`
    if (fk.onUpdate) clause += ` ON UPDATE ${fk.onUpdate.toUpperCase().replace(/\s+/g, ' ')}`

    clauses.push(clause)
  }

  return clauses
}

/** Build a complete CREATE TABLE IF NOT EXISTS statement. */
function generateCreateTable(table: SQLiteTable): string {
  const { name, columns } = getTableConfig(table)

  const colDefs = columns.map((col) => `  ${generateColumnDef(col)}`)

  // Composite primary key (single-column handled in column def)
  const pkClause = generatePrimaryKeyClause(table)
  if (pkClause) colDefs.push(`  ${pkClause}`)

  // Foreign keys
  const fkClauses = generateForeignKeyClauses(table)
  for (const fk of fkClauses) colDefs.push(`  ${fk}`)

  return `CREATE TABLE IF NOT EXISTS ${name} (\n${colDefs.join(',\n')}\n);`
}

/** Resolve the columns referenced by an index into a comma-separated name list. */
function indexColumnNames(idx: Index): string {
  return idx.config.columns
    .map((col) => {
      // Column-based index
      if ('name' in col) return col.name
      // Expression-based index — fall back to empty (shouldn't occur in this schema)
      return ''
    })
    .filter(Boolean)
    .join(', ')
}

/** Build a CREATE INDEX IF NOT EXISTS statement. */
function generateCreateIndex(idx: Index, tableName: string): string {
  const cols = indexColumnNames(idx)
  if (!cols) return ''

  const unique = idx.config.unique ? 'UNIQUE ' : ''
  return `CREATE ${unique}INDEX IF NOT EXISTS ${idx.config.name} ON ${tableName}(${cols});`
}

// ── public API ─────────────────────────────────────────────────────────

/** Tables exported from `./schema` that are actual drizzle table objects. */
function collectTables(): SQLiteTable[] {
  const tables: SQLiteTable[] = []
  for (const value of Object.values(schema)) {
    if (value === null || typeof value !== 'object') continue
    try {
      // `getTableConfig` only succeeds on actual drizzle table instances
      getTableConfig(value as unknown as SQLiteTable)
      tables.push(value as unknown as SQLiteTable)
    } catch {
      // Not a table — skip (type exports, helper values, etc.)
    }
  }
  return tables
}

/**
 * Apply the full drizzle schema to the database.
 *
 * Safe to call on every startup — all statements use `IF NOT EXISTS`
 * and the database is expected to survive across restarts.
 */
export function syncSchema(): void {
  const tables = collectTables()

  for (const table of tables) {
    const { name: tableName, indexes } = getTableConfig(table)

    // 1. Create table
    const createSql = generateCreateTable(table)
    sqlite.run(createSql)

    // 2. Create indexes on that table
    for (const idx of indexes) {
      const idxSql = generateCreateIndex(idx, tableName)
      if (idxSql) sqlite.run(idxSql)
    }
  }
}
