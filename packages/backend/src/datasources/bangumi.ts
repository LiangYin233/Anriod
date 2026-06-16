import type { CreditPerson, CreditsResponse, DiscoverItem, DiscoverSection, MediaDetails, MediaType, SearchResult } from '@anriod/shared'
import { config } from '../config'
import { logger } from '../logger'
import { dataSourceFetch } from '../utils/http'
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

interface BangumiEpisode {
  id: number
  type: number  // 0=本篇, 1=SP, 2=OP, 3=ED, 4=预告, 5=MAD, 6=其他
  name: string
  name_cn: string
  ep?: number | string
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
    '动画制作', '動畫製作', '製作', '制作', '制作公司', '制作团队',
    '开发', '開發', '开发商', '发行', 'Studio'
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
    logger.info(`[Bangumi] 搜索: "${query}" (类型: ${mediaType || '全部'})`)
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
      response = await dataSourceFetch(url, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(body)
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

  // ── Discover (today's airing) ──────────────────────────

  async getDiscover(): Promise<DiscoverSection[]> {
    const url = `${this.baseUrl}/calendar`

    let response: Response
    try {
      response = await dataSourceFetch(url, { headers: this.headers })
    } catch (err) {
      throw new Error(`无法连接 Bangumi (${this.baseUrl}): ${err instanceof Error ? err.message : String(err)}`)
    }

    if (!response.ok) {
      console.error(`Bangumi calendar failed: ${response.status}`)
      return []
    }

    const calendar = (await response.json()) as Array<{
      weekday: { id: number; cn: string; en: string }
      items: BangumiSubject[]
    }>

    // Bangumi: 1=Mon … 7=Sun ; JS: 0=Sun … 6=Sat
    const jsDay = new Date().getDay()         // 0–6
    const bgmDay = jsDay === 0 ? 7 : jsDay     // 1–7

    const today = calendar.find((d) => d.weekday.id === bgmDay)
    if (!today || !today.items.length) return []

    const items: DiscoverItem[] = today.items.map((subject) => ({
      source: this.name,
      source_id: String(subject.id),
      title: titleOf(subject),
      cover_url: coverOf(subject.images),
      media_type: mediaTypeFromBangumi(subject.type),
      external_rating: subject.rating?.score,
      summary: subject.summary?.slice(0, 200) || undefined,
      year: subject.date ? Number(subject.date.slice(0, 4)) : undefined
    }))

    return [{
      source: this.name,
      label: `今日放送 (${today.weekday.cn})`,
      items
    }]
  }

  // ── Credits ────────────────────────────────────────────

  async getCredits(sourceId: string, _mediaType?: MediaType): Promise<CreditsResponse> {
    const opts = { headers: this.headers }
    const cast: CreditPerson[] = []
    const crew: CreditPerson[] = []

    // Fetch characters (含声优) and persons (制作人员)
    const [charResp, personResp] = await Promise.all([
      dataSourceFetch(`${this.baseUrl}/v0/subjects/${sourceId}/characters`, opts),
      dataSourceFetch(`${this.baseUrl}/v0/subjects/${sourceId}/persons`, opts)
    ])

    if (charResp.ok) {
      const characters = await charResp.json() as Array<{
        name: string
        images?: { medium?: string } | null
        actors?: Array<{ name: string; images?: { medium?: string } | null }>
      }>
      for (const ch of characters) {
        // Voice actors for this character
        if (ch.actors) {
          for (const actor of ch.actors) {
            cast.push({
              name: actor.name,
              role: '声优',
              character: ch.name,
              image: actor.images?.medium || null
            })
          }
        }
      }
    }

    if (personResp.ok) {
      const persons = await personResp.json() as Array<{
        name: string
        staff: string
        images?: { medium?: string } | null
      }>
      for (const p of persons) {
        crew.push({
          name: p.name,
          role: p.staff || '制作人员',
          image: p.images?.medium || null
        })
      }
    }

    return { source: this.name, source_id: sourceId, cast, crew }
  }

  // ── GetDetails ──────────────────────────────────────────

  async getDetails(sourceId: string, mediaType: MediaType = 'anime'): Promise<MediaDetails> {
    logger.info(`[Bangumi] 获取详情: ${sourceId} (类型: ${mediaType})`)
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
      response = await dataSourceFetch(url, { headers })
    } catch (err) {
      throw new Error(`无法连接 Bangumi (${this.baseUrl}): ${err instanceof Error ? err.message : String(err)}`)
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`Bangumi 详情获取失败 (${response.status}): ${text || response.statusText}`)
    }

