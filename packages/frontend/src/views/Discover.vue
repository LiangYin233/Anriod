<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { DiscoverSection } from '@anriod/shared'
import { MEDIA_TYPES } from '@anriod/shared'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import ErrorBanner from '@/components/ErrorBanner.vue'
import EmptyState from '@/components/EmptyState.vue'
import { api } from '@/utils/api'

const router = useRouter()
const sections = ref<DiscoverSection[]>([])
const loading = ref(false)
const error = ref('')

async function loadDiscover() {
  loading.value = true
  error.value = ''
  try {
    const data = await api.discover()
    sections.value = data.sections
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '加载发现页失败'
  } finally {
    loading.value = false
  }
}

function goToExplore(item: DiscoverSection['items'][number]) {
  router.push(`/explore?source=${item.source}&source_id=${item.source_id}&type=${item.media_type}`)
}

function sourceIcon(source: string): string {
  return source === 'bangumi' ? 'stadia_controller' : 'movie'
}

onMounted(loadDiscover)
</script>

<template>
  <div class="section-gap">
    <!-- Header -->
    <div class="flex items-center justify-between mb-2">
      <div>
        <h1 class="text-[28px] font-bold text-on-surface tracking-tight">发现</h1>
        <p class="text-body-md text-on-surface-variant mt-1">浏览热门作品和今日放送</p>
      </div>
      <button class="btn-ghost" type="button" @click="loadDiscover">
        <span class="material-symbols-outlined text-[18px]">refresh</span>
      </button>
    </div>

    <ErrorBanner v-if="error" :message="error" />
    <LoadingSpinner v-if="loading" message="加载发现内容..." />

    <EmptyState
      v-else-if="sections.length === 0 && !loading"
      icon="explore"
      title="暂无发现内容"
      description="请检查数据源配置是否已启用且正确。"
    >
      <RouterLink to="/settings" class="btn-primary">
        <span class="material-symbols-outlined text-[18px]">settings</span>
        前往设置
      </RouterLink>
    </EmptyState>

    <template v-else>
      <div v-for="section in sections" :key="`${section.source}-${section.label}`" class="mb-stack-lg">
        <!-- Section header -->
        <div class="flex items-center gap-2 mb-4">
          <span class="material-symbols-outlined text-[20px] text-primary">{{ sourceIcon(section.source) }}</span>
          <h2 class="text-title-sm font-semibold text-on-surface">{{ section.label }}</h2>
          <span class="text-caption-xs text-on-surface-variant">{{ section.items.length }} 部</span>
        </div>

        <!-- Horizontal scrollable row -->
        <div class="flex gap-4 overflow-x-auto pb-2 -mx-2 px-2 snap-x snap-mandatory scrollbar-thin">
          <div
            v-for="item in section.items"
            :key="`${item.source}-${item.source_id}`"
            class="snap-start shrink-0 w-36 cursor-pointer group transition-transform duration-200 hover:-translate-y-1"
            @click="goToExplore(item)"
          >
            <div class="cover-wrapper relative w-full aspect-poster overflow-hidden rounded-xl bg-surface-variant shadow-sm group-hover:shadow-md transition-shadow">
              <img
                v-if="item.cover_url"
                :src="item.cover_url"
                :alt="item.title"
                class="cover-img h-full w-full object-cover"
                loading="lazy"
              />
              <div v-else class="flex h-full w-full items-center justify-center">
                <span class="material-symbols-outlined text-3xl text-on-surface-variant">movie</span>
              </div>
              <!-- Rating badge -->
              <div
                v-if="item.external_rating"
                class="absolute top-1.5 right-1.5 flex items-center gap-0.5 rounded-full bg-black/50 backdrop-blur-sm px-1.5 py-0.5 text-[10px] text-white font-medium"
              >
                <span class="material-symbols-outlined text-[10px]" style="font-variation-settings:'FILL' 1">star</span>
                {{ item.external_rating }}
              </div>
            </div>

            <div class="mt-2 px-0.5">
              <p class="text-label-sm font-medium text-on-surface leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                {{ item.title }}
              </p>
              <div class="flex items-center gap-1.5 mt-1">
                <span class="text-caption-xs text-on-surface-variant/70 bg-surface-container-high px-1.5 py-0.5 rounded">
                  {{ MEDIA_TYPES[item.media_type] || item.media_type }}
                </span>
                <span v-if="item.year" class="text-caption-xs text-on-surface-variant/50">{{ item.year }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* ── Custom thin scrollbar for horizontal rows ── */
.scrollbar-thin::-webkit-scrollbar {
  height: 4px;
}
.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}
.scrollbar-thin::-webkit-scrollbar-thumb {
  background-color: rgba(192, 199, 212, 0.4);
  border-radius: 2px;
}
.dark .scrollbar-thin::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.15);
}
</style>
