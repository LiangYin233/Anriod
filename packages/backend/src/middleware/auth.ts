import type { Context, Next } from 'hono'
import { config } from '../config'

export async function authMiddleware(c: Context, next: Next) {
  if (c.req.method === 'OPTIONS') {
    await next()
    return
  }

  const authHeader = c.req.header('Authorization')
  const expectedToken = `Bearer ${config.auth.apiKey}`

  if (!authHeader || authHeader !== expectedToken) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  await next()
}
