<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { CreditsResponse, MediaDetails, Status } from '@anriod/shared'
import { MEDIA_TYPES, STATUS_LABELS, STATUS_VALUES } from '@anriod/shared'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import ErrorBanner from '@/components/ErrorBanner.vue'
import EmptyState from '@/components/EmptyState.vue'
import { api } from '@/utils/api'
import { useTauri } from '@/composables/useTauri'
import { useAsyncState } from '@/composables/useAsyncState'
import { useToast } from '@/composables/useToast'
import { getCoverSrc } from '@/utils/cover'
import CreditList from '@/components/CreditList.vue'
import AppSelect from '@/components/AppSelect.vue'

const route = useRoute()
const router = useRouter()
const { openUrl } = useTauri()

const source = String(route.query.source || '')
const sourceId = String(route.query.source_id || '')
const mediaType = String(route.query.type || '')
const fromPage = String(route.query.from || '')

const detail = ref<MediaDetails | null>(null)
const credits = ref<CreditsResponse | null>(null)
const { loading, error, execute } = useAsyncState()
const toast = useToast()
const importing = ref(false)
const importStatus = ref<Status>('plan_to_watch')
const statusOptions = STATUS_VALUES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))

const breadcrumb = computed(() => {
  if (fromPage === 'discover') {
    return { label: '发现', path: '/discover' }
  }
  return { label: '搜索', path: '/search' }
})

const infoRows = computed(() => {
  if (!detail.value) return []
  const rows: { label: string; value: string }[] = [
    { label: '标题', value: detail.value.title },
    { label: '类型', value: MEDIA_TYPES[detail.value.media_type] || detail.value.media_type }
  ]
  if (detail.value.air_date) rows.push({ label: '发布日期', value: detail.value.air_date })
  if (detail.value.total_episodes) rows.push({ label: '总集数', value: `${detail.value.total_episodes}` })
  if (detail.value.studio) rows.push({ label: '制作/开发', value: detail.value.studio })
  if (detail.value.external_rating) rows.push({ label: '外部评分', value: `${detail.value.external_rating} / 10` })
  rows.push({ label: '数据源', value: detail.value.source })
  if (detail.value.source_id) rows.push({ label: '源 ID', value: detail.value.source_id })
  return rows
})

const invalidParams = !source || !sourceId

async function loadDetails() {
  if (invalidParams) return

  await execute(async () => {
    const [detailData, creditsData] = await Promise.all([
      api.fetchDetails({ source, source_id: sourceId, type: mediaType || undefined }),
      api.fetchCredits({ source, source_id: sourceId, type: mediaType || undefined }).catch(() => null)
    ])
    detail.value = detailData
    if (creditsData && (creditsData.cast.length > 0 || creditsData.crew.length > 0)) {
      credits.value = creditsData
    }
  }, '加载作品详情失败')
}

async function importToLibrary() {
  if (!detail.value) return
  importing.value = true
  try {
    await api.importMedia({
      source: detail.value.source,
      source_id: detail.value.source_id,
      type: detail.value.media_type,
      status: importStatus.value
    })
    toast.success(`「${detail.value.title}」已添加至媒体库`)
    router.push('/')
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '导入失败'
  } finally {
    importing.value = false
  }
}

onMounted(loadDetails)
</script>

