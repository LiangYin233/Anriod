import type { MediaDetails, MediaType, SearchResult } from '@anriod/shared'
import { config } from '../config'
import { proxyFetchOptions } from '../utils/proxy'
import type { DataSource } from './types'

// ============================================================
// TMDB v3 API types
// ============================================================

interface TmdbSearchResult {
  id: number
  media_type: 'movie' | 'tv' | 'person'
  title?: string        // movie
  name?: string         // tv
  original_title?: string
  original_name?: string
  release_date?: string // movie
  first_air_date?: string // tv
  poster_path?: string | null
  vote_average?: number
  overview?: string
  genre_ids?: number[]
}

interface TmdbSearchResponse {
  page: number
  results: TmdbSearchResult[]
  total_pages: number
  total_results: number
}

interface TmdbMovieDetail {
  id: number
  title: string
  original_title: string
  overview: string
  release_date: string
  poster_path: string | null
  vote_average: number
  runtime: number | null
  genres: Array<{ id: number; name: string }>
  production_companies: Array<{ id: number; name: string }>
  tagline: string
  homepage: string
  status: string
}

interface TmdbTvDetail {
  id: number
  name: string
  original_name: string
  overview: string
  first_air_date: string
  poster_path: string | null
  vote_average: number
  number_of_episodes: number
  number_of_seasons: number
  genres: Array<{ id: number; name: string }>
  networks: Array<{ id: number; name: string }>
  production_companies: Array<{ id: number; name: string }>
  type: string
  status: string
  last_air_date: string | null
  homepage: string
}

// ============================================================
// Helpers
// ============================================================

const TMDB_BASE = 'https://api.themoviedb.org/3'
const IMAGE_BASE = 'https://image.tmdb.org/t/p/w500'

const TMDB_MEDIA_TYPE: Record<string, MediaType> = {
  movie: 'movie',
  tv: 'tv',
}

function posterUrl(path: string | null | undefined): string | null {
  return path ? `${IMAGE_BASE}${path}` : null
}

function titleOf(result: TmdbSearchResult): string {
  return result.title || result.name || `TMDB #${result.id}`
}

function yearOf(date: string | null | undefined): number | undefined {
  if (!date) return undefined
  const y = Number(date.slice(0, 4))
  return isNaN(y) ? undefined : y
}

// ============================================================
// DataSource implementation
// ============================================================

export class TmdbDataSource implements DataSource {
  name = 'tmdb'

  supportedTypes: MediaType[] = ['movie', 'tv']

  private get headers(): Record<string, string> {
    const token = config.datasources.tmdb?.accessToken
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    }
  }

  private get baseUrl(): string {
    return config.datasources.tmdb?.baseUrl || TMDB_BASE
  }

  private get language(): string {
    return config.datasources.tmdb?.language || 'zh-CN'
  }

  // ── Search ──────────────────────────────────────────────

  async search(query: string, mediaType?: MediaType): Promise<SearchResult[]> {
    const url = mediaType === 'movie'
      ? `${this.baseUrl}/search/movie`
      : mediaType === 'tv'
        ? `${this.baseUrl}/search/tv`
        : `${this.baseUrl}/search/multi`

    const params = new URLSearchParams({ query, language: this.language, page: '1' })
    if (mediaType === 'movie') params.set('include_adult', 'false')
    if (mediaType === 'tv') params.set('include_adult', 'false')

    let response: Response
    try {
      response = await fetch(`${url}?${params}`, {
        headers: this.headers,
        ...proxyFetchOptions(),
      })
    } catch (err) {
      throw new Error(`无法连接 TMDB (${this.baseUrl}): ${err instanceof Error ? err.message : String(err)}`)
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`TMDB 搜索失败 (${response.status}): ${text || response.statusText}`)
    }

    const payload = (await response.json()) as TmdbSearchResponse
    const results = payload.results || []

    return results
      .filter((r) => r.media_type !== 'person')
      .map((r) => ({
        source: this.name,
        source_id: String(r.id),
        title: titleOf(r),
        cover_url: posterUrl(r.poster_path),
        year: yearOf(r.release_date || r.first_air_date),
        media_type: TMDB_MEDIA_TYPE[r.media_type] || 'movie',
        external_rating: r.vote_average ? Math.round(r.vote_average * 10) / 10 : undefined,
      }))
  }

  // ── GetDetails ──────────────────────────────────────────

  async getDetails(sourceId: string, mediaType: MediaType = 'movie'): Promise<MediaDetails> {
    const endpoint = mediaType === 'tv' ? 'tv' : 'movie'
    const url = `${this.baseUrl}/${endpoint}/${sourceId}?language=${this.language}`

    let response: Response
    try {
      response = await fetch(url, {
        headers: this.headers,
        ...proxyFetchOptions(),
      })
    } catch (err) {
      throw new Error(`无法连接 TMDB (${this.baseUrl}): ${err instanceof Error ? err.message : String(err)}`)
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`TMDB 详情获取失败 (${response.status}): ${text || response.statusText}`)
    }

    if (mediaType === 'tv') {
      const subject = (await response.json()) as TmdbTvDetail
      return {
        source: this.name,
        source_id: String(subject.id),
        title: subject.name,
        media_type: 'tv',
        description: subject.overview || null,
        cover_url: posterUrl(subject.poster_path),
        air_date: subject.first_air_date || undefined,
        total_episodes: subject.number_of_episodes || undefined,
        studio: subject.networks?.[0]?.name || subject.production_companies?.[0]?.name || undefined,
        external_rating: subject.vote_average ? Math.round(subject.vote_average * 10) / 10 : undefined,
        source_url: `https://www.themoviedb.org/tv/${subject.id}`,
        raw_metadata: subject as unknown as Record<string, unknown>,
      }
    }

    const subject = (await response.json()) as TmdbMovieDetail
    return {
      source: this.name,
      source_id: String(subject.id),
      title: subject.title,
      media_type: 'movie',
      description: subject.overview || null,
      cover_url: posterUrl(subject.poster_path),
      air_date: subject.release_date || undefined,
      total_episodes: undefined,
      studio: subject.production_companies?.[0]?.name || undefined,
      external_rating: subject.vote_average ? Math.round(subject.vote_average * 10) / 10 : undefined,
      source_url: `https://www.themoviedb.org/movie/${subject.id}`,
      raw_metadata: subject as unknown as Record<string, unknown>,
    }
  }
}
