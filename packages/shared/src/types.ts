// Shared types between frontend and backend.

export const MEDIA_TYPE_VALUES = ['anime', 'movie', 'tv', 'game', 'novel', 'manga'] as const
export type MediaType = (typeof MEDIA_TYPE_VALUES)[number]

export const MEDIA_TYPES: Record<MediaType, string> = {
  anime: '动画/番剧',
  movie: '电影',
  tv: '电视剧',
  game: '游戏',
  novel: '小说',
  manga: '漫画'
}

export const STATUS_VALUES = ['plan_to_watch', 'watching', 'completed', 'on_hold', 'dropped'] as const
export type Status = (typeof STATUS_VALUES)[number]

export const STATUS_LABELS: Record<Status, string> = {
  plan_to_watch: '想看',
  watching: '在看',
  completed: '看过',
  on_hold: '搁置',
  dropped: '弃坑'
}

export type MediaSource = 'bangumi' | 'moegirl' | 'manual' | (string & {})

export interface MediaProgress {
  episode?: number
  chapter?: number
  volume?: number
  watched?: boolean
  hours_played?: number
  achievements_unlocked?: number
  has_platinum?: boolean
  [key: string]: unknown
}

export interface Media {
  id: string
  title: string
  type: MediaType
  status: Status
  rating: number | null
  notes: string | null
  current_progress: MediaProgress | null
  cover_url: string | null
  description: string | null
  external_rating: number | null
  air_date: string | null
  total_episodes: number | null
  studio: string | null
  source_metadata: Record<string, unknown> | null
  source: MediaSource | null
  source_id: string | null
  source_url: string | null
  synced_at: string | null
  tags?: string[]
  created_at: string
  updated_at: string
}

export interface Tag {
  id: number
  name: string
  created_at: string
}

export interface WatchHistory {
  id: number
  media_id: string
  media_title?: string
  started_at: string
  completed_at: string | null
  progress_from: MediaProgress | null
  progress_to: MediaProgress | null
  rating: number | null
  notes: string | null
  created_at: string
}

export interface Pagination {
  page: number
  limit: number
  total: number
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: Pagination
  status_counts?: Record<string, number>
}

export interface ApiErrorResponse {
  error: string
  details?: unknown
}

export interface CreateMediaInput {
  title: string
  type: MediaType
  status?: Status
  rating?: number | null
  notes?: string | null
  current_progress?: MediaProgress | null
  cover_url?: string | null
  description?: string | null
  external_rating?: number | null
  air_date?: string | null
  total_episodes?: number | null
  studio?: string | null
  source_metadata?: Record<string, unknown> | null
  source?: MediaSource | null
  source_id?: string | null
  source_url?: string | null
  tags?: string[]
}

export type UpdateMediaInput = Partial<CreateMediaInput>

export interface ListMediaQuery {
  type?: MediaType
  status?: Status
  tag?: string
  source?: string
  page?: number
  limit?: number
  sort?: string
  q?: string
  air_date_from?: string
  air_date_to?: string
  ep_min?: number
  ep_max?: number
}

export interface UpdateProgressInput {
  current_progress: MediaProgress
  notes?: string | null
  started_at?: string | null
}

export interface UpdateStatusInput {
  status: Status
}

export interface SearchResult {
  source: string
  source_id: string
  title: string
  cover_url: string | null
  year?: number
  media_type: MediaType
  external_rating?: number
}

export interface MediaDetails {
  source: string
  source_id: string
  title: string
  media_type: MediaType
  description: string | null
  cover_url: string | null
  air_date?: string
  total_episodes?: number
  studio?: string
  external_rating?: number
  source_url?: string
  raw_metadata: Record<string, unknown>
}

export interface ImportMediaInput {
  source: string
  source_id: string
  status?: Status
  type?: MediaType
}

export interface CreateWatchHistoryInput {
  media_id: string
  started_at?: string
  completed_at?: string | null
  progress_from?: MediaProgress | null
  progress_to?: MediaProgress | null
  rating?: number | null
  notes?: string | null
}

export type UpdateWatchHistoryInput = Partial<Omit<CreateWatchHistoryInput, 'media_id'>>

export interface StatisticsOverview {
  total: number
  by_status: Record<Status, number>
  by_type: Record<MediaType, number>
  completed: number
  watching: number
  average_rating: number | null
  rated_count: number
  rating_stddev: number | null
}

export interface TimelinePoint {
  period: string
  count: number
}

export interface TagStatistic {
  tag: string
  count: number
}

// ── Credits (演职员表) ──

export interface CreditPerson {
  name: string
  role: string
  character?: string
  image?: string | null
}

export interface CreditsResponse {
  source: string
  source_id: string
  cast: CreditPerson[]
  crew: CreditPerson[]
}

// ── Discover (探索/发现) ──

export interface DiscoverItem {
  source: string
  source_id: string
  title: string
  cover_url: string | null
  media_type: MediaType
  external_rating?: number
  summary?: string
  year?: number
}

export interface DiscoverSection {
  source: string
  label: string
  items: DiscoverItem[]
}

export interface DiscoverResponse {
  sections: DiscoverSection[]
}
