import { ref } from 'vue'
import type { ListMediaQuery, Media, MediaProgress, PaginatedResponse, Status } from '@anriod/shared'
import { api } from '@/utils/api'
import { isChapterBased } from '@/utils/progress'

function nextProgress(media: Media): MediaProgress {
  const current: MediaProgress = { ...(media.current_progress ?? {}) }

  if (media.type === 'anime' || media.type === 'tv') {
    current.episode = (current.episode ?? 0) + 1
  } else if (isChapterBased(media.type)) {
    current.chapter = (current.chapter ?? 0) + 1
  } else if (media.type === 'movie') {
    current.watched = true
  } else if (media.type === 'game') {
    current.hours_played = (current.hours_played ?? 0) + 1
  }

  return current
}

function createQueryKey(filters: ListMediaQuery): string {
  return JSON.stringify({
    q: filters.q ?? '',
    type: filters.type ?? '',
    status: filters.status ?? '',
    tag: filters.tag ?? '',
    source: filters.source ?? '',
    page: filters.page ?? 1,
    limit: filters.limit ?? 20,
    sort: filters.sort ?? '',
    air_date_from: filters.air_date_from ?? '',
    air_date_to: filters.air_date_to ?? '',
    ep_min: filters.ep_min ?? '',
    ep_max: filters.ep_max ?? ''
  })
}

// Global singleton state (shared across all component instances)
const mediaList = ref<Media[]>([])
const pagination = ref<PaginatedResponse<Media>['pagination']>({ page: 1, limit: 20, total: 0 })
const statusCounts = ref<Record<string, number>>({})
const loading = ref(false)
const error = ref('')
const cache = ref<Map<string, { data: PaginatedResponse<Media>; timestamp: number }>>(new Map())
const lastQueryKey = ref<string>('')
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

async function fetchMedia(filters: ListMediaQuery = {}, forceRefresh = false) {
  const queryKey = createQueryKey(filters)
  lastQueryKey.value = queryKey

  if (forceRefresh) {
    invalidateCache()
  }

  if (!forceRefresh && cache.value.has(queryKey)) {
    const cached = cache.value.get(queryKey)!
    const age = Date.now() - cached.timestamp

    if (age < CACHE_TTL) {
      mediaList.value = cached.data.data
      pagination.value = cached.data.pagination
      statusCounts.value = cached.data.status_counts ?? {}
      return cached.data
    }
  }

  loading.value = true
  error.value = ''

  try {
    const result = await api.listMedia({
      ...filters,
      limit: filters.limit ?? 20
    })

    cache.value.set(queryKey, {
      data: result,
      timestamp: Date.now()
    })

    mediaList.value = result.data
    pagination.value = result.pagination
    statusCounts.value = result.status_counts ?? {}
    return result
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '加载媒体列表失败'
    return undefined
  } finally {
    loading.value = false
  }
}

async function incrementProgress(media: Media) {
  const updated = await api.updateProgress(media.id, { current_progress: nextProgress(media) })
  mediaList.value = mediaList.value.map((item) => (item.id === updated.id ? updated : item))

  return updated
}

async function setStatus(media: Media, status: Status) {
  const updated = await api.updateStatus(media.id, { status })
  mediaList.value = mediaList.value.map((item) => (item.id === updated.id ? updated : item))

  return updated
}

async function removeMedia(id: string) {
  await api.deleteMedia(id)
  mediaList.value = mediaList.value.filter((item) => item.id !== id)

  invalidateCache()
}

function invalidateCache() {
  cache.value.clear()
}

function refreshCurrentQuery() {
  if (!lastQueryKey.value) return Promise.resolve()

  const filters = JSON.parse(lastQueryKey.value) as ListMediaQuery
  return fetchMedia(filters, true)
}

// Export as singleton - all components share the same state
export function useMedia() {
  return {
    mediaList,
    pagination,
    statusCounts,
    loading,
    error,
    fetchMedia,
    incrementProgress,
    setStatus,
    removeMedia,
    invalidateCache,
    refreshCurrentQuery
  }
}
