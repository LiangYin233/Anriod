import { describe, test, expect, beforeAll } from 'bun:test'
import { initTestEnv } from './helpers'

let configModule: Awaited<typeof import('../config')>

beforeAll(async () => {
  await initTestEnv()
  configModule = await import('../config')
})

describe('yaml parser internals', () => {
  // Access internal functions by re-parsing known patterns
  test('resolves backend root to a non-empty path', () => {
    expect(configModule.backendRoot).toBeTruthy()
    expect(typeof configModule.backendRoot).toBe('string')
  })

  test('resolveBackendPath handles absolute paths', () => {
    const abs = configModule.resolveBackendPath('/tmp/test')
    expect(abs).toBe('/tmp/test')
  })

  test('resolveBackendPath resolves relative paths', () => {
    const rel = configModule.resolveBackendPath('./extra')
    expect(rel).toContain('extra')
  })
})

describe('config parsing', () => {
  test('reads server port from config', () => {
    expect(configModule.config.server.port).toBe(0)
  })

  test('reads server host', () => {
    expect(configModule.config.server.host).toBe('localhost')
  })

  test('reads auth api key', () => {
    expect(configModule.config.auth.apiKey).toBe('test-api-key')
  })

  test('resolves database path relative to backend root', () => {
    expect(configModule.config.database.path).toContain('test.db')
  })

  test('resolves covers directory', () => {
    expect(configModule.config.storage.coversDir).toContain('covers')
  })

  test('disables bangumi datasource', () => {
    expect(configModule.config.datasources.bangumi.enabled).toBe(false)
  })

  test('reads empty sync cron', () => {
    expect(configModule.config.sync.cron).toBe('')
  })

  test('proxy is undefined when not set', () => {
    expect(configModule.config.proxy).toBeUndefined()
  })
})
