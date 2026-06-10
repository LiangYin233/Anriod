<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import type { StatisticsOverview, Status, TagStatistic, TimelinePoint } from '@anriod/shared'
import { STATUS_LABELS } from '@anriod/shared'
import { Chart, registerables } from 'chart.js'
import { api, apiRequest } from '@/utils/api'
import PageHeader from '@/components/PageHeader.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import ErrorBanner from '@/components/ErrorBanner.vue'

Chart.register(...registerables)

const overview = ref<StatisticsOverview | null>(null)
const timeline = ref<TimelinePoint[]>([])
const tagStats = ref<TagStatistic[]>([])
const ratingDist = ref<Array<{ rating: number; count: number }>>([])
const loading = ref(false)
const error = ref('')

// Chart instances for cleanup
let statusChart: Chart | null = null
let typeChart: Chart | null = null
let timelineChart: Chart | null = null
let ratingChart: Chart | null = null

const statusCanvas = ref<HTMLCanvasElement | null>(null)
const typeCanvas = ref<HTMLCanvasElement | null>(null)
const timelineCanvas = ref<HTMLCanvasElement | null>(null)
const ratingCanvas = ref<HTMLCanvasElement | null>(null)

const statusOrder = ['watching', 'completed', 'plan_to_watch', 'on_hold', 'dropped'] as Status[]

const statusColors: Record<Status, string> = {
  watching: '#0078d4',
  completed: '#10b981',
  plan_to_watch: '#f59e0b',
  on_hold: '#6b7280',
  dropped: '#ef4444',
}

const typeColors: Record<string, string> = {
  anime: '#0078d4',
  movie: '#ef4444',
  tv: '#10b981',
  game: '#f59e0b',
  novel: '#8b5cf6',
  manga: '#ec4899',
}

async function loadStatistics() {
  loading.value = true
  error.value = ''
  try {
    const [o, t, g, rd] = await Promise.all([
      api.overview(),
      api.timeline(),
      api.tagStats(),
      apiRequest<Array<{ rating: number; count: number }>>('/api/statistics/ratings')
    ])
    overview.value = o; timeline.value = t; tagStats.value = g; ratingDist.value = rd
    await nextTick()
    renderCharts()
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '加载统计失败'
  } finally {
    loading.value = false
  }
}

function nextTick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 50))
}

function renderCharts() {
  destroyCharts()
  if (!overview.value) return

  const isDark = document.documentElement.classList.contains('dark')
  const gridColor = isDark ? '#333' : '#e5e7eb'

  renderStatusChart(gridColor)
  renderTypeChart(gridColor)
  renderTimelineChart(gridColor)
  renderRatingChart(gridColor)
}

function renderStatusChart(gridColor: string) {
  if (!statusCanvas.value || !overview.value) return
  const labels = statusOrder.map((s) => STATUS_LABELS[s])
  const data = statusOrder.map((s) => overview.value!.by_status[s] ?? 0)
  const colors = statusOrder.map((s) => statusColors[s])

  statusChart = new Chart(statusCanvas.value, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors, borderWidth: 0 }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true, pointStyleWidth: 10, color: gridColor } },
      },
    },
  })
}

function renderTypeChart(gridColor: string) {
  if (!typeCanvas.value || !overview.value) return
  const entries = Object.entries(overview.value.by_type).filter(([, c]) => c > 0)
  const labels = entries.map(([t]) => t)
  const data = entries.map(([, c]) => c)
  const colors = entries.map(([t]) => typeColors[t] ?? '#6b7280')

  typeChart = new Chart(typeCanvas.value, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors, borderRadius: 6, borderWidth: 0 }],
    },
    options: {
      responsive: true,
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { stepSize: 1, color: gridColor }, grid: { color: gridColor } },
        y: { ticks: { color: gridColor }, grid: { display: false } },
      },
    },
  })
}

function renderTimelineChart(gridColor: string) {
  if (!timelineCanvas.value || timeline.value.length === 0) return
  const data = timeline.value.slice(-12)

  timelineChart = new Chart(timelineCanvas.value, {
    type: 'bar',
    data: {
      labels: data.map((p) => p.period),
      datasets: [{
        data: data.map((p) => p.count),
        backgroundColor: '#0078d4',
        borderRadius: 4,
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: gridColor }, grid: { display: false } },
        y: { ticks: { stepSize: 1, color: gridColor }, grid: { color: gridColor } },
      },
    },
  })
}

