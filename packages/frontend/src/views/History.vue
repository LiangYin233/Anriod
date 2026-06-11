<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { WatchHistory } from '@anriod/shared'
import PageHeader from '@/components/PageHeader.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import EmptyState from '@/components/EmptyState.vue'
import ErrorBanner from '@/components/ErrorBanner.vue'
import { api } from '@/utils/api'
import { formatDate } from '@/utils/format'
import { useToast } from '@/composables/useToast'

const history = ref<WatchHistory[]>([])
const loading = ref(false)
const error = ref('')
const toast = useToast()

async function loadHistory() {
  loading.value = true
  error.value = ''
  try {
    history.value = (await api.listHistory({ page: 1, limit: 500 })).data
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '加载历史失败'
  } finally {
    loading.value = false
  }
}

function episodeLabel(h: WatchHistory): string {
  const from = h.progress_from?.episode
  const to = h.progress_to?.episode
  if (to && to > 0) {
    return from && from > 0 && from !== to ? `EP${from} → EP${to}` : `EP${to}`
  }
  return ''
}

async function deleteEntry(id: number) {
  try {
    await api.deleteHistory(id)
    history.value = history.value.filter((h) => h.id !== id)
    toast.success('已删除记录')
  } catch (caught) {
    toast.error('删除失败: ' + (caught instanceof Error ? caught.message : String(caught)))
  }
}

// Group by YYYY-MM
const months = computed(() => {
  const map = new Map<string, WatchHistory[]>()
  for (const item of history.value) {
    const d = new Date(item.started_at)
    if (isNaN(d.getTime())) continue
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(item)
  }
  return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]))
})

function monthLabel(key: string): string {
  const [y, m] = key.split('-')
  return `${y}年${parseInt(m)}月`
}

onMounted(loadHistory)
</script>

<template>
  <div class="section-gap">
    <PageHeader title="观看记录" description="每集观看时间线">
      <template #actions>
        <button class="btn-ghost" type="button" @click="loadHistory">
          <span class="material-symbols-outlined text-[18px]">refresh</span>
        </button>
      </template>
    </PageHeader>

    <ErrorBanner v-if="error" :message="error" />
    <LoadingSpinner v-if="loading" />

    <EmptyState
      v-else-if="history.length === 0"
      icon="history"
      title="暂无记录"
      description="开始标记观看进度，记录将出现在这里。"
    />

    <div v-else class="max-w-2xl mx-auto">
      <template v-for="[key, items] in months" :key="key">
        <!-- Month sticky header -->
        <div class="sticky top-16 z-10 -mx-2 px-2 py-2 mb-3 bg-background/80 backdrop-blur-sm border-b border-outline-variant/20">
          <span class="text-label-sm font-semibold text-on-surface-variant tracking-wider">{{ monthLabel(key) }}</span>
          <span class="ml-2 text-caption-xs text-on-surface-variant">{{ items.length }} 条</span>
        </div>

        <!-- Cards -->
        <div class="space-y-2 mb-6">
          <div
            v-for="item in items"
            :key="item.id"
            class="glass-card rounded-lg px-4 py-3 transition-colors hover:bg-surface-container-low/50"
          >
            <!-- Date -->
            <span class="text-caption-xs text-on-surface-variant">{{ formatDate(item.started_at) }}</span>

            <!-- Title + episode inline -->
            <div class="flex items-baseline gap-2 mt-0.5">
              <RouterLink
                v-if="item.media_id"
                :to="`/media/${item.media_id}`"
                class="text-body-md font-semibold text-on-surface hover:text-primary transition-colors truncate"
              >
                {{ item.media_title || item.media_id }}
              </RouterLink>
              <span v-else class="text-body-md font-semibold text-on-surface truncate">
                {{ item.media_title || item.media_id }}
              </span>
              <span v-if="episodeLabel(item)" class="text-label-sm text-on-surface-variant shrink-0">{{ episodeLabel(item) }}</span>
              <div class="flex-1" />
              <button
                class="flex items-center gap-0.5 text-caption-xs text-on-surface-variant/40 hover:text-error transition-colors shrink-0"
                type="button"
                title="删除此记录"
                @click="deleteEntry(item.id)"
              >
                <span class="material-symbols-outlined text-[14px]">delete</span>
              </button>
            </div>

            <!-- Notes -->
            <p v-if="item.notes" class="mt-1.5 text-body-md text-on-surface-variant leading-relaxed">
              {{ item.notes }}
            </p>

            <!-- Rating -->
            <div v-if="item.rating !== null && item.rating > 0" class="mt-1.5 flex items-center gap-1">
              <template v-for="i in 5" :key="i">
                <span
                  class="material-symbols-outlined text-[14px]"
                  :class="i <= Math.round((item.rating ?? 0) / 2) ? 'star-filled' : 'star-empty'"
                >star</span>
              </template>
              <span class="ml-1 text-label-sm text-on-surface">{{ item.rating }}/10</span>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