    const subject = (await response.json()) as BangumiSubject
    const resolvedType = mediaTypeFromBangumi(subject.type)

    // Get actual episode count and full episode list
    let actualEpisodeCount: number | undefined = subject.total_episodes ?? subject.eps ?? undefined
    let episodeList: Array<{ ep: string | number; type: number; name?: string; name_cn?: string }> = []

    // For anime/tv types, fetch full episode list
    if ((resolvedType === 'anime' || resolvedType === 'tv') && sourceId) {
      try {
        const episodeLimit = 100
        let episodeOffset = 0
        let episodeTotal: number | undefined
        const episodes: BangumiEpisode[] = []

        do {
          const episodesUrl = `${this.baseUrl}/v0/episodes?subject_id=${sourceId}&limit=${episodeLimit}&offset=${episodeOffset}`
          const epResponse = await dataSourceFetch(episodesUrl, { headers })
          if (!epResponse.ok) break

          const epData = await epResponse.json() as { total?: number; data?: BangumiEpisode[] }
          const pageEpisodes = epData.data ?? []
          episodeTotal = epData.total
          episodes.push(...pageEpisodes)
          episodeOffset += pageEpisodes.length

          if (pageEpisodes.length < episodeLimit) break
        } while (episodeTotal === undefined || episodeOffset < episodeTotal)

        if (episodes.length > 0) {
          // Extract full episode list with validation
          episodeList = episodes
            .filter((ep: BangumiEpisode) => ep.type !== undefined && ep.type >= 0 && ep.type <= 6)
            .map(ep => ({
              ep: ep.ep !== undefined ? ep.ep : ep.id,
              type: ep.type,
              name: ep.name,
              name_cn: ep.name_cn
            }))

          // Count only main episodes (type=0) for total_episodes
          const mainEpisodes = episodes.filter((ep: BangumiEpisode) => ep.type === 0)
          const mainCount = mainEpisodes.length

          // Fallback to original count if no main episodes found (all-SP series)
          if (mainCount === 0 && (subject.total_episodes || subject.eps)) {
            actualEpisodeCount = subject.total_episodes ?? subject.eps
            logger.warn(`[Bangumi] No main episodes found for ${sourceId}, using subject.total_episodes=${actualEpisodeCount}`)
          } else {
            actualEpisodeCount = mainCount
          }

          logger.info(`[Bangumi] 正片: ${actualEpisodeCount}, SP等: ${episodes.length - (actualEpisodeCount ?? 0)}`)
        }
      } catch (err) {
        logger.warn(`[Bangumi] 无法获取剧集列表: ${err}`)
      }
    }

    return {
      source: this.name,
      source_id: String(subject.id),
      title: titleOf(subject),
      media_type: resolvedType,
      description: subject.summary || null,
      cover_url: coverOf(subject.images),
      air_date: subject.date ?? undefined,
      total_episodes: actualEpisodeCount,
      episodes: episodeList.length > 0 ? episodeList : undefined,
      studio: studioOf(subject),
      external_rating: subject.rating?.score,
      source_url: `https://bgm.tv/subject/${subject.id}`,
      raw_metadata: subject as unknown as Record<string, unknown>
    }
  }
}
