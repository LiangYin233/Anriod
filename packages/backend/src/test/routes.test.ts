import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { initTestEnv, clearAllTables } from './helpers'

let app: Awaited<ReturnType<typeof import('../index')>>['default']
let fetchApi: (path: string, init?: RequestInit) => Promise<Response>
let authHeaders: Record<string, string>

beforeAll(async () => {
  await initTestEnv()
  await clearAllTables()

  // Import the app — it will use the test config (port 0, so Bun.serve is harmless)
  const indexModule = await import('../index')
  app = indexModule.default

  authHeaders = { Authorization: 'Bearer test-api-key', 'Content-Type': 'application/json' }

  fetchApi = (path, init = {}) =>
    app.request(`http://localhost${path}`, {
      ...init,
      headers: { ...authHeaders, ...init.headers },
    })
})

afterAll(async () => {
  // Close the test server if one was started
  try {
    const { sqlite } = await import('../db/client')
    sqlite.close()
  } catch { /* ignore */ }
})

describe('health endpoint', () => {
  test('GET /health returns ok', async () => {
    const res = await app.request('http://localhost/health')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.service).toBe('anriod-backend')
  })
})

describe('auth middleware', () => {
  test('rejects requests without auth header', async () => {
    // Use app.request directly to avoid fetchApi which auto-adds auth
    const res = await app.request('http://localhost/api/media')
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  test('rejects requests with wrong auth header', async () => {
    const res = await app.request('http://localhost/api/media', {
      headers: { Authorization: 'Bearer wrong-key' },
    })
    expect(res.status).toBe(401)
  })

  test('allows requests with correct auth header', async () => {
    const res = await fetchApi('/api/media')
    expect(res.status).toBe(200)
  })
})

describe('media routes', () => {
  test('POST /api/media creates media', async () => {
    const res = await fetchApi('/api/media', {
      method: 'POST',
      body: JSON.stringify({ title: 'Route Test', type: 'anime' }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.title).toBe('Route Test')
    expect(body.id).toBeTruthy()
  })

  test('POST /api/media rejects invalid data', async () => {
    const res = await fetchApi('/api/media', {
      method: 'POST',
      body: JSON.stringify({ title: '', type: 'anime' }),
    })
    expect(res.status).toBe(400)
  })

  test('GET /api/media lists media', async () => {
    const res = await fetchApi('/api/media')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toBeDefined()
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.pagination).toBeDefined()
  })

  test('GET /api/media?type=anime filters by type', async () => {
    const res = await fetchApi('/api/media?type=anime')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.every((m: any) => m.type === 'anime')).toBe(true)
  })

  test('GET /api/media/:id returns single media', async () => {
    // First create one
    const created = await (await fetchApi('/api/media', {
      method: 'POST',
      body: JSON.stringify({ title: 'Get By ID', type: 'movie' }),
    })).json()

    const res = await fetchApi(`/api/media/${created.id}`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.title).toBe('Get By ID')
  })

  test('GET /api/media/:id returns 404 for non-existent', async () => {
    const res = await fetchApi('/api/media/non-existent-id')
    expect(res.status).toBe(404)
  })
})

describe('tag routes', () => {
  test('GET /api/tags returns tags', async () => {
    const res = await fetchApi('/api/tags')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })

  test('POST /api/tags creates a tag', async () => {
    const res = await fetchApi('/api/tags', {
      method: 'POST',
      body: JSON.stringify({ name: 'route-tag' }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.name).toBe('route-tag')
  })
})

describe('search routes', () => {
  test('GET /api/search/sources returns sources', async () => {
    const res = await fetchApi('/api/search/sources')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toBeDefined()
    // With bangumi disabled in test config, sources should be empty
    expect(Array.isArray(body.data)).toBe(true)
  })
})

describe('statistics routes', () => {
  test('GET /api/statistics/overview returns stats', async () => {
    const res = await fetchApi('/api/statistics/overview')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.total).toBeDefined()
    expect(body.by_status).toBeDefined()
    expect(body.by_type).toBeDefined()
  })
})

describe('backup routes', () => {
  test('GET /api/backup/export returns json', async () => {
    const res = await fetchApi('/api/backup/export')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.version).toBe(1)
    expect(Array.isArray(body.media)).toBe(true)
  })

  test('POST /api/backup/import validates format', async () => {
    const res = await fetchApi('/api/backup/import', {
      method: 'POST',
      body: JSON.stringify({ version: 1, media: [], tags: [], watch_history: [] }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  test('POST /api/backup/import rejects bad format', async () => {
    const res = await fetchApi('/api/backup/import', {
      method: 'POST',
      body: JSON.stringify({ version: 2 }),
    })
    expect(res.status).toBe(400)
  })
})

describe('history routes', () => {
  test('GET /api/history returns history', async () => {
    const res = await fetchApi('/api/history')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toBeDefined()
    expect(Array.isArray(body.data)).toBe(true)
  })
})

describe('404 handling', () => {
  test('returns 404 for unknown routes', async () => {
    const res = await fetchApi('/api/nonexistent')
    expect(res.status).toBe(404)
  })
})
