import { ref } from 'vue'
import type { ListMediaQuery, Media, MediaProgress, PaginatedResponse, Status } from '@anriod/shared'
import { api } from '@/utils/api'

function nextProgress(media: Media): MediaProgress {
  const current: MediaProgress = { ...(media.current_progress ?? {}) }

  if (media.type === 'anime' || media.type === 'tv') {
    current.episode = (current.episode ?? 0) + 1
  } else if (media.type === 'novel' || media.type === 'manga') {
    current.chapter = (current.chapter ?? 0) + 1
  } else if (media.type === 'movie') {
    current.watched = true
  } else if (media.type === 'game') {
    current.hours_played = (current.hours_played ?? 0) + 1
  }

  return current
}

export function useMedia() {
  const mediaList = ref<Media[]>([])
  const pagination = ref<PaginatedResponse<Media>['pagination']>({ page: 1, limit: 20, total: 0 })
  const statusCounts = ref<Record<string, number>>({})
  const loading = ref(false)
  const error = ref('')
  async function fetchMedia(filters: ListMediaQuery = {}) {
    loading.value = true
    error.value = ''

    try {
      const result = await api.listMedia({
        ...filters,
        limit: filters.limit ?? 24
      })
      mediaList.value = result.data
      pagination.value = result.pagination
      statusCounts.value = result.status_counts ?? {}
      return result
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : '加载媒体列表失败'
      throw caught
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
  }

  return {
    mediaList,
    pagination,
    statusCounts,
    loading,
    error,
    fetchMedia,
    incrementProgress,
    setStatus,
    removeMedia
  }
}
