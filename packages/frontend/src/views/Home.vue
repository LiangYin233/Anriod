<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
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
const router = useRouter()
const { mediaList, pagination, statusCounts, loading, error, fetchMedia, incrementProgress, setStatus, removeMedia, refreshCurrentQuery } = useMedia()
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
const source = ref('')
const showAllChips = ref(false)
const airDateFrom = ref('')
const airDateTo = ref('')
const epMin = ref<number | undefined>(undefined)
const epMax = ref<number | undefined>(undefined)
const hasLoadedOnce = ref(false)

const sortOptions = [
  { value: 'updated_at:desc', label: '最近修改' },
  { value: 'air_date:desc', label: '最新上线' },
  { value: 'air_date:asc', label: '最早发布' },
  { value: 'rating:desc', label: '评分最高' },
  { value: 'title:asc', label: '标题 A-Z' },
]

const STORAGE_KEY_SORT = 'anriod_media_sort'

// Restore sort preference from localStorage
function getSavedSort(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_SORT)
    if (saved && sortOptions.some(opt => opt.value === saved)) {
      return saved
    }
  } catch (e) {
    console.warn('Failed to read sort preference from localStorage:', e)
  }
  return sortOptions[0].value
}

const sortBy = ref(getSavedSort())

const typeOptions = [
  { value: '', label: '全部类型' },
  ...MEDIA_TYPE_VALUES.map((mt) => ({ value: mt, label: MEDIA_TYPES[mt] }))
]

const statusOptions = [
  { value: '', label: '全部状态' },
  ...STATUS_VALUES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))
]
const sourceOptions = [
  { value: '', label: '全部来源' },
  { value: 'bangumi', label: 'Bangumi' },
  { value: 'tmdb', label: 'TMDB' },
  { value: 'manual', label: '手动' },
]

const activeChips = computed(() => {
  const chips: { key: string; label: string; onRemove: () => void }[] = []
  if (tagFilter.value) chips.push({ key: 'tag', label: `#${tagFilter.value}`, onRemove: () => { tagFilter.value = ''; onFilterChange() } })
  if (type.value) chips.push({ key: 'type', label: MEDIA_TYPES[type.value as MediaType], onRemove: () => { type.value = ''; onFilterChange() } })
  if (status.value) chips.push({ key: 'status', label: STATUS_LABELS[status.value as Status], onRemove: () => { status.value = ''; onFilterChange() } })
  if (source.value) chips.push({ key: 'source', label: `来源: ${source.value}`, onRemove: () => { source.value = ''; onFilterChange() } })
  if (airDateFrom.value) chips.push({ key: 'airFrom', label: `首播 ≥ ${airDateFrom.value}`, onRemove: () => { airDateFrom.value = ''; onFilterChange() } })
  if (airDateTo.value) chips.push({ key: 'airTo', label: `首播 ≤ ${airDateTo.value}`, onRemove: () => { airDateTo.value = ''; onFilterChange() } })
  if (epMin.value !== undefined) chips.push({ key: 'epMin', label: `≥ ${epMin.value} 集`, onRemove: () => { epMin.value = undefined; onFilterChange() } })
  if (epMax.value !== undefined) chips.push({ key: 'epMax', label: `≤ ${epMax.value} 集`, onRemove: () => { epMax.value = undefined; onFilterChange() } })
  return chips
})
const visibleChips = computed(() => showAllChips.value ? activeChips.value : activeChips.value.slice(0, 4))
const hasMoreChips = computed(() => activeChips.value.length > 4)

function toggleChips() {
  showAllChips.value = !showAllChips.value
}

const totalPages = computed(() => Math.ceil(pagination.value.total / pagination.value.limit))
const hasPrev = computed(() => pagination.value.page > 1)
const hasNext = computed(() => pagination.value.page < totalPages.value)

async function loadMedia(page?: number, forceRefresh = false) {
  await fetchMedia({
    q: keyword.value || undefined,
    type: type.value || undefined,
    status: status.value || undefined,
    tag: tagFilter.value || undefined,
    source: source.value || undefined,
    air_date_from: airDateFrom.value || undefined,
    air_date_to: airDateTo.value || undefined,
    ep_min: epMin.value,
    ep_max: epMax.value,
    page: page ?? pagination.value.page,
    limit: 20,
    sort: sortBy.value
  }, forceRefresh)
}

