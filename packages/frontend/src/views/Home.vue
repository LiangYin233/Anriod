<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import type { Media, MediaType, Status } from '@anriod/shared'
import { MEDIA_TYPES, MEDIA_TYPE_VALUES, STATUS_LABELS, STATUS_VALUES } from '@anriod/shared'
import MediaCard from '@/components/MediaCard.vue'
import SearchBar from '@/components/SearchBar.vue'
import PageHeader from '@/components/PageHeader.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import EmptyState from '@/components/EmptyState.vue'
import ErrorBanner from '@/components/ErrorBanner.vue'
import Modal from '@/components/Modal.vue'
import AppSelect from '@/components/AppSelect.vue'
import { useMedia } from '@/composables/useMedia'
import { useToast } from '@/composables/useToast'
import { api, getStoredConfig, normalizeBackendUrl } from '@/utils/api'

const route = useRoute()
const { mediaList, pagination, statusCounts, loading, error, fetchMedia, incrementProgress, setStatus, removeMedia } = useMedia()
const toast = useToast()
const modalVisible = ref(false)
const modalMediaId = ref('')
const modalTitle = ref('')
const keyword = ref('')
const type = ref<MediaType | ''>('')
const status = ref<Status | ''>('')
const showFilters = ref(false)
const goToPageInput = ref('')
const tagFilter = ref('')
const layoutDensity = ref<'default' | 'compact'>('default')

const sortOptions = [
  { value: 'updated_at:desc', label: '最近修改' },
  { value: 'air_date:desc', label: '最新上线' },
  { value: 'air_date:asc', label: '最早发布' },
  { value: 'rating:desc', label: '评分最高' },
  { value: 'title:asc', label: '标题 A-Z' },
]
const sortBy = ref(sortOptions[0].value)

const typeOptions = [
  { value: '', label: '全部类型' },
  ...MEDIA_TYPE_VALUES.map((mt) => ({ value: mt, label: MEDIA_TYPES[mt] }))
]

const statusOptions = [
  { value: '', label: '全部状态' },
  ...STATUS_VALUES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))
]

const totalPages = computed(() => Math.ceil(pagination.value.total / pagination.value.limit))
const hasPrev = computed(() => pagination.value.page > 1)
const hasNext = computed(() => pagination.value.page < totalPages.value)

async function loadMedia(page?: number) {
  await fetchMedia({
    q: keyword.value || undefined,
    type: type.value || undefined,
    status: status.value || undefined,
    tag: tagFilter.value || undefined,
    page: page ?? pagination.value.page,
    limit: 20,
    sort: sortBy.value
  })
}

function onFilterChange() {
  tagFilter.value = ''
  loadMedia(1)
  goToPageInput.value = ''
}

function prevPage() {
  if (hasPrev.value) loadMedia(pagination.value.page - 1)
  goToPageInput.value = ''
}

function nextPage() {
  if (hasNext.value) loadMedia(pagination.value.page + 1)
  goToPageInput.value = ''
}

function goToFirst() {
  loadMedia(1)
  goToPageInput.value = ''
}

function goToLast() {
  loadMedia(totalPages.value)
  goToPageInput.value = ''
}

function goToPageNum() {
  const page = parseInt(goToPageInput.value)
  if (!isNaN(page) && page >= 1 && page <= totalPages.value) {
    loadMedia(page)
  }
  goToPageInput.value = ''
}

async function handleIncrement(media: Media) {
  await incrementProgress(media)
}

async function handleSetProgress(media: Media, episode: number) {
  const updated = await api.updateProgress(media.id, { current_progress: { episode } })
  mediaList.value = mediaList.value.map((item) => (item.id === updated.id ? updated : item))
}

async function handleStatus(media: Media, nextStatus: Status) {
  await setStatus(media, nextStatus)
}

function confirmDelete(id: string, title: string) {
  modalMediaId.value = id
  modalTitle.value = title
  modalVisible.value = true
}

async function handleDelete() {
  const id = modalMediaId.value
  modalVisible.value = false
  await removeMedia(id)
  toast.success('已删除')
}

function getCoverSrc(media: Media): string {
  if (media.cover_local_path) {
    const filename = media.cover_local_path.split(/[\\/]/).pop()
    const { backendUrl } = getStoredConfig()
    if (filename && backendUrl) return `${normalizeBackendUrl(backendUrl)}/covers/${encodeURIComponent(filename)}`
  }
  return media.cover_url || ''
}

