import type { Context } from 'hono'
import { ERROR_MESSAGES } from '../constants'

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

export function notFound(c: Context) {
  return c.json({ error: ERROR_MESSAGES.NOT_FOUND }, 404)
}

export function handleError(error: unknown, c: Context) {
  if (error instanceof HttpError) {
    return c.json({ error: error.message, details: error.details }, error.status as 400)
  }

  if (error instanceof Error) {
    console.error(error)
    const status = error.message === 'Invalid JSON body' ? 400 : 500
    return c.json({ error: status === 400 ? ERROR_MESSAGES.INVALID_JSON : ERROR_MESSAGES.INTERNAL_SERVER_ERROR }, status)
  }

  console.error(error)
  return c.json({ error: ERROR_MESSAGES.INTERNAL_SERVER_ERROR }, 500)
}
