import type { Context, Next } from 'hono'
import { timingSafeEqual } from 'node:crypto'
import { config } from '../config'
import { ERROR_MESSAGES } from '../constants'

export async function authMiddleware(c: Context, next: Next) {
  if (c.req.method === 'OPTIONS') {
    await next()
    return
  }

  const authHeader = c.req.header('Authorization')
  const expectedToken = `Bearer ${config.auth.apiKey}`

  if (!authHeader || authHeader.length !== expectedToken.length) {
    return c.json({ error: ERROR_MESSAGES.UNAUTHORIZED }, 401)
  }

  const isValid = timingSafeEqual(
    Buffer.from(authHeader),
    Buffer.from(expectedToken)
  )

  if (!isValid) {
    return c.json({ error: ERROR_MESSAGES.UNAUTHORIZED }, 401)
  }

  await next()
}