function clearFilters() {
  type.value = ''
  status.value = ''
  keyword.value = ''
  tagFilter.value = ''
  onFilterChange()
}

onMounted(() => {
  const tagParam = route.query.tag as string | undefined
  if (tagParam) {
    tagFilter.value = tagParam
  }
  loadMedia()
})
</script>

<template>
  <div class="section-gap">
    <!-- Header -->
    <PageHeader title="媒体库" description="管理你的影视、游戏、书籍记录。">
      <template #actions>
        <div v-if="pagination.total > 0" class="flex items-center gap-2 flex-wrap">
          <span
            v-for="s in (['watching','completed','plan_to_watch','on_hold','dropped'] as const)"
            :key="s"
            class="rounded-full px-2.5 py-0.5 text-caption-xs font-medium border"
            :class="{
              'bg-primary/10 text-primary border-primary/20': s === 'watching',
              'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800': s === 'completed',
              'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800': s === 'plan_to_watch',
              'bg-neutral-100 text-neutral-500 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:border-neutral-700': s === 'on_hold',
              'bg-red-50 text-red-400 border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-800': s === 'dropped',
            }"
          >
            {{ STATUS_LABELS[s] }} {{ statusCounts[s] || 0 }}
          </span>
        </div>
        <button class="btn-ghost" type="button" @click="onFilterChange">
          <span class="material-symbols-outlined text-[18px]">refresh</span>
        </button>
      </template>
    </PageHeader>

    <!-- Filter Bar -->
    <div class="acrylic rounded-xl p-4 shadow-sm border border-black/5 dark:border-white/5">
      <div class="flex flex-wrap items-center gap-3">
        <div class="min-w-[200px] flex-1">
          <SearchBar v-model="keyword" placeholder="搜索影视..." @search="onFilterChange" />
        </div>
        <button class="btn-secondary" type="button" @click="showFilters = !showFilters">
          <span class="material-symbols-outlined text-[18px]">filter_list</span>
          筛选
        </button>
      </div>

      <!-- Filters -->
      <div v-if="showFilters" class="mt-3 grid gap-3 sm:grid-cols-2">
        <AppSelect v-model="type" :options="typeOptions" variant="field" @change="onFilterChange" />
        <AppSelect v-model="status" :options="statusOptions" variant="field" @change="onFilterChange" />
      </div>

      <!-- Active filter chips -->
      <div v-if="type || status || tagFilter" class="mt-3 flex flex-wrap gap-2">
        <span v-if="tagFilter" class="chip chip-neutral cursor-pointer" @click="tagFilter = ''; onFilterChange()">
          #{{ tagFilter }}
          <span class="material-symbols-outlined text-[14px]">close</span>
        </span>
        <span v-if="type" class="chip chip-primary cursor-pointer" @click="type = ''; onFilterChange()">
          {{ MEDIA_TYPES[type as MediaType] }}
          <span class="material-symbols-outlined text-[14px]">close</span>
        </span>
        <span v-if="status" class="chip chip-secondary cursor-pointer" @click="status = ''; onFilterChange()">
          {{ STATUS_LABELS[status as Status] }}
          <span class="material-symbols-outlined text-[14px]">close</span>
        </span>
        <button class="text-caption-xs text-on-surface-variant underline" type="button" @click="clearFilters">清除全部</button>
      </div>
    </div>

    <!-- States -->
    <ErrorBanner v-if="error" :message="error" />
    <LoadingSpinner v-if="loading" message="加载媒体库..." />

    <EmptyState
      v-else-if="mediaList.length === 0"
      icon="video_library"
      title="媒体库为空"
      description="前往搜索导入页面添加第一条记录。"
    >
      <RouterLink to="/search" class="btn-primary">开始导入</RouterLink>
    </EmptyState>

    <!-- Grid -->
    <template v-else>
      <div class="flex items-center justify-between">
        <AppSelect v-model="sortBy" :options="sortOptions" variant="minimal" @change="onFilterChange" />
        <button class="btn-icon" type="button" @click="layoutDensity = layoutDensity === 'default' ? 'compact' : 'default'" :title="layoutDensity === 'default' ? '切换紧凑布局' : '切换默认布局'">
          <span class="material-symbols-outlined">{{ layoutDensity === 'default' ? 'grid_view' : 'grid_on' }}</span>
        </button>
      </div>

      <!-- Grid (default) -->
      <template v-if="layoutDensity === 'default'">
        <div class="grid gap-gutter grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          <div v-for="media in mediaList" :key="media.id" class="relative group/card">
            <MediaCard :media="media" @increment="handleIncrement" @set-progress="handleSetProgress" @status="handleStatus" />
            <button
              class="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-error/80 text-on-error opacity-0 shadow-md transition-opacity hover:bg-error group-hover/card:opacity-100"
              type="button"
              title="删除"
              @click="confirmDelete(media.id, media.title)"
            >
              <span class="material-symbols-outlined text-[16px]">delete</span>
            </button>
          </div>
        </div>
      </template>

      <!-- List (compact) -->
      <template v-if="layoutDensity === 'compact'">
        <div class="flex flex-col gap-1">
          <div
            v-for="media in mediaList"
            :key="media.id"
            class="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-surface-container-low cursor-pointer"
            @click="$router.push(`/media/${media.id}`)"
          >
            <!-- Cover thumbnail -->
            <div class="w-8 h-12 shrink-0 rounded overflow-hidden bg-surface-variant">
              <img v-if="getCoverSrc(media)" :src="getCoverSrc(media)" class="w-full h-full object-cover" />
              <span v-else class="flex h-full w-full items-center justify-center">
                <span class="material-symbols-outlined text-[16px] text-on-surface-variant">movie</span>
              </span>
            </div>
            <!-- Info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="text-body-md font-medium text-on-surface truncate">{{ media.title }}</span>
                <span class="chip chip-neutral shrink-0">{{ MEDIA_TYPES[media.type] }}</span>
                <span
                  class="chip shrink-0"
                  :class="media.status === 'watching' ? 'chip-primary' : media.status === 'completed' ? 'chip-success' : 'chip-neutral'"
                >{{ STATUS_LABELS[media.status] }}</span>
              </div>
              <div class="flex items-center gap-3 mt-0.5 text-caption-xs text-on-surface-variant">
                <span v-if="media.rating">评分 {{ media.rating }}</span>
                <span v-if="media.current_progress?.episode ?? media.total_episodes">
                  进度 {{ media.current_progress?.episode ?? 0 }}/{{ media.total_episodes ?? '-' }}
                </span>
              </div>
            </div>
            <!-- Delete -->
            <button
              class="btn-icon opacity-0 group-hover:opacity-100 transition-opacity text-on-surface-variant hover:text-error"
              type="button"
              title="删除"
              @click.stop="confirmDelete(media.id, media.title)"
            >
              <span class="material-symbols-outlined text-[20px]">delete</span>
            </button>
          </div>
        </div>
      </template>
    </template>

    <!-- Pagination -->
    <template v-if="pagination.total > 0">
      <div class="flex flex-wrap items-center justify-center gap-3 rounded-lg p-4">
        <!-- Page nav -->
        <div class="flex items-center gap-1">
          <button class="btn-icon" title="第一页" :disabled="!hasPrev" @click="goToFirst">
            <span class="material-symbols-outlined text-[20px]">first_page</span>
          </button>
          <button class="btn-icon" title="上一页" :disabled="!hasPrev" @click="prevPage">
            <span class="material-symbols-outlined text-[20px]">chevron_left</span>
          </button>
        </div>

        <!-- Page jump -->
        <div class="flex items-center gap-1.5 text-caption-xs text-on-surface-variant">
          <span>第</span>
          <input
            v-model="goToPageInput"
            class="w-10 rounded border border-outline-variant/40 bg-surface-container-lowest px-1 py-1 text-center text-label-sm text-on-surface outline-none focus:border-primary"
            type="text"
            inputmode="numeric"
            :placeholder="String(pagination.page)"
            @keydown.enter="goToPageNum"
            @blur="goToPageNum"
          />
          <span>/ {{ totalPages }} 页</span>
        </div>

        <div class="flex items-center gap-1">
          <button class="btn-icon" title="下一页" :disabled="!hasNext" @click="nextPage">
            <span class="material-symbols-outlined text-[20px]">chevron_right</span>
          </button>
          <button class="btn-icon" title="最后一页" :disabled="!hasNext" @click="goToLast">
            <span class="material-symbols-outlined text-[20px]">last_page</span>
          </button>
        </div>

        <!-- Total count -->
        <span class="text-caption-xs text-on-surface-variant">共 {{ pagination.total }} 条</span>
      </div>
    </template>
  </div>

  <Modal
    v-if="modalVisible"
    title="确认删除"
    :message="`确定删除「${modalTitle}」吗？此操作不可撤销。`"
    confirm-text="删除"
    cancel-text="取消"
    danger
    @confirm="handleDelete"
    @cancel="modalVisible = false"
  />
</template>
