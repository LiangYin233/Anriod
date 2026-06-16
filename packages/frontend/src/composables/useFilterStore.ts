import { ref, watch } from 'vue'
import type { MediaType, Status } from '@anriod/shared'
import type { SelectOption } from '@/components/AppSelect.vue'

// ── Sort options ──

export const SORT_OPTIONS: SelectOption[] = [
  { value: 'updated_at:desc', label: '最近修改' },
  { value: 'air_date:desc', label: '最新上线' },
  { value: 'air_date:asc', label: '最早发布' },
  { value: 'rating:desc', label: '评分最高' },
  { value: 'title:asc', label: '标题 A-Z' },
]

const STORAGE_KEY_SORT = 'anriod_media_sort'

function getSavedSort(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_SORT)
    if (saved && SORT_OPTIONS.some(opt => opt.value === saved)) {
      return saved
    }
  } catch { /* localStorage unavailable */ }
  return SORT_OPTIONS[0].value
}

// ── Module-level singleton state (persists across component mounts) ──

const keyword = ref('')
const type = ref<MediaType | ''>('')
const status = ref<Status | ''>('')
const tagFilter = ref('')
const source = ref('')
const airDateFrom = ref('')
const airDateTo = ref('')
const epMin = ref<number | undefined>(undefined)
const epMax = ref<number | undefined>(undefined)
const sortBy = ref(getSavedSort())

// Search page state (persisted across navigation)
const searchSource = ref('bangumi')

// Guard flag: when true, URL changes triggered by syncFiltersToUrl won't
// re-trigger the route.query watcher (prevents double-fetch)
const isSyncingToUrl = ref(false)

// Persist sort to localStorage on change
watch(sortBy, (newSort) => {
  try {
    localStorage.setItem(STORAGE_KEY_SORT, newSort)
  } catch { /* localStorage unavailable */ }
})

// ── Helpers ──

export function hasActiveFilters(): boolean {
  return !!(
    keyword.value ||
    type.value ||
    status.value ||
    tagFilter.value ||
    source.value ||
    airDateFrom.value ||
    airDateTo.value ||
    epMin.value !== undefined ||
    epMax.value !== undefined
  )
}

export function clearAllFilters() {
  keyword.value = ''
  type.value = ''
  status.value = ''
  tagFilter.value = ''
  source.value = ''
  airDateFrom.value = ''
  airDateTo.value = ''
  epMin.value = undefined
  epMax.value = undefined
}

// ── Composable export (all components share the same singleton) ──

export function useFilterStore() {
  return {
    keyword,
    type,
    status,
    tagFilter,
    source,
    airDateFrom,
    airDateTo,
    epMin,
    epMax,
    sortBy,
    searchSource,
    isSyncingToUrl,
    hasActiveFilters,
    clearAllFilters
  }
}
