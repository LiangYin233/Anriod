import type { MediaProgress, MediaType } from '@anriod/shared'
import { isChapterBased } from '@anriod/shared'
export { isChapterBased }

export function progressVal(p: MediaProgress | null | undefined): number {
  return p?.chapter ?? p?.episode ?? 0
}

/**
 * Get the unit abbreviation for progress (CH for chapters, EP for episodes)
 */
export function progressUnit(type: MediaType): string {
  return isChapterBased(type) ? 'CH' : 'EP'
}

/**
 * Get the localized label for progress type
 */
export function progressLabel(type: MediaType): string {
  return isChapterBased(type) ? '章节' : '集数'
}

