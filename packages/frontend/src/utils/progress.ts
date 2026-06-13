import type { MediaProgress, MediaType } from '@anriod/shared'

/**
 * Check if a media type uses chapter-based progress (novels, manga) vs episode-based
 */
export function isChapterBased(type: MediaType): boolean {
  return type === 'novel' || type === 'manga'
}

/**
 * Extract the numeric progress value from a MediaProgress object
 */
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

/**
 * Format a watch-history progress range (e.g. EP1 → EP3, CH5).
 */
export function historyProgressLabel(progressFrom: MediaProgress | null | undefined, progressTo: MediaProgress | null | undefined): string {
  const fromVal = progressVal(progressFrom)
  const toVal = progressVal(progressTo)
  if (toVal <= 0) return ''

  const prefix = progressFrom?.chapter !== undefined || progressTo?.chapter !== undefined ? 'CH' : 'EP'
  return fromVal > 0 && fromVal !== toVal ? `${prefix}${fromVal} → ${prefix}${toVal}` : `${prefix}${toVal}`
}