<template>
  <div class="section-gap">
    <!-- Breadcrumbs -->
    <div class="flex items-center gap-2 text-body-md text-on-surface-variant">
      <RouterLink to="/" class="transition-colors hover:text-on-surface">媒体库</RouterLink>
      <span class="material-symbols-outlined text-sm">chevron_right</span>
      <RouterLink :to="breadcrumb.path" class="transition-colors hover:text-on-surface">{{ breadcrumb.label }}</RouterLink>
      <span class="material-symbols-outlined text-sm">chevron_right</span>
      <span class="text-on-surface">作品预览</span>
    </div>

    <ErrorBanner v-if="error" :message="error" />
    <LoadingSpinner v-if="loading" message="加载作品信息..." />
    <EmptyState v-if="!detail && invalidParams" icon="travel_explore" description="请从搜索或发现页进入作品预览" />

    <template v-if="detail">
      <div class="grid gap-stack-lg lg:grid-cols-[minmax(0,1fr)_320px]">
        <!-- LEFT COLUMN -->
        <div class="flex flex-col gap-stack-lg">

          <!-- Hero -->
          <div class="flex flex-col items-start gap-stack-md sm:flex-row">
            <div class="cover-wrapper relative w-48 shrink-0 overflow-hidden rounded-lg border border-outline-variant/20 shadow-lg">
              <img
                v-if="detail.cover_url"
                :src="getCoverSrc(detail.cover_url)"
                :alt="detail.title"
                class="cover-img aspect-poster w-full object-cover"
              />
              <div v-else class="aspect-poster flex w-full items-center justify-center bg-surface-variant">
                <span class="material-symbols-outlined text-5xl text-on-surface-variant">movie</span>
              </div>
              <div class="absolute left-2 top-2 rounded bg-surface/80 px-2 py-1 text-caption-xs font-medium text-primary backdrop-blur-md shadow-sm">
                {{ MEDIA_TYPES[detail.media_type] || detail.media_type }}
              </div>
            </div>

            <div class="flex flex-col gap-3 pt-2">
              <h1 class="text-[36px] leading-[44px] tracking-tight font-bold text-on-surface">{{ detail.title }}</h1>
              <p class="text-headline-md text-on-surface-variant">
                {{ MEDIA_TYPES[detail.media_type] || detail.media_type }}
                <template v-if="detail.air_date"> · {{ detail.air_date }}</template>
                <template v-if="detail.studio"> · {{ detail.studio }}</template>
              </p>

              <div class="flex flex-wrap items-center gap-2">
                <span class="chip chip-neutral">{{ detail.source }}</span>
                <span v-if="detail.external_rating" class="chip chip-primary">
                  <span class="material-symbols-outlined text-[14px]" style="font-variation-settings:'FILL' 1">star</span>
                  {{ detail.external_rating }}
                </span>
                <span v-if="detail.total_episodes" class="chip chip-neutral">
                  {{ detail.total_episodes }} 集
                </span>
                <span v-if="detail.air_date" class="chip chip-neutral">
                  {{ detail.air_date }}
                </span>
              </div>

              <div class="mt-2 flex items-center gap-3">
                <button
                  class="btn-primary"
                  type="button"
                  :disabled="importing"
                  @click="importToLibrary"
                >
                  <span class="material-symbols-outlined text-[20px]">library_add</span>
                  {{ importing ? '导入中...' : '加入媒体库' }}
                </button>
                <AppSelect v-model="importStatus" :options="statusOptions" variant="fluent" />
                <button
                  v-if="detail.source_url"
                  class="btn-secondary"
                  type="button"
                  @click="openUrl(detail.source_url!)"
                >
                  <span class="material-symbols-outlined text-[20px]">open_in_new</span>
                  查看原文
                </button>
              </div>
            </div>
          </div>

          <!-- Credits (cast & crew) -->
          <CreditList v-if="credits" :cast="credits.cast" :crew="credits.crew" />

          <!-- Synopsis -->
          <div v-if="detail.description">
            <h3 class="mb-unit flex items-center gap-2 text-title-sm text-on-surface">
              <span class="h-4 w-1 rounded-full bg-primary" />
              简介
            </h3>
            <div class="glass-card rounded-lg p-stack-md shadow-sm">
              <p class="leading-relaxed text-body-md text-on-surface-variant whitespace-pre-line">{{ detail.description }}</p>
            </div>
          </div>

          <!-- Raw metadata -->
          <div v-if="detail.raw_metadata && Object.keys(detail.raw_metadata).length > 0">
            <h3 class="mb-unit flex items-center gap-2 text-title-sm text-on-surface">
              <span class="h-4 w-1 rounded-full bg-primary" />
              元数据
            </h3>
            <details class="glass-card rounded-lg p-stack-md shadow-sm">
              <summary class="text-label-sm text-on-surface-variant cursor-pointer hover:text-on-surface transition-colors select-none">
                查看完整元数据 ({{ Object.keys(detail.raw_metadata).length }} 项)
              </summary>
              <pre class="mt-3 overflow-x-auto rounded bg-surface-container p-3 text-caption-xs text-on-surface-variant leading-relaxed">{{ JSON.stringify(detail.raw_metadata, null, 2) }}</pre>
            </details>
          </div>
        </div>

        <!-- RIGHT COLUMN -->
        <aside class="lg:sticky lg:top-24 flex flex-col gap-stack-md">
          <!-- 作品信息卡片 -->
          <div class="acrylic overflow-hidden rounded-xl border border-white/60 shadow-lg">
            <div class="border-b border-outline-variant/20 bg-surface-container-lowest/50 px-5 py-4">
              <h3 class="text-title-sm font-semibold text-on-surface">作品信息</h3>
            </div>

            <div class="flex flex-col gap-4 p-5">
              <div
                v-for="row in infoRows"
                :key="row.label"
                class="flex items-baseline justify-between gap-4"
              >
                <span class="text-label-sm text-on-surface-variant shrink-0">{{ row.label }}</span>
                <span class="text-label-sm text-on-surface text-right truncate">{{ row.value || '—' }}</span>
              </div>

              <div class="pt-3 border-t border-outline-variant/20">
                <button
                  class="btn-secondary w-full"
                  type="button"
                  @click="router.push(`/search?q=${encodeURIComponent(detail.title)}`)"
                >
                  <span class="material-symbols-outlined text-[18px]">search</span>
                  搜索相关作品
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </template>
  </div>
</template>
