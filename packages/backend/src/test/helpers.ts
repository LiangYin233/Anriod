/**
 * Test helpers.
 *
 * Call `initTestEnv()` once per test file to create a temporary
 * config.yaml + SQLite database.  Because ESM modules are cached
 * across test files, the database is shared — use `clearAllTables()`
 * in beforeAll to isolate each test suite.
 */

let initialized = false

/** Create temp config, chdir, initialize DB. Safe to call multiple times. */
export async function initTestEnv() {
  if (initialized) return
  initialized = true

  const { mkdtempSync, writeFileSync, mkdirSync } = await import('node:fs')
  const { join } = await import('node:path')
  const { tmpdir } = await import('node:os')

  const dir = mkdtempSync(join(tmpdir(), 'anriod-test-'))
  mkdirSync(join(dir, 'data'))

  writeFileSync(join(dir, 'config.yaml'), [
    'server:',
    '  port: 0',
    '  host: localhost',
    'auth:',
    '  api_key: "test-api-key"',
    'sync:',
    '  cron: ""',
    'datasources:',
    '  bangumi:',
    '    enabled: false',
    '    base_url: https://api.bgm.tv',
    '    bgm_token: ""',
  ].join('\n'))

  process.chdir(dir)

  const { initializeDatabase } = await import('../db/client')
  initializeDatabase()
}

/** Clear all data from every table. */
export async function clearAllTables() {
  const { db } = await import('../db/client')
  const { media, mediaTags, tags, watchHistory } = await import('../db/schema')
  db.delete(watchHistory).run()
  db.delete(mediaTags).run()
  db.delete(tags).run()
  db.delete(media).run()
}
