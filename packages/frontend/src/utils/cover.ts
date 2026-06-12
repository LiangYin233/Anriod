import { getStoredConfig, normalizeBackendUrl } from './api'

/**
 * Get the display source URL for a cover image.
 *
 * @param coverUrl - The cover_url value from Media object
 * @returns The full URL to display (remote or local with backend URL prepended)
 *
 * @example
 * getCoverSrc('https://example.com/image.jpg') // 'https://example.com/image.jpg'
 * getCoverSrc('/covers/123.jpg') // 'http://localhost:8000/covers/123.jpg'
 * getCoverSrc(null) // ''
 */
export function getCoverSrc(coverUrl: string | null | undefined): string {
  if (!coverUrl) return ''

  // If it's a remote URL, return as-is
  if (coverUrl.startsWith('http')) {
    return coverUrl
  }

  // If it's a local path (e.g., "/covers/123.jpg"), prepend backend URL
  const { backendUrl } = getStoredConfig()
  if (backendUrl) {
    return `${normalizeBackendUrl(backendUrl)}${coverUrl}`
  }

  return coverUrl
}
