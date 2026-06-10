<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { Media, MediaType, Status } from '@anriod/shared'
import { MEDIA_TYPES, MEDIA_TYPE_VALUES, STATUS_LABELS, STATUS_VALUES } from '@anriod/shared'
import MediaCard from '@/components/MediaCard.vue'
import SearchBar from '@/components/SearchBar.vue'
import PageHeader from '@/components/PageHeader.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import EmptyState from '@/components/EmptyState.vue'
import ErrorBanner from '@/components/ErrorBanner.vue'
import Modal from '@/components/Modal.vue'
import { useMedia } from '@/composables/useMedia'
import { useToast } from '@/composables/useToast'
import { api } from '@/utils/api'

const { mediaList, pagination, statusCounts, loading, error, fetchMedia, incrementProgress, setStatus, removeMedia } = useMedia()
const toast = useToast()
const modalVisible = ref(false)
const modalMediaId = ref('')
const modalTitle = ref('')
const keyword = ref('')
const type = ref<MediaType | ''>('')
const status = ref<Status | ''>('')
const showFilters = ref(false)

const sortOptions = [
  { value: 'updated_at:desc', label: '最近修改' },
  { value: 'air_date:desc', label: '最新上线' },
  { value: 'air_date:asc', label: '最早发布' },
  { value: 'rating:desc', label: '评分最高' },
  { value: 'title:asc', label: '标题 A-Z' },
]
const sortBy = ref(sortOptions[0].value)

async function loadMedia(page?: number) {
  await fetchMedia({
    q: keyword.value || undefined,
    type: type.value || undefined,
    status: status.value || undefined,
    page: page ?? pagination.value.page,
    limit: pagination.value.limit,
    sort: sortBy.value
  })
}

function onFilterChange() {
  loadMedia(1)
}

function nextPage() {
  loadMedia(pagination.value.page + 1)
}

function prevPage() {
  loadMedia(pagination.value.page - 1)
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

function clearFilters() {
  type.value = ''
  status.value = ''
  keyword.value = ''
  onFilterChange()
}

onMounted(loadMedia)
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
        <select v-model="type" class="field" @change="onFilterChange">
          <option value="">全部类型</option>
          <option v-for="mt in MEDIA_TYPE_VALUES" :key="mt" :value="mt">{{ MEDIA_TYPES[mt] }}</option>
        </select>
        <select v-model="status" class="field" @change="onFilterChange">
          <option value="">全部状态</option>
          <option v-for="s in STATUS_VALUES" :key="s" :value="s">{{ STATUS_LABELS[s] }}</option>
        </select>
      </div>

      <!-- Active filter chips -->
      <div v-if="type || status" class="mt-3 flex flex-wrap gap-2">
        <span v-if="type" class="chip-primary cursor-pointer" @click="type = ''; onFilterChange()">
          {{ MEDIA_TYPES[type as MediaType] }}
          <span class="material-symbols-outlined text-[14px]">close</span>
        </span>
        <span v-if="status" class="chip-secondary cursor-pointer" @click="status = ''; onFilterChange()">
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
        <div class="relative">
          <select
            v-model="sortBy"
            class="appearance-none cursor-pointer bg-transparent text-title-sm text-on-surface font-semibold outline-none pr-6 py-1"
            @change="onFilterChange"
          >
            <option v-for="opt in sortOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
          <span class="material-symbols-outlined pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">expand_more</span>
        </div>
      </div>

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

    <div v-if="pagination.total > pagination.limit" class="flex items-center justify-center gap-4">
      <button class="btn-secondary" type="button" :disabled="pagination.page <= 1" @click="prevPage">
        <span class="material-symbols-outlined text-[18px]">chevron_left</span>
      </button>
      <span class="text-caption-xs text-on-surface-variant">
        第 {{ pagination.page }} / {{ Math.ceil(pagination.total / pagination.limit) }} 页 · 共 {{ pagination.total }} 条
      </span>
      <button class="btn-secondary" type="button" :disabled="pagination.page * pagination.limit >= pagination.total" @click="nextPage">
        <span class="material-symbols-outlined text-[18px]">chevron_right</span>
      </button>
    </div>
    <p v-else-if="pagination.total > 0" class="text-center text-caption-xs text-on-surface-variant">
      共 {{ pagination.total }} 条
    </p>
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
