<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import type { CreditsResponse, Episode, Media, MediaType, Status, WatchHistory } from '@anriod/shared'
import { EPISODE_TYPE_LABELS, MEDIA_TYPES, MEDIA_TYPE_VALUES, STATUS_LABELS, STATUS_VALUES } from '@anriod/shared'
import { api } from '@/utils/api'
import { getCoverSrc } from '@/utils/cover'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import ErrorBanner from '@/components/ErrorBanner.vue'
import AppSelect from '@/components/AppSelect.vue'
import { useToast } from '@/composables/useToast'
import { useTauri } from '@/composables/useTauri'
import { formatDate } from '@/utils/format'
import { isChapterBased, progressVal, progressUnit, progressLabel } from '@/utils/progress'

function episodeLabel(h: WatchHistory): string {
  const from = h.progress_from
  const to = h.progress_to
  const fromVal = progressVal(from)
  const toVal = progressVal(to)
  if (toVal > 0) {
    const prefix = from?.chapter !== undefined ? 'CH' : 'EP'
    if (fromVal > 0 && fromVal !== toVal) return `${prefix}${fromVal} → ${prefix}${toVal}`
    return `${prefix}${toVal}`
  }
  return ''
}

const route = useRoute()
const mediaId = computed(() => String(route.params.id))
const media = ref<Media | null>(null)
const history = ref<WatchHistory[]>([])
const credits = ref<CreditsResponse | null>(null)
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const toast = useToast()
const { openUrl } = useTauri()

const title = ref('')
const status = ref<Status>('plan_to_watch')
const rating = ref<number | null>(null)
const notes = ref('')
const episode = ref(0)
const watchDate = ref('')
const editingEp = ref(0)
const epNotes = ref<Record<number, string>>({})
const tagsText = ref('')
const editType = ref<MediaType>('anime')
const editAirDate = ref('')
const editTotalEp = ref<number | null>(null)
const editStudio = ref('')
const editCoverUrl = ref('')
const editExternalRating = ref<number | null>(null)
const editDescription = ref('')
const showMore = ref(false)

// Episode list from source metadata
const episodes = computed(() => {
  if (!media.value?.source_metadata) return []
  const metadata = media.value.source_metadata
  if (!metadata || typeof metadata !== 'object') return []
  return (Array.isArray((metadata as any).episodes) ? (metadata as any).episodes : []) as Episode[]
})

const specialEpisodes = computed(() => episodes.value.filter(ep => ep?.type === 1))
const otherEpisodes = computed(() => episodes.value.filter(ep => ep?.type && ep.type > 1))

const editTypeOptions = MEDIA_TYPE_VALUES.map((mt) => ({ value: mt, label: MEDIA_TYPES[mt] }))
const statusOptions = STATUS_VALUES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))

const coverSrc = computed(() => getCoverSrc(media.value?.cover_url))

function fillForm(item: Media) {
  title.value = item.title
  status.value = item.status
  rating.value = item.rating
  notes.value = item.notes ?? ''
  episode.value = progressVal(item.current_progress)
  tagsText.value = item.tags?.join(', ') ?? ''
  editType.value = item.type
  editAirDate.value = item.air_date ?? ''
  editTotalEp.value = item.total_episodes
  editStudio.value = item.studio ?? ''
  editCoverUrl.value = item.cover_url ?? ''
  editExternalRating.value = item.external_rating
  editDescription.value = item.description ?? ''
}

async function loadDetail() {
  loading.value = true
  error.value = ''
  try {
    // Fetch media first to get source_id for credits
    media.value = await api.getMedia(mediaId.value)
    fillForm(media.value)

    // Then parallelize history and credits loading
    const promises: Promise<any>[] = [
      api.listHistory({ media_id: mediaId.value }).then(res => res.data)
    ]

    // Add credits loading if source_id is available
    if (media.value.source_id && media.value.source) {
      promises.push(
        api.fetchCredits({
          source: media.value.source,
          source_id: media.value.source_id,
          type: media.value.type
        }).catch(err => {
          console.warn('Failed to load credits:', err)
          return null
        })
      )
    }

    const [historyData, creditsData] = await Promise.all(promises)

    history.value = historyData
    if (creditsData && (creditsData.cast?.length > 0 || creditsData.crew?.length > 0)) {
      credits.value = creditsData
    }

    // Build progress→notes map from history data
    const notes: Record<number, string> = {}
    for (const h of history.value) {
      const to = progressVal(h.progress_to)
      if (h.notes && to > 0) notes[to] = h.notes
    }
    epNotes.value = notes
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '加载详情失败'
  } finally {
    loading.value = false
  }
}