function syncFiltersToUrl() {
  const query: Record<string, string> = {}

  if (keyword.value) query.q = keyword.value
  if (type.value) query.type = type.value
  if (status.value) query.status = status.value
  if (tagFilter.value) query.tag = tagFilter.value
  if (source.value) query.source = source.value
  if (sortBy.value) query.sort = sortBy.value
  if (airDateFrom.value) query.air_date_from = airDateFrom.value
  if (airDateTo.value) query.air_date_to = airDateTo.value
  if (epMin.value !== undefined) query.ep_min = String(epMin.value)
  if (epMax.value !== undefined) query.ep_max = String(epMax.value)

  router.replace({ query })
}

function saveSortPreference(value: string) {
  try {
    localStorage.setItem(STORAGE_KEY_SORT, value)
  } catch (e) {
    console.warn('Failed to save sort preference to localStorage:', e)
  }
}

function onFilterChange() {
  syncFiltersToUrl()
  loadMedia(1)
  goToPageInput.value = ''
}

function forceRefresh() {
  loadMedia(pagination.value.page, true)
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

async function handleSetProgress(media: Media, value: number) {
  const field = (media.type === 'novel' || media.type === 'manga') ? 'chapter' : 'episode'
  const updated = await api.updateProgress(media.id, { current_progress: { [field]: value } })
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
  // After deletion, refresh to get updated counts
  await refreshCurrentQuery()
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
  source.value = ''
  airDateFrom.value = ''
  airDateTo.value = ''
  epMin.value = undefined
  epMax.value = undefined
  showAllChips.value = false
  sortBy.value = sortOptions[0].value
  onFilterChange()
}

function restoreFiltersFromUrl() {
  const q = route.query

  if (q.q) keyword.value = String(q.q)
  if (q.type) type.value = String(q.type) as MediaType | ''
  if (q.status) status.value = String(q.status) as Status | ''
  if (q.tag) tagFilter.value = String(q.tag)
  if (q.source) source.value = String(q.source)

  // Restore sort from URL with priority over localStorage
  if (q.sort) {
    const urlSort = String(q.sort)
    if (sortOptions.some(opt => opt.value === urlSort)) {
      sortBy.value = urlSort
    }
  }

  if (q.air_date_from) airDateFrom.value = String(q.air_date_from)
  if (q.air_date_to) airDateTo.value = String(q.air_date_to)
  if (q.ep_min) epMin.value = parseInt(String(q.ep_min))
  if (q.ep_max) epMax.value = parseInt(String(q.ep_max))
}

onMounted(() => {
  restoreFiltersFromUrl()
  // After restoring from URL, sync current state back to URL
  syncFiltersToUrl()
  loadMedia()
  hasLoadedOnce.value = true
})

// Watch for external URL changes (e.g., from Tags page)
watch(() => route.query, () => {
  if (route.name === 'Home' && hasLoadedOnce.value) {
    restoreFiltersFromUrl()
    loadMedia()
  }
})

// Watch sortBy changes and persist to localStorage
watch(sortBy, (newSort) => {
  saveSortPreference(newSort)
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
        <button class="btn-ghost" type="button" @click="forceRefresh">
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
        <button
          class="btn-secondary"
          type="button"
          :class="{ 'is-active': showFilters }"
          @click="showFilters = !showFilters"
        >
          <span
            class="material-symbols-outlined text-[18px] transition-transform duration-200"
            :class="showFilters ? 'rotate-45' : ''"
          >tune</span>
          {{ showFilters ? '收起' : '高级' }}
        </button>
      </div>

      <!-- Basic filters (always visible) -->
      <div class="mt-3 grid gap-3 sm:grid-cols-2">
        <AppSelect v-model="type" :options="typeOptions" variant="field" @change="onFilterChange" />
        <AppSelect v-model="status" :options="statusOptions" variant="field" @change="onFilterChange" />
      </div>

      <!-- Advanced filters (toggle) with animation -->
      <Transition name="filter-slide">
        <div v-if="showFilters" class="mt-3">
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div class="filter-inline-field source-select">
              <span class="filter-inline-label">来源</span>
              <AppSelect v-model="source" :options="sourceOptions" variant="field" class="min-w-0 flex-1" @change="onFilterChange" />
            </div>
            <div class="filter-inline-field">
              <span class="filter-inline-label">首播 ≥</span>
              <input v-model="airDateFrom" type="date" class="filter-inline-input" @change="onFilterChange" />
            </div>
            <div class="filter-inline-field">
              <span class="filter-inline-label">首播 ≤</span>
              <input v-model="airDateTo" type="date" class="filter-inline-input" @change="onFilterChange" />
            </div>
            <div class="filter-inline-field">
              <span class="filter-inline-label">集数 ≥</span>
              <input v-model.number="epMin" type="number" class="filter-inline-input" min="0" placeholder="12" @change="onFilterChange" />
            </div>
            <div class="filter-inline-field">
              <span class="filter-inline-label">集数 ≤</span>
              <input v-model.number="epMax" type="number" class="filter-inline-input" min="0" placeholder="24" @change="onFilterChange" />
            </div>
          </div>
        </div>
      </Transition>

      <!-- Active filter chips -->
      <div v-if="activeChips.length > 0" class="mt-3 flex flex-wrap items-center gap-2">
        <span
          v-for="chip in visibleChips"
          :key="chip.key"
          class="chip cursor-pointer transition-all active:scale-95"
          :class="chip.key === 'type' ? 'chip-primary' : chip.key === 'status' ? 'chip-secondary' : 'chip-neutral'"
          @click="chip.onRemove"
        >
          {{ chip.label }}
          <span class="material-symbols-outlined text-[14px]">close</span>
        </span>
        <button
          v-if="hasMoreChips"
          class="chip chip-neutral text-caption-xs"
          type="button"
          @click="toggleChips"
        >
          {{ showAllChips ? `收起` : `+${activeChips.length - 4} 项` }}
          <span class="material-symbols-outlined text-[14px]">{{ showAllChips ? 'expand_less' : 'expand_more' }}</span>
        </button>
        <button class="text-caption-xs text-on-surface-variant/50 hover:text-error transition-colors ml-1" type="button" @click="clearFilters">清除全部</button>
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
        <div class="flex flex-col gap-2">
          <div
            v-for="media in mediaList"
            :key="media.id"
            class="acrylic group flex items-center rounded-xl overflow-hidden shadow-sm border border-black/5 dark:border-white/5 transition-all hover:shadow-md cursor-pointer"
            @click="$router.push(`/media/${media.id}`)"
          >
            <!-- Cover (flush with card top/bottom/left) -->
            <div class="cover-wrapper w-[72px] h-24 shrink-0 overflow-hidden bg-surface-variant self-stretch">
              <img v-if="getCoverSrc(media)" :src="getCoverSrc(media)" class="cover-img w-full h-full object-cover" />
              <span v-else class="flex h-full w-full items-center justify-center">
                <span class="material-symbols-outlined text-[24px] text-on-surface-variant">movie</span>
              </span>
            </div>

            <!-- Info -->
            <div class="flex-1 min-w-0 py-3 pr-2 pl-3">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-body-md font-semibold text-on-surface truncate">{{ media.title }}</span>
                <span class="chip chip-neutral shrink-0">{{ MEDIA_TYPES[media.type] }}</span>
                <span
                  class="chip shrink-0"
                  :class="media.status === 'watching' ? 'chip-primary' : media.status === 'completed' ? 'chip-success' : 'chip-neutral'"
                >{{ STATUS_LABELS[media.status] }}</span>
              </div>

              <div class="flex items-center gap-3 mt-1 text-caption-xs text-on-surface-variant flex-wrap">
                <span v-if="media.rating !== null" class="flex items-center gap-0.5">
                  <span class="material-symbols-outlined text-[14px] text-amber-500" style="font-variation-settings:'FILL' 1">star</span>
                  {{ media.rating }}/10
                </span>
                <span v-if="media.external_rating !== null">外部 {{ media.external_rating }}</span>
                <span v-if="media.air_date">{{ media.air_date }}</span>
                <span v-if="(media.current_progress?.episode ?? media.current_progress?.chapter ?? 0) > 0 || (media.total_episodes ?? 0) > 0">
                  {{ media.current_progress?.episode ?? media.current_progress?.chapter ?? 0 }}/{{ media.total_episodes ?? '-' }}
                </span>
              </div>

              <div v-if="media.tags && media.tags.length > 0" class="flex flex-wrap gap-1 mt-1.5">
                <span v-for="tag in media.tags.slice(0, 4)" :key="tag" class="text-caption-xs px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant/60">
                  #{{ tag }}
                </span>
                <span v-if="media.tags.length > 4" class="text-caption-xs text-on-surface-variant/40">+{{ media.tags.length - 4 }}</span>
              </div>
            </div>

            <!-- Delete -->
            <div class="shrink-0 pr-3 py-3 self-start">
              <button
                class="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant/30 hover:bg-error/10 hover:text-error transition-all"
                type="button"
                title="删除"
                @click.stop="confirmDelete(media.id, media.title)"
              >
                <span class="material-symbols-outlined text-[20px]">delete</span>
              </button>
            </div>
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

<style scoped>
/* ── Advanced filter slide animation ── */
.filter-slide-enter-active {
  transition: opacity 0.2s ease-out, margin-top 0.2s ease-out;
}
.filter-slide-leave-active {
  transition: opacity 0.15s ease-in, margin-top 0.15s ease-in;
}
.filter-slide-enter-from {
  opacity: 0;
  margin-top: -0.75rem;
}
.filter-slide-leave-to {
  opacity: 0;
  margin-top: -0.75rem;
}

/* ── Advanced button active state ── */
.btn-secondary.is-active {
  background-color: rgba(0, 120, 212, 0.12);
  border-color: rgba(0, 120, 212, 0.3);
  color: #005faa;
}
.dark .btn-secondary.is-active {
  background-color: rgba(211, 227, 255, 0.1);
  border-color: rgba(211, 227, 255, 0.2);
  color: #a3c9ff;
}

/* ── Inline filter fields (date / number) ── */
.filter-inline-field {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border-radius: 0.75rem;
  border: 1px solid rgba(192, 199, 212, 0.4);
  background-color: rgba(243, 243, 243, 0.6);
  padding: 0.375rem 0.75rem;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.filter-inline-field:focus-within {
  border-color: #005faa;
  box-shadow: 0 0 0 1px #005faa;
}
.dark .filter-inline-field {
  border-color: rgba(64, 64, 64, 0.6);
  background-color: rgba(38, 38, 38, 0.6);
}
.dark .filter-inline-field:focus-within {
  border-color: #d3e3ff;
  box-shadow: 0 0 0 1px #d3e3ff;
}

.filter-inline-label {
  font-size: 0.75rem;
  line-height: 1;
  color: #737373;
  white-space: nowrap;
  flex-shrink: 0;
}
.dark .filter-inline-label {
  color: #999;
}

.filter-inline-input {
  width: 100%;
  background: transparent;
  border: none;
  outline: none;
  font-size: 0.8125rem;
  line-height: 1.4;
  color: #1a1c1c;
  min-width: 0;
}
.filter-inline-input::placeholder {
  color: #c0c7d4;
}
.dark .filter-inline-input {
  color: #f5f5f5;
}
.dark .filter-inline-input::placeholder {
  color: #555;
}

/* ── Source select inline style override ── */
.source-select {
  padding: 0 0.5rem 0 0.75rem;
}
.source-select :deep(.app-select) {
  width: auto;
  display: flex;
}
.source-select :deep(.app-select-trigger) {
  border: none !important;
  background: transparent !important;
  padding: 0.25rem 0 !important;
  font-size: 0.8125rem !important;
  color: #1a1c1c !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  gap: 2px !important;
}
.dark .source-select :deep(.app-select-trigger) {
  color: #f5f5f5 !important;
}
.source-select :deep(.app-select-label) {
  color: inherit !important;
}
.source-select :deep(.app-select-arrow) {
  font-size: 18px !important;
  color: #999 !important;
}
.source-select :deep(.app-select-trigger:focus) {
  box-shadow: none !important;
}
.source-select :deep(.variant-field .app-select-trigger.has-value) {
  color: #1a1c1c !important;
}
.dark .source-select :deep(.variant-field .app-select-trigger.has-value) {
  color: #f5f5f5 !important;
}
</style>