function renderRatingChart(gridColor: string) {
  if (!ratingCanvas.value || ratingDist.value.length === 0) return

  // Build full 1-10 bins
  const bins = new Array(10).fill(0)
  for (const { rating, count } of ratingDist.value) {
    const idx = Math.round(rating) - 1
    if (idx >= 0 && idx < 10) bins[idx] = count
  }

  ratingChart = new Chart(ratingCanvas.value, {
    type: 'bar',
    data: {
      labels: Array.from({ length: 10 }, (_, i) => `${i + 1}`),
      datasets: [{
        data: bins,
        backgroundColor: '#0078d4',
        borderRadius: 4,
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { title: { display: true, text: '评分', color: gridColor }, ticks: { color: gridColor }, grid: { display: false } },
        y: { ticks: { stepSize: 1, color: gridColor }, grid: { color: gridColor }, title: { display: true, text: '数量', color: gridColor } },
      },
    },
  })
}

function destroyCharts() {
  statusChart?.destroy()
  typeChart?.destroy()
  timelineChart?.destroy()
  ratingChart?.destroy()
}

onMounted(loadStatistics)
onUnmounted(destroyCharts)
</script>

<template>
  <div class="section-gap">
    <PageHeader title="统计看板" description="数据可视化分析">
      <template #actions>
        <button class="btn-ghost" type="button" @click="loadStatistics">
          <span class="material-symbols-outlined text-[18px]">refresh</span>
        </button>
      </template>
    </PageHeader>

    <ErrorBanner v-if="error" :message="error" />
    <LoadingSpinner v-if="loading" />

    <template v-if="overview">
      <!-- Metric cards -->
      <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div class="acrylic reveal-hover rounded-xl p-5 shadow-sm">
          <p class="mb-1 text-label-sm uppercase tracking-wider text-on-surface-variant">总收藏</p>
          <div class="text-display-lg text-primary">{{ overview.total }}</div>
        </div>
        <div class="acrylic reveal-hover rounded-xl p-5 shadow-sm">
          <p class="mb-1 text-label-sm uppercase tracking-wider text-on-surface-variant">已完成</p>
          <div class="text-display-lg text-emerald-500">{{ overview.completed }}</div>
          <p class="text-caption-xs text-on-surface-variant mt-1">完成率 {{ overview.total ? Math.round(overview.completed / overview.total * 100) : 0 }}%</p>
        </div>
        <div class="acrylic reveal-hover rounded-xl p-5 shadow-sm">
          <p class="mb-1 text-label-sm uppercase tracking-wider text-on-surface-variant">平均评分</p>
          <div class="text-display-lg text-amber-500">{{ overview.average_rating?.toFixed(2) ?? '-' }}</div>
          <p class="text-caption-xs text-on-surface-variant mt-1">{{ overview.rated_count }} 条评分</p>
        </div>
        <div class="acrylic reveal-hover rounded-xl p-5 shadow-sm">
          <p class="mb-1 text-label-sm uppercase tracking-wider text-on-surface-variant">评分标准差</p>
          <div class="text-display-lg text-secondary">{{ overview.rating_stddev?.toFixed(2) ?? '-' }}</div>
          <p class="text-caption-xs text-on-surface-variant mt-1">波动程度</p>
        </div>
      </div>

      <!-- Charts row 1 -->
      <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
        <!-- Status doughnut -->
        <div class="acrylic reveal-hover rounded-xl p-6 shadow-sm">
          <h3 class="mb-4 text-title-sm">状态分布</h3>
          <div class="max-w-xs mx-auto">
            <canvas ref="statusCanvas" />
          </div>
        </div>

        <!-- Type bar -->
        <div class="acrylic reveal-hover rounded-xl p-6 shadow-sm">
          <h3 class="mb-4 text-title-sm">类型分布</h3>
          <canvas ref="typeCanvas" height="200" />
        </div>
      </div>

      <!-- Charts row 2 -->
      <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
        <!-- Timeline -->
        <div class="acrylic reveal-hover rounded-xl p-6 shadow-sm">
          <h3 class="mb-4 text-title-sm">观看趋势</h3>
          <canvas v-if="timeline.length > 0" ref="timelineCanvas" height="200" />
          <p v-else class="text-body-md text-on-surface-variant py-8 text-center">暂无数据</p>
        </div>

        <!-- Rating distribution -->
        <div class="acrylic reveal-hover rounded-xl p-6 shadow-sm">
          <h3 class="mb-4 text-title-sm">评分分布</h3>
          <canvas v-if="ratingDist.length > 0" ref="ratingCanvas" height="200" />
          <p v-else class="text-body-md text-on-surface-variant py-8 text-center">暂无评分数据</p>
        </div>
      </div>

      <!-- Tag cloud -->
      <div v-if="tagStats.length > 0" class="acrylic reveal-hover rounded-xl p-6 shadow-sm">
        <h3 class="mb-4 text-title-sm">标签分布</h3>
        <div class="flex flex-wrap items-center justify-center gap-2 py-4">
          <span
            v-for="item in tagStats.slice(0, 30)"
            :key="item.tag"
            class="cursor-default rounded-full px-3 py-1 transition-all hover:scale-110"
            :style="{
              backgroundColor: `rgba(0,120,212,${0.06 + (item.count / Math.max(...tagStats.map(t=>t.count))) * 0.12})`,
              color: `rgba(0,95,170,${0.5 + (item.count / Math.max(...tagStats.map(t=>t.count))) * 0.5})`,
              fontSize: `${0.75 + (item.count / Math.max(...tagStats.map(t=>t.count))) * 0.6}rem`,
              fontWeight: `${400 + Math.round((item.count / Math.max(...tagStats.map(t=>t.count))) * 300)}`,
            }"
          >
            {{ item.tag }} {{ item.count }}
          </span>
        </div>
      </div>
    </template>
  </div>
</template>