// When clicking an episode/chapter, show its watch date
watch(editingEp, (ep) => {
  if (!ep || ep > progressVal(media.value?.current_progress)) {
    watchDate.value = ''
    return
  }
  // Find the history entry that covers this episode/chapter
  const h = history.value.find(
    (item) => progressVal(item.progress_to) === ep
  )
  if (h) {
    const d = new Date(h.started_at)
    watchDate.value = d.toISOString().slice(0, 10)
  } else {
    watchDate.value = ''
  }
})

async function saveDetail() {
  if (!media.value) return
  saving.value = true
  error.value = ''
  try {
    media.value = await api.updateMedia(media.value.id, {
      title: title.value,
      type: editType.value,
      status: status.value,
      rating: rating.value,
      notes: notes.value || null,
      tags: tagsText.value.split(',').map((t) => t.trim()).filter(Boolean),
      air_date: editAirDate.value || null,
      total_episodes: editTotalEp.value,
      studio: editStudio.value || null,
      cover_url: editCoverUrl.value || null,
      external_rating: editExternalRating.value,
      description: editDescription.value || null
    })
    fillForm(media.value)
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '保存失败'
  } finally {
    saving.value = false
  }
}

async function saveProgress() {
  if (!media.value) return
  const field = isChapterBased(media.value.type) ? 'chapter' : 'episode'
  try {
    media.value = await api.updateProgress(media.value.id, {
      current_progress: { [field]: episode.value },
      started_at: watchDate.value ? new Date(watchDate.value).toISOString() : null
    })
    fillForm(media.value)
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '保存进度失败'
  }
}

async function saveEpNote(ep: number) {
  if (!media.value) return
  const note = epNotes.value[ep]?.trim() || null
  const field = isChapterBased(media.value.type) ? 'chapter' : 'episode'
  const prefix = progressUnit(media.value.type)
  try {
    // Check if a history entry for this episode/chapter already exists
    const existing = history.value.find(
      (h) => progressVal(h.progress_to) === ep
    )
    if (existing) {
      await api.updateHistory(existing.id, { notes: note })
    } else {
      await api.createHistory({
        media_id: media.value.id,
        progress_from: { [field]: ep - 1 },
        progress_to: { [field]: ep },
        notes: note
      })
    }
    toast.success(note ? `${prefix}${ep} 笔记已保存` : `${prefix}${ep} 笔记已清除`)
    await loadDetail()
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '保存笔记失败'
  }
}

async function syncCurrent() {
  if (!media.value) return
  saving.value = true
  error.value = ''
  try {
    media.value = await api.syncMedia(media.value.id)
    fillForm(media.value)
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '同步失败'
  } finally {
    saving.value = false
  }
}

onMounted(loadDetail)
</script>

