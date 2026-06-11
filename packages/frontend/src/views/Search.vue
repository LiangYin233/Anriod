<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { MediaType, SearchResult, Status } from '@anriod/shared'
import { MEDIA_TYPES, MEDIA_TYPE_VALUES, STATUS_LABELS, STATUS_VALUES } from '@anriod/shared'
import SearchBar from '@/components/SearchBar.vue'
import PageHeader from '@/components/PageHeader.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import EmptyState from '@/components/EmptyState.vue'
import ErrorBanner from '@/components/ErrorBanner.vue'
import AppSelect from '@/components/AppSelect.vue'
import { api } from '@/utils/api'
import { useToast } from '@/composables/useToast'

const query = ref('')
const searched = ref(false)
const source = ref('bangumi')
const sources = ref<Array<{ name: string; supportedTypes: string[] }>>([])
const sourceOptions = computed(() => sources.value.map((s) => ({ value: s.name, label: s.name })))
const mediaTypeOptions = MEDIA_TYPE_VALUES.map((mt) => ({ value: mt, label: MEDIA_TYPES[mt] }))
const manualStatusOptions = STATUS_VALUES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))
const results = ref<SearchResult[]>([])
const loading = ref(false)
const error = ref('')
const importingId = ref('')
const toast = useToast()

// Manual import modal
const manualOpen = ref(false)
const manualTitle = ref('')
const manualType = ref<MediaType>('anime')
const manualStatus = ref<Status>('plan_to_watch')
const manualSaving = ref(false)

async function manualImport() {
  if (!manualTitle.value.trim()) return
  manualSaving.value = true
  try {
    await api.createMedia({
      title: manualTitle.value.trim(),
      type: manualType.value,
      status: manualStatus.value
    })
    toast.success(`「${manualTitle.value.trim()}」已手动添加`)
    manualOpen.value = false
    manualTitle.value = ''
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '添加失败'
  } finally {
    manualSaving.value = false
  }
}

async function loadSources() {
  try {
    const result = await api.dataSources()
    sources.value = result.data
    if (!sources.value.find((s) => s.name === source.value) && sources.value[0]) {
      source.value = sources.value[0].name
    }
  } catch { /* keep defaults */ }
}

async function runSearch() {
  if (!query.value.trim()) return
  searched.value = true
  loading.value = true
  error.value = ''
  try {
    results.value = await api.search({ query: query.value, source: source.value || undefined })
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '搜索失败'
  } finally {
    loading.value = false
  }
}

async function importResult(result: SearchResult) {
  importingId.value = `${result.source}:${result.source_id}`
  error.value = ''
  try {
    await api.importMedia({ source: result.source, source_id: result.source_id, type: result.media_type, status: 'plan_to_watch' })
    toast.success(`「${result.title}」已添加至媒体库`)
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '导入失败'
  } finally {
    importingId.value = ''
  }
}

onMounted(loadSources)
</script>

<template>
  <div class="section-gap">
    <PageHeader title="搜索导入" description="从数据源查找并导入媒体记录。" />

    <!-- Search Hero -->
    <div class="acrylic rounded-xl border border-outline-variant/20 p-6 shadow-sm">
      <div class="flex flex-wrap items-end gap-3">
        <div class="flex-1 min-w-[200px]">
          <SearchBar v-model="query" placeholder="搜索作品名..." @search="runSearch" />
        </div>
        <div class="w-40 shrink-0">
          <AppSelect v-model="source" :options="sourceOptions" variant="fluent" />
        </div>
      </div>
    </div>

    <ErrorBanner v-if="error" :message="error" />
    <LoadingSpinner v-if="loading" message="搜索中..." />

    <!-- Results -->
    <template v-if="results.length > 0">
      <h3 class="text-title-sm text-on-surface-variant px-1">搜索结果 ({{ results.length }})</h3>
      <div class="space-y-stack-md">
        <article
          v-for="result in results"
          :key="`${result.source}:${result.source_id}`"
          class="acrylic flex flex-col items-start gap-gutter rounded-xl border border-outline-variant/20 p-stack-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md sm:flex-row sm:items-center"
          :class="{ 'opacity-70': importingId === `${result.source}:${result.source_id}` }"
        >
          <div class="relative h-36 w-24 shrink-0 overflow-hidden rounded-lg bg-surface-container-high shadow-sm">
            <img v-if="result.cover_url" :src="result.cover_url" :alt="result.title" class="h-full w-full object-cover" loading="lazy" />
            <div v-else class="flex h-full w-full items-center justify-center bg-surface-variant">
              <span class="material-symbols-outlined text-3xl text-on-surface-variant">movie</span>
            </div>
            <div class="absolute left-1 top-1 rounded bg-surface-container/80 px-2 py-0.5 text-[10px] font-medium text-on-surface backdrop-blur-sm">
              {{ result.source }}
            </div>
          </div>

          <div class="flex min-w-0 flex-1 flex-col py-1">
            <div class="flex items-start justify-between">
              <div class="min-w-0">
                <h4 class="mb-1 truncate text-title-sm text-on-surface">{{ result.title }}</h4>
                <p class="mb-2 text-sm text-on-surface-variant">
                  {{ MEDIA_TYPES[result.media_type] }}
                  <template v-if="result.year"> · {{ result.year }}</template>
                </p>
              </div>
            </div>

            <div v-if="result.external_rating != null" class="mb-3 flex items-center gap-2">
              <span class="flex items-center rounded bg-secondary/10 px-2 py-0.5 text-label-sm text-secondary">
                <span class="material-symbols-outlined mr-1 text-[14px]" style="font-variation-settings: 'FILL' 1;">star</span>
                {{ result.external_rating }}
              </span>
            </div>

            <div class="mt-auto flex justify-end">
              <button
                class="btn-primary"
                type="button"
                :disabled="importingId === `${result.source}:${result.source_id}`"
                @click="importResult(result)"
              >
                <template v-if="importingId === `${result.source}:${result.source_id}`">
                  <span class="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                  导入中...
                </template>
                <template v-else>
                  <span class="material-symbols-outlined text-[18px]">download</span>
                  导入媒体库
                </template>
              </button>
            </div>
          </div>
        </article>
      </div>
    </template>

    <EmptyState
      v-else-if="searched && !loading"
      icon="search_off"
      title="未找到结果"
      description="尝试其他关键词或切换数据源。"
    />
    <div class="mt-stack-lg text-center">
      <button
        class="text-caption-xs text-on-surface-variant underline underline-offset-4 decoration-outline-variant hover:text-primary hover:decoration-primary transition-colors"
        type="button"
        @click="manualOpen = true"
      >
        手动导入
      </button>
    </div>

    <!-- Manual Import Modal -->
    <Teleport to="body">
      <div v-if="manualOpen" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="manualOpen = false" />
        <div class="acrylic relative z-10 w-full max-w-sm rounded-2xl border border-white/40 p-6 shadow-xl">
          <h3 class="mb-4 text-title-sm font-semibold">手动添加</h3>
          <div class="flex flex-col gap-3">
            <input v-model="manualTitle" class="field-fluent" placeholder="作品名称" @keydown.enter="manualImport" />
            <AppSelect v-model="manualType" :options="mediaTypeOptions" variant="field" />
            <AppSelect v-model="manualStatus" :options="manualStatusOptions" variant="field" />
          </div>
          <div class="mt-5 flex justify-end gap-3">
            <button class="btn-secondary" type="button" @click="manualOpen = false">取消</button>
            <button class="btn-primary" type="button" :disabled="manualSaving || !manualTitle.trim()" @click="manualImport">
              {{ manualSaving ? '添加中...' : '添加' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
