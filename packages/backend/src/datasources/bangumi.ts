import type { MediaDetails, MediaType, SearchResult } from '@anriod/shared'
import { config } from '../config'
import { proxyFetchOptions } from '../utils/proxy'
import type { DataSource } from './types'

// ============================================================
// Bangumi v0 API types (matching OpenAPI spec)
// ============================================================

/** Bangumi subject type codes: 1=Book, 2=Anime, 3=Music, 4=Game, 6=Real */
const BANGUMI_TYPE_TO_MEDIA: Record<number, MediaType | undefined> = {
  1: 'novel',   // Book → novel
  2: 'anime',
  3: 'anime',   // Music → anime (closest match)
  4: 'game',
  6: 'tv'       // Real → tv/drama
}

const MEDIA_TO_BANGUMI_TYPE: Record<MediaType, number[]> = {
  anime: [2],
  movie: [2, 6],     // also try 三次元 for live-action movies
  tv: [2, 6],
  game: [4],
  novel: [1],
  manga: [1]
}

interface SubjectImage {
  large: string
  common: string
  medium: string
  small: string
  grid: string
}

interface SubjectRating {
  rank: number
  total: number
  count: Record<string, number>
  score: number
}

interface SubjectCollection {
  wish: number
  collect: number
  doing: number
  on_hold: number
  dropped: number
}

/** A wiki infobox item — value can be a plain string or an array of kv pairs */
type InfoboxValue = string | Array<{ k?: string; v: string }>

interface InfoboxItem {
  key: string
  value: InfoboxValue
}

interface BangumiSubject {
  id: number
  type: number
  name: string
  name_cn: string
  summary: string
  nsfw: boolean
  locked: boolean
  date?: string
  platform?: string
  images?: SubjectImage | null
  infobox?: InfoboxItem[]
  volumes?: number
  eps?: number
  total_episodes?: number
  rating?: SubjectRating
  collection?: SubjectCollection
  meta_tags?: string[]
  tags?: Array<{ name: string; count: number }>
}

interface SearchResponse {
  total: number
  limit: number
  offset: number
  data: BangumiSubject[]
}

// ============================================================
// Helpers
// ============================================================

function titleOf(subject: BangumiSubject): string {
  return subject.name_cn || subject.name || `Bangumi #${subject.id}`
}

function coverOf(images: SubjectImage | null | undefined): string | null {
  if (!images) return null
  return images.large || images.common || images.medium || images.small || images.grid || null
}

/** Extract a field value from the new-format infobox (array of {key, value}) */
function infoboxField(infobox: InfoboxItem[] | undefined, keys: string[]): string | undefined {
  if (!infobox) return undefined
  for (const item of infobox) {
    if (keys.includes(item.key)) {
      if (typeof item.value === 'string') return item.value
      if (Array.isArray(item.value)) {
        // Return first v-value, or join all
        return item.value.map((v) => (typeof v === 'string' ? v : v.v)).join(' / ')
      }
    }
  }
  return undefined
}

function studioOf(subject: BangumiSubject): string | undefined {
  return infoboxField(subject.infobox, [
    '动画制作', '製作', '制作', '制作公司', '开发', '開發',
    '原作', '制作团队', '开发商', '发行', 'Studio'
  ])
}

function mediaTypeFromBangumi(bangumiType: number): MediaType {
  return BANGUMI_TYPE_TO_MEDIA[bangumiType] ?? 'anime'
}

// ============================================================
// DataSource implementation
// ============================================================

export class BangumiDataSource implements DataSource {
  name = 'bangumi'

  supportedTypes: MediaType[] = ['anime', 'game', 'novel', 'manga', 'tv', 'movie']

  private get fetchOptions(): RequestInit {
    return proxyFetchOptions()
  }

  private get baseUrl(): string {
    return config.datasources.bangumi.baseUrl
  }

  private get headers(): Record<string, string> {
    const h: Record<string, string> = {
      'User-Agent': 'anriod/0.1.0 (https://github.com/anriod)',
      'Content-Type': 'application/json'
    }
    const token = config.datasources.bangumi.bgmToken
    if (token) {
      h['Authorization'] = `Bearer ${token}`
    }
    return h
  }

  // ── Search ──────────────────────────────────────────────

  async search(query: string, mediaType?: MediaType): Promise<SearchResult[]> {
    // When type is not specified, search across all Bangumi-supported types
    const typeIds = mediaType
      ? (MEDIA_TO_BANGUMI_TYPE[mediaType] ?? [2])
      : [1, 2, 3, 4, 6]  // all types: Book, Anime, Music, Game, Real

    const url = `${this.baseUrl}/v0/search/subjects?limit=10`
    const body = {
      keyword: query,
      sort: 'rank',
      filter: {
        type: typeIds
      }
    }

    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(body),
        ...this.fetchOptions
      })
    } catch (err) {
      throw new Error(`无法连接 Bangumi (${this.baseUrl}): ${err instanceof Error ? err.message : String(err)}`)
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`Bangumi 搜索失败 (${response.status}): ${text || response.statusText}`)
    }

    const payload = (await response.json()) as SearchResponse

    return (payload.data ?? []).map((subject) => ({
      source: this.name,
      source_id: String(subject.id),
      title: titleOf(subject),
      cover_url: coverOf(subject.images),
      year: subject.date ? Number(subject.date.slice(0, 4)) : undefined,
      media_type: mediaTypeFromBangumi(subject.type),
      external_rating: subject.rating?.score
    }))
  }

  // ── GetDetails ──────────────────────────────────────────

  async getDetails(sourceId: string, mediaType: MediaType = 'anime'): Promise<MediaDetails> {
    const url = `${this.baseUrl}/v0/subjects/${sourceId}`

    const headers: Record<string, string> = {
      'User-Agent': 'anriod/0.1.0 (https://github.com/anriod)'
    }
    const token = config.datasources.bangumi.bgmToken
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    let response: Response
    try {
      response = await fetch(url, { headers, ...this.fetchOptions })
    } catch (err) {
      throw new Error(`无法连接 Bangumi (${this.baseUrl}): ${err instanceof Error ? err.message : String(err)}`)
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`Bangumi 详情获取失败 (${response.status}): ${text || response.statusText}`)
    }

    const subject = (await response.json()) as BangumiSubject
    const resolvedType = mediaTypeFromBangumi(subject.type)

    return {
      source: this.name,
      source_id: String(subject.id),
      title: titleOf(subject),
      media_type: resolvedType,
      description: subject.summary || null,
      cover_url: coverOf(subject.images),
      air_date: subject.date ?? undefined,
      total_episodes: subject.total_episodes ?? subject.eps ?? undefined,
      studio: studioOf(subject),
      external_rating: subject.rating?.score,
      source_url: `https://bgm.tv/subject/${subject.id}`,
      raw_metadata: subject as unknown as Record<string, unknown>
    }
  }
}
