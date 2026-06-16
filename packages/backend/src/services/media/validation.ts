import type { CreateMediaInput, UpdateMediaInput } from '@anriod/shared'
import { ERROR_MESSAGES, MAX_RATING, MIN_RATING } from '../../constants'
import { HttpError } from '../../middleware/error'
import { isMediaType, isStatus } from '../../utils/http'

export function validateMediaInput(input: CreateMediaInput | UpdateMediaInput, partial = false) {
  if (!partial || input.title !== undefined) {
    if (!input.title?.trim()) throw new HttpError(400, ERROR_MESSAGES.TITLE_REQUIRED)
  }

  if (!partial || input.type !== undefined) {
    if (!isMediaType(input.type)) throw new HttpError(400, ERROR_MESSAGES.INVALID_MEDIA_TYPE)
  }

  if (input.status !== undefined && !isStatus(input.status)) {
    throw new HttpError(400, ERROR_MESSAGES.INVALID_STATUS)
  }

  if (input.rating !== undefined && input.rating !== null && (input.rating < MIN_RATING || input.rating > MAX_RATING)) {
    throw new HttpError(400, ERROR_MESSAGES.INVALID_RATING)
  }
}
