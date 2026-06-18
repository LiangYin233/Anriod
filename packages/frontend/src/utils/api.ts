import type {
  CreateMediaInput,
  CreateWatchRecordInput,
  CreditsResponse,
  DiscoverResponse,
  ImportMediaInput,
  ListMediaQuery,
  Media,
  MediaDetails,
  PaginatedResponse,
  SearchResult,
  StatisticsOverview,
  Tag,
  TagStatistic,
  TimelinePoint,
  UpdateMediaInput,
  UpdateStatusInput,
  UpdateWatchRecordInput,
  WatchRecord
} from '@anriod/shared'

export interface ClientConfig {
  backendUrl: string
  apiKey: string
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function getStoredConfig(): ClientConfig {
  return {
    backendUrl: localStorage.getItem('backendUrl') || '',
    apiKey: localStorage.getItem('apiKey') || ''
  }
}

export function normalizeBackendUrl(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

function buildUrl(endpoint: string): string {
  const { backendUrl } = getStoredConfig()
  if (!backendUrl) throw new ApiError(0, '请先配置后端地址')
  return `${normalizeBackendUrl(backendUrl)}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T

  const text = await response.text()
  const payload = text ? JSON.parse(text) : null

  if (!response.ok) {
    throw new ApiError(response.status, payload?.error || `API Error: ${response.status}`)
  }

  return payload as T
}

export async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const { apiKey } = getStoredConfig()
  const headers = new Headers(options.headers)

  if (apiKey) headers.set('Authorization', `Bearer ${apiKey}`)
  if (!headers.has('Content-Type') && options.body) headers.set('Content-Type', 'application/json')

  let response: Response
  try {
    response = await fetch(buildUrl(endpoint), {
      ...options,
      headers
    })
  } catch (err) {
    if (err instanceof TypeError && err.message === 'Failed to fetch') {
      throw new ApiError(0, '无法连接后端，请确认后端已启动且地址正确')
    }
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('abort') || msg.includes('timeout') || msg.includes('timed out')) {
      throw new ApiError(0, '请求超时，请检查网络连接')
    }
    throw new ApiError(0, '网络错误，请检查网络连接')
  }

  return parseResponse<T>(response)
}

function queryString(params: Record<string, string | number | boolean | null | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
  }
  const serialized = search.toString()
  return serialized ? `?${serialized}` : ''
}

export const api = {
  health: () => apiRequest<{ ok: boolean; service: string }>('/health'),
  listMedia: (query: ListMediaQuery = {}) => apiRequest<PaginatedResponse<Media>>(`/api/media${queryString(query as Record<string, string | number | boolean | null | undefined>)}`),
  getMedia: (id: string) => apiRequest<Media>(`/api/media/${id}`),
  createMedia: (data: CreateMediaInput) => apiRequest<Media>('/api/media', { method: 'POST', body: JSON.stringify(data) }),
  updateMedia: (id: string, data: UpdateMediaInput) => apiRequest<Media>(`/api/media/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteMedia: (id: string) => apiRequest<void>(`/api/media/${id}`, { method: 'DELETE' }),
  markEpisodesWatched: (id: string, episodes: number[]) => apiRequest<Media>(`/api/media/${id}/records/episodes/batch`, { method: 'POST', body: JSON.stringify({ episodes }) }),
  markSingleEpisode: (id: string, episode: number) => apiRequest<Media>(`/api/media/${id}/records/episodes/single`, { method: 'POST', body: JSON.stringify({ episode }) }),
  undoEpisodeWatch: (id: string, episode: number) => apiRequest<Media>(`/api/media/${id}/records/episodes/${episode}`, { method: 'DELETE' }),
  updateStatus: (id: string, data: UpdateStatusInput) => apiRequest<Media>(`/api/media/${id}/status`, { method: 'PATCH', body: JSON.stringify(data) }),
  importMedia: (data: ImportMediaInput) => apiRequest<Media>('/api/media/import', { method: 'POST', body: JSON.stringify(data) }),
  syncMedia: (id: string) => apiRequest<Media>(`/api/media/${id}/sync`, { method: 'POST' }),
  listTags: () => apiRequest<Tag[]>('/api/tags'),
  createTag: (name: string) => apiRequest<Tag>('/api/tags', { method: 'POST', body: JSON.stringify({ name }) }),
  deleteTag: (id: number) => apiRequest<void>(`/api/tags/${id}`, { method: 'DELETE' }),
  listRecords: (query: { page?: number; limit?: number; media_id?: string } = {}) => apiRequest<PaginatedResponse<WatchRecord>>(`/api/records${queryString(query)}`),
  createRecord: (data: CreateWatchRecordInput) => apiRequest<WatchRecord>('/api/records', { method: 'POST', body: JSON.stringify(data) }),
  updateRecord: (id: number, data: UpdateWatchRecordInput) => apiRequest<WatchRecord>(`/api/records/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteRecord: (id: number) => apiRequest<void>(`/api/records/${id}`, { method: 'DELETE' }),
  search: (query: { query: string; type?: string; source?: string }) => apiRequest<SearchResult[]>(`/api/search${queryString(query)}`),
  dataSources: () => apiRequest<{ data: Array<{ name: string; supportedTypes: string[] }> }>('/api/search/sources'),
  overview: () => apiRequest<StatisticsOverview>('/api/statistics/overview'),
  timeline: () => apiRequest<TimelinePoint[]>('/api/statistics/timeline'),
  tagStats: () => apiRequest<TagStatistic[]>('/api/statistics/tags'),
  ratingDistribution: () => apiRequest<Array<{ rating: number; count: number }>>('/api/statistics/ratings'),
  exportBackup: () => apiRequest<{ version: number; media: Media[]; tags: Tag[]; watch_records: WatchRecord[] }>('/api/backup/export'),
  importBackup: (data: any) => apiRequest<{ ok: boolean }>('/api/backup/import', { method: 'POST', body: JSON.stringify(data) }),
  triggerSync: () => apiRequest<{ synced: number; errors: string[] }>('/api/sync/trigger', { method: 'POST' }),
  fetchDetails: (query: { source: string; source_id: string; type?: string }) =>
    apiRequest<MediaDetails>(`/api/search/details${queryString(query)}`),
  fetchCredits: (query: { source: string; source_id: string; type?: string }) =>
    apiRequest<CreditsResponse>(`/api/search/credits${queryString(query)}`),
  discover: () => apiRequest<DiscoverResponse>('/api/discover'),
}