<template>
  <div class="section-gap">
    <!-- Breadcrumbs -->
    <div class="flex items-center gap-2 text-body-md text-on-surface-variant">
      <RouterLink to="/" class="transition-colors hover:text-on-surface">媒体库</RouterLink>
      <span class="material-symbols-outlined text-sm">chevron_right</span>
      <span class="text-on-surface">详情</span>
    </div>

    <ErrorBanner v-if="error" :message="error" />
    <LoadingSpinner v-if="loading" />

    <template v-if="media">
      <div class="grid gap-stack-lg lg:grid-cols-[minmax(0,1fr)_380px]">
        <!-- LEFT COLUMN -->
        <div class="flex flex-col gap-stack-lg">
          <!-- Hero -->
          <div class="flex flex-col items-start gap-stack-md sm:flex-row">
            <div class="cover-wrapper relative w-48 shrink-0 overflow-hidden rounded-lg border border-outline-variant/20 shadow-lg group">
              <img
                v-if="coverSrc"
                :src="coverSrc"
                :alt="media.title"
                class="cover-img aspect-poster w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div v-else class="aspect-poster flex w-full items-center justify-center bg-surface-variant">
                <span class="material-symbols-outlined text-5xl text-on-surface-variant">movie</span>
              </div>
              <div class="absolute left-2 top-2 rounded bg-surface/80 px-2 py-1 text-caption-xs font-medium text-primary backdrop-blur-md shadow-sm">
                {{ MEDIA_TYPES[media.type] }}
              </div>
            </div>

            <div class="flex flex-col gap-2 pt-2">
              <h1 class="text-[36px] leading-[44px] tracking-tight font-bold text-on-surface">{{ media.title }}</h1>
              <p class="text-headline-md text-on-surface-variant">
                {{ MEDIA_TYPES[media.type] }}<template v-if="media.air_date"> · {{ media.air_date }}</template>
              </p>

              <div v-if="media.tags?.length" class="mt-1 flex flex-wrap gap-2">
                <span v-for="tag in media.tags" :key="tag" class="rounded-full bg-surface-container-highest px-3 py-1 text-label-sm text-on-surface">{{ tag }}</span>
              </div>

              <div class="mt-3 flex flex-wrap items-center gap-3">
                <button v-if="media.source_id" class="btn-primary" type="button" :disabled="saving" @click="syncCurrent">
                  <span class="material-symbols-outlined text-[20px]">sync</span>
                  <span class="whitespace-nowrap">同步</span>
                </button>
                <button
                  v-if="media.source_url"
                  class="btn-secondary"
                  type="button"
                  @click="openUrl(media.source_url!)"
                  title="在外部浏览器中打开"
                >
                  <span class="material-symbols-outlined text-[20px]">open_in_new</span>
                  <span class="whitespace-nowrap">数据源</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Bento metadata -->
          <div class="grid grid-cols-2 gap-unit md:grid-cols-4">
            <div class="glass-card reveal-hover flex flex-col items-center justify-center rounded-lg p-4 shadow-sm">
              <span class="material-symbols-outlined mb-1 text-tertiary">star</span>
              <span class="text-headline-md font-bold text-on-surface">{{ media.external_rating ?? '-' }}</span>
              <span class="text-caption-xs text-on-surface-variant">外部评分</span>
            </div>
            <div class="glass-card reveal-hover flex flex-col items-center justify-center rounded-lg p-4 shadow-sm">
              <span class="material-symbols-outlined mb-1 text-tertiary">video_file</span>
              <span class="text-headline-md font-bold text-on-surface">{{ progressVal(media.current_progress) }}/{{ media.total_episodes ?? '-' }}</span>
              <span class="text-caption-xs text-on-surface-variant">{{ progressLabel(media.type) }}进度</span>
            </div>
            <div class="glass-card reveal-hover flex flex-col items-center justify-center rounded-lg p-4 shadow-sm">
              <span class="material-symbols-outlined mb-1 text-tertiary">business</span>
              <span class="text-[16px] font-semibold leading-tight text-center text-on-surface">{{ media.studio || '未知' }}</span>
              <span class="mt-1 text-caption-xs text-on-surface-variant">制作</span>
            </div>
            <div class="glass-card reveal-hover flex flex-col items-center justify-center rounded-lg p-4 shadow-sm">
              <span class="material-symbols-outlined mb-1 text-tertiary">calendar_month</span>
              <span class="text-[16px] font-semibold leading-tight text-center text-on-surface">{{ media.air_date ?? '未知' }}</span>
              <span class="mt-1 text-caption-xs text-on-surface-variant">首播</span>
            </div>
          </div>

          <!-- Episode/Chapter Grid (above Synopsis) -->
          <div v-if="['anime','tv','novel','manga'].includes(media.type) && media.total_episodes" class="flex flex-col gap-unit">
            <div class="flex items-center justify-between">
              <h3 class="flex items-center gap-2 text-title-sm text-on-surface">
                <span class="h-4 w-1 rounded-full bg-primary" />
                {{ progressLabel(media.type) }}进度
              </h3>
              <div class="flex items-center gap-1">
                <input
                  v-model="watchDate"
                  type="date"
                  class="rounded border border-outline-variant bg-surface-container-lowest px-2 py-1 text-caption-xs text-on-surface outline-none focus:border-primary"
                />
                <button class="btn-icon" type="button" :disabled="episode <= 0" @click="episode = Math.max(0, episode - 1); saveProgress()">
                  <span class="material-symbols-outlined">remove</span>
                </button>
                <span class="text-label-sm font-bold text-primary tabular-nums w-10 text-center">{{ episode }}</span>
                <span class="text-caption-xs text-on-surface-variant">/ {{ media.total_episodes }}</span>
                <button
                  class="btn-icon"
                  type="button"
                  :disabled="media.total_episodes && episode >= media.total_episodes"
                  @click="episode = Math.min(media.total_episodes || Infinity, episode + 1); saveProgress()"
                >
                  <span class="material-symbols-outlined">add</span>
                </button>
              </div>
            </div>

            <!-- Progress bar -->
            <div class="w-full h-1.5 rounded-full bg-surface-container overflow-hidden">
              <div
                class="h-full rounded-full transition-all"
                :class="episode >= media.total_episodes ? 'bg-emerald-400' : 'bg-primary'"
                :style="{ width: `${Math.min(100, Math.round((episode / media.total_episodes) * 100))}%` }"
              />
            </div>

            <!-- Episode/Chapter boxes grid -->
            <div class="glass-card rounded-lg p-4 shadow-sm">
              <div class="flex items-center justify-between mb-2">
                <span class="text-caption-xs text-on-surface-variant">点击集数快速跳转</span>
                <span class="text-caption-xs text-on-surface-variant/70">提示: 正片外的 SP/OVA 可手动输入</span>
              </div>
              <div class="grid gap-2" :style="{ gridTemplateColumns: `repeat(auto-fill, minmax(48px, 1fr))` }">
                <button
                  v-for="ep in media.total_episodes"
                  :key="ep"
                  class="flex flex-col items-center justify-center rounded-lg border py-2 transition-all hover:shadow-sm"
                  :class="[
                    ep <= progressVal(media.current_progress)
                      ? 'bg-primary-container/20 border-primary/30 text-on-surface'
                      : 'bg-surface-container-low border-outline-variant/30 text-on-surface-variant',
                    editingEp === ep ? 'ring-2 ring-primary' : ''
                  ]"
                  @click="editingEp = editingEp === ep ? 0 : ep"
                >
                  <span class="text-label-sm font-semibold">{{ progressUnit(media.type) }}{{ ep }}</span>
                  <span class="mt-0.5 h-4 flex items-center gap-0.5">
                    <span v-if="ep <= progressVal(media.current_progress)" class="material-symbols-outlined text-[14px] text-primary">check_circle</span>
                    <span v-if="epNotes[ep]" class="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="有笔记" />
                  </span>
                </button>
              </div>

              <!-- Note editor -->
              <div v-if="editingEp" class="mt-4 border-t border-outline-variant/20 pt-4">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-label-sm font-semibold text-on-surface">{{ progressUnit(media.type) }}{{ editingEp }} 笔记</span>
                  <button class="btn-icon" type="button" @click="editingEp = 0; epNotes[editingEp] = ''">
                    <span class="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>
                <textarea
                  v-model="epNotes[editingEp]"
                  class="field-fluent resize-none w-full"
                  :placeholder="`这一${progressLabel(media.type).slice(0, -1)}的感想...`"
                  rows="3"
                />
                <div class="flex gap-2 mt-3">
                  <button class="btn-primary text-sm" type="button" @click="epNotes[editingEp] = ''">
                    清空笔记
                  </button>
                  <button class="btn-primary text-sm" type="button" @click="saveEpNote(editingEp)">
                    保存笔记
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Special Episodes (SP/OVA) -->
          <div v-if="specialEpisodes.length > 0" class="glass-card rounded-xl p-stack-md shadow-sm">
            <h3 class="mb-unit flex items-center gap-2 text-title-sm text-on-surface">
              <span class="h-4 w-1 rounded-full bg-primary" />
              特别篇 / OVA
            </h3>
            <div class="flex flex-col gap-2">
              <div
                v-for="spEp in specialEpisodes"
                :key="spEp.ep"
                class="flex items-center gap-3 rounded-lg border border-outline-variant/20 bg-surface-container-low p-3 transition-colors hover:bg-surface-container-high"
              >
                <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-tertiary-container">
                  <span class="text-label-sm font-bold text-on-tertiary-container">SP</span>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-body-sm font-medium text-on-surface">{{ spEp.name_cn || spEp.name || `SP ${spEp.ep}` }}</p>
                  <p v-if="spEp.name_cn && spEp.name" class="text-caption-xs text-on-surface-variant truncate">{{ spEp.name }}</p>
                </div>
                <span class="shrink-0 rounded-full bg-surface-container px-2.5 py-0.5 text-[10px] font-medium text-on-surface-variant">
                  {{ spEp.ep }}
                </span>
              </div>
            </div>
          </div>

          <!-- Other Episodes (OP/ED/PV) -->
          <div v-if="otherEpisodes.length > 0" class="glass-card rounded-xl p-stack-md shadow-sm">
            <details>
              <summary class="cursor-pointer flex items-center gap-2 text-title-sm text-on-surface hover:text-primary">
                <span class="h-4 w-1 rounded-full bg-primary" />
                OP / ED / PV
                <span class="text-caption-xs text-on-surface-variant">({{ otherEpisodes.length }})</span>
              </summary>
              <div class="mt-3 flex flex-col gap-1">
                <div
                  v-for="otherEp in otherEpisodes"
                  :key="otherEp.ep"
                  class="flex items-center justify-between rounded px-2 py-1.5 text-caption-sm hover:bg-surface-container"
                >
                  <span class="text-on-surface">{{ otherEp.name_cn || otherEp.name || `${EPISODE_TYPE_LABELS[otherEp.type]} ${otherEp.ep}` }}</span>
                  <span class="rounded bg-surface-variant px-1.5 py-0.5 text-[9px] text-on-surface-variant">{{ EPISODE_TYPE_LABELS[otherEp.type] }}</span>
                </div>
              </div>
            </details>
          </div>

          <!-- Synopsis -->
          <div v-if="media.description">
            <h3 class="mb-unit flex items-center gap-2 text-title-sm text-on-surface">
              <span class="h-4 w-1 rounded-full bg-primary" />
              简介
            </h3>
            <div class="glass-card rounded-lg p-stack-md shadow-sm">
              <p class="leading-relaxed text-body-md text-on-surface-variant">{{ media.description }}</p>
            </div>
          </div>

          <!-- Credits (cast & crew) -->
          <div v-if="credits && credits.cast.length > 0" class="glass-card rounded-xl p-stack-md shadow-sm">
            <h3 class="mb-unit flex items-center gap-2 text-title-sm text-on-surface">
              <span class="h-4 w-1 rounded-full bg-primary" />
              声优 / 演员
            </h3>
            <div class="flex gap-4 overflow-x-auto pb-2 -mx-2 px-2 snap-x snap-mandatory scrollbar-thin">
              <div
                v-for="person in credits.cast.slice(0, 15)"
                :key="`${person.name}-${person.character || person.role}`"
                class="snap-start shrink-0 w-24 text-center"
              >
                <div class="w-16 h-16 mx-auto rounded-full overflow-hidden bg-surface-container-high shadow-sm">
                  <img
                    v-if="person.image"
                    :src="person.image"
                    :alt="person.name"
                    class="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div v-else class="flex w-full h-full items-center justify-center bg-surface-variant">
                    <span class="material-symbols-outlined text-xl text-on-surface-variant">person</span>
                  </div>
                </div>
                <p class="mt-1.5 text-caption-xs font-medium text-on-surface leading-tight line-clamp-2">{{ person.name }}</p>
                <p v-if="person.character" class="text-[10px] text-on-surface-variant/60 leading-tight line-clamp-1">{{ person.character }}</p>
              </div>
            </div>
          </div>

          <div v-if="credits && credits.crew.length > 0" class="glass-card rounded-xl p-stack-md shadow-sm">
            <h3 class="mb-unit flex items-center gap-2 text-title-sm text-on-surface">
              <span class="h-4 w-1 rounded-full bg-primary" />
              制作人员
            </h3>
            <div class="flex gap-4 overflow-x-auto pb-2 -mx-2 px-2 snap-x snap-mandatory scrollbar-thin">
              <div
                v-for="person in credits.crew.slice(0, 15)"
                :key="`${person.name}-${person.role}`"
                class="snap-start shrink-0 w-24 text-center"
              >
                <div class="w-16 h-16 mx-auto rounded-full overflow-hidden bg-surface-container-high shadow-sm">
                  <img
                    v-if="person.image"
                    :src="person.image"
                    :alt="person.name"
                    class="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div v-else class="flex w-full h-full items-center justify-center bg-surface-variant">
                    <span class="material-symbols-outlined text-xl text-on-surface-variant">construction</span>
                  </div>
                </div>
                <p class="mt-1.5 text-caption-xs font-medium text-on-surface leading-tight line-clamp-2">{{ person.name }}</p>
                <p class="text-[10px] text-on-surface-variant/60 leading-tight line-clamp-1">{{ person.role }}</p>
              </div>
            </div>
          </div>

          <!-- History Timeline -->
          <div v-if="history.length > 0">
            <h3 class="mb-unit flex items-center gap-2 text-title-sm text-on-surface">
              <span class="h-4 w-1 rounded-full bg-primary" />
              观看历史
            </h3>
            <div class="glass-card relative flex flex-col gap-4 rounded-lg p-stack-md shadow-sm">
              <div class="absolute bottom-6 left-[31px] top-6 w-px bg-outline-variant/40" />
              <div v-for="item in history" :key="item.id" class="group relative z-10 flex items-start gap-4">
                <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-surface-container-lowest bg-primary-container transition-transform group-hover:scale-110">
                  <span class="material-symbols-outlined text-[16px] text-on-primary-container" style="font-variation-settings: 'FILL' 1;">play_circle</span>
                </div>
                <div class="flex flex-1 items-center justify-between rounded-lg bg-surface-container p-3 transition-colors hover:bg-surface-container-high">
                  <div class="flex flex-col">
                    <span class="text-[14px] font-medium text-on-surface">
                      <template v-if="episodeLabel(item)">{{ episodeLabel(item) }} · </template>
                      {{ formatDate(item.started_at) }}
                      <template v-if="item.completed_at"> → {{ formatDate(item.completed_at) }}</template>
                    </span>
                    <span v-if="item.notes" class="mt-1 text-caption-xs text-on-surface-variant">{{ item.notes }}</span>
                  </div>
                  <span v-if="item.rating !== null" class="text-label-sm font-medium text-primary">{{ item.rating }}/10</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- RIGHT COLUMN -->
        <aside class="lg:sticky lg:top-24 flex flex-col gap-stack-md">

          <!-- ====== 作品信息卡片 ====== -->
          <div class="acrylic overflow-hidden rounded-xl border border-white/60 shadow-lg">
            <div class="flex items-center justify-between border-b border-outline-variant/20 bg-surface-container-lowest/50 px-5 py-4">
              <h3 class="text-title-sm font-semibold text-on-surface">作品信息</h3>
              <span class="rounded px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider bg-secondary-container/30 text-on-secondary-container">
                {{ STATUS_LABELS[media.status] }}
              </span>
            </div>

            <div class="flex flex-col gap-stack-md p-5">
              <label class="flex flex-col gap-1">
                <span class="pl-1 text-label-sm text-on-surface-variant">标题</span>
                <input v-model="title" class="field-fluent" />
              </label>

              <div class="grid grid-cols-2 gap-3">
                <label class="flex flex-col gap-1">
                  <span class="pl-1 text-label-sm text-on-surface-variant">类型</span>
                  <AppSelect v-model="editType" :options="editTypeOptions" variant="fluent" />
                </label>
                <label class="flex flex-col gap-1">
                  <span class="pl-1 text-label-sm text-on-surface-variant">状态</span>
                  <AppSelect v-model="status" :options="statusOptions" variant="fluent" />
                </label>
              </div>

              <label class="flex flex-col gap-1">
                <span class="pl-1 text-label-sm text-on-surface-variant">个人评分</span>
                <div class="flex flex-wrap items-center gap-0 rounded-md border-b-2 border-transparent bg-surface-container-low p-2 transition-colors hover:border-outline/30">
                  <template v-for="i in 10" :key="i">
                    <span
                      class="material-symbols-outlined cursor-pointer text-[22px] leading-none transition-colors"
                      :class="rating && i <= (rating ?? 0) ? 'star-filled' : 'star-empty'"
                      @click="rating = i"
                    >star</span>
                  </template>
                  <span class="ml-2 text-[16px] font-bold text-on-surface">{{ rating ?? 0 }}/10</span>
                </div>
              </label>

              <label class="flex flex-col gap-1">
                <span class="pl-1 text-label-sm text-on-surface-variant">标签</span>
                <input v-model="tagsText" class="field-fluent" placeholder="用逗号分隔，如 科幻, 冒险" />
              </label>

              <button class="text-caption-xs text-primary hover:underline text-left" type="button" @click="showMore = !showMore">
                {{ showMore ? '收起更多选项 ▲' : '展开更多选项 ▼' }}
              </button>

              <template v-if="showMore">
                <div class="grid grid-cols-2 gap-3">
                  <label class="flex flex-col gap-1">
                    <span class="pl-1 text-label-sm text-on-surface-variant">上线日期</span>
                    <input v-model="editAirDate" class="field-fluent" type="date" />
                  </label>
                  <label class="flex flex-col gap-1">
                    <span class="pl-1 text-label-sm text-on-surface-variant">总集数</span>
                    <input v-model.number="editTotalEp" class="field-fluent" type="number" min="0" />
                  </label>
                </div>
                <label class="flex flex-col gap-1">
                  <span class="pl-1 text-label-sm text-on-surface-variant">制作/开发</span>
                  <input v-model="editStudio" class="field-fluent" placeholder="制作公司" />
                </label>
                <label class="flex flex-col gap-1">
                  <span class="pl-1 text-label-sm text-on-surface-variant">外部评分</span>
                  <input v-model.number="editExternalRating" class="field-fluent" type="number" min="0" max="10" step="0.1" placeholder="Bangumi 评分" />
                </label>
                <label class="flex flex-col gap-1">
                  <span class="pl-1 text-label-sm text-on-surface-variant">封面 URL</span>
                  <input v-model="editCoverUrl" class="field-fluent" placeholder="https://..." />
                </label>
                <label class="flex flex-col gap-1">
                  <span class="pl-1 text-label-sm text-on-surface-variant">简介</span>
                  <textarea v-model="editDescription" class="field-fluent resize-none" placeholder="作品简介..." rows="3" />
                </label>
              </template>

              <label class="flex flex-col gap-1">
                <span class="pl-1 text-label-sm text-on-surface-variant">笔记</span>
                <textarea v-model="notes" class="field-fluent resize-none" placeholder="记录你的想法..." rows="2" />
              </label>
            </div>

            <div class="flex gap-3 p-5 pt-0 mt-2">
              <button class="btn-secondary flex-1" type="button" @click="loadDetail">重置</button>
              <button class="btn-primary flex-[2]" type="button" :disabled="saving" @click="saveDetail">
                {{ saving ? '保存中...' : '保存修改' }}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </template>
  </div>
</template>
