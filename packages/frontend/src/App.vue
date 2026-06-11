<script setup lang="ts">
import { computed, onMounted, onUnmounted, provide, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { useConfig } from '@/composables/useConfig'
import { useReveal } from '@/composables/useReveal'
import { useTauri } from '@/composables/useTauri'
import { TOAST_KEY, type ToastAPI } from '@/composables/useToast'
import Toast from '@/components/Toast.vue'

const route = useRoute()
const { toggleTheme, applyStoredTheme } = useConfig()
const { bind: bindReveal, unbind: unbindReveal } = useReveal()
const { isTauri, getVersion, minimizeWindow, toggleMaximize, closeWindow } = useTauri()
const sidebarCollapsed = ref(false)
const mobileDrawerOpen = ref(false)
const appVersion = ref('0.1.0')
const toastRef = ref<InstanceType<typeof Toast> | null>(null)

// Provide toast API to all descendants
const toast: ToastAPI = {
  success: (msg) => toastRef.value?.success(msg),
  error: (msg) => toastRef.value?.error(msg),
  info: (msg) => toastRef.value?.info(msg),
}
provide(TOAST_KEY, toast)

onMounted(async () => {
  applyStoredTheme()
  bindReveal()
  if (isTauri.value) {
    appVersion.value = await getVersion()
  }
})

onUnmounted(() => {
  unbindReveal()
})

// Close mobile drawer on route change
watch(() => route.path, () => {
  mobileDrawerOpen.value = false
})

function toggleSidebar() {
  // Mobile: toggle drawer. Desktop: toggle collapse.
  if (window.innerWidth < 1024) {
    mobileDrawerOpen.value = !mobileDrawerOpen.value
  } else {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }
}

const navItems = [
  { name: 'Home', label: '媒体库', path: '/', icon: 'video_library' },
  { name: 'Search', label: '搜索导入', path: '/search', icon: 'search_insights' },
  { name: 'History', label: '观看记录', path: '/history', icon: 'history' },
  { name: 'Statistics', label: '数据统计', path: '/statistics', icon: 'bar_chart' },
  { name: 'Settings', label: '系统设置', path: '/settings', icon: 'settings' },
]

const pageTitle = computed(() => navItems.find((item) => item.name === route.name)?.label ?? '观看记录')

const sidebarWidth = computed(() => sidebarCollapsed.value ? 'w-16' : 'w-64')
const mainPadding = computed(() => sidebarCollapsed.value ? 'lg:pl-16' : 'lg:pl-64')
</script>

<template>
  <div class="min-h-screen bg-background text-on-background antialiased" :class="{ 'tauri-app': isTauri }">

    <!-- Mobile backdrop -->
    <div
      v-if="mobileDrawerOpen"
      class="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden"
      @click="mobileDrawerOpen = false"
    />

    <!-- ============================================ -->
    <!-- SIDEBAR                                       -->
    <!-- ============================================ -->

    <!-- Desktop -->
    <aside
      class="fixed left-0 top-0 z-50 hidden h-screen flex-col p-3 lg:flex acrylic border-r border-black/5 dark:border-white/5 shadow-sm transition-all duration-200"
      :class="[sidebarWidth]"
    >
      <!-- Brand -->
      <div
        class="mb-6 mt-3 flex items-center gap-3 px-1"
        :class="sidebarCollapsed ? 'justify-center' : ''"
      >
        <img
          v-if="!sidebarCollapsed"
          src="/anriod.svg"
          alt="Anriod"
          class="sidebar-brand-img h-7 shrink-0"
        />
        <span
          v-else
          class="text-primary font-bold tracking-widest text-label-sm"
        >A</span>
      </div>

      <!-- Nav items -->
      <nav class="flex flex-1 flex-col gap-1">
        <RouterLink
          v-for="item in navItems"
          :key="item.name"
          :to="item.path"
          class="group flex items-center gap-3 rounded-lg px-3 py-2 font-medium transition-all duration-200 whitespace-nowrap overflow-hidden"
          :class="[
            sidebarCollapsed ? 'justify-center' : '',
            route.name === item.name
              ? 'bg-primary-container text-on-primary-container scale-[0.98]'
              : 'text-on-surface-variant hover:bg-surface-container-high'
          ]"
          :title="sidebarCollapsed ? item.label : ''"
        >
          <span
            class="material-symbols-outlined select-none shrink-0"
            :style="{ fontVariationSettings: route.name === item.name ? '\'FILL\' 1' : '\'FILL\' 0' }"
          >{{ item.icon }}</span>
          <span v-if="!sidebarCollapsed">{{ item.label }}</span>
        </RouterLink>
      </nav>

      <!-- Footer -->
      <div v-if="!sidebarCollapsed" class="mt-auto space-y-3">
        <button class="btn-secondary w-full" type="button" @click="toggleTheme">
          <span class="material-symbols-outlined text-[18px]">dark_mode</span>
          切换主题
        </button>
        <p class="text-center text-caption-xs text-on-surface-variant">Anriod v{{ appVersion }}</p>
      </div>
      <div v-else class="mt-auto flex flex-col items-center gap-3">
        <button class="btn-icon" type="button" @click="toggleTheme" title="切换主题">
          <span class="material-symbols-outlined">dark_mode</span>
        </button>
      </div>
    </aside>

    <!-- Mobile drawer -->
    <aside
      v-if="mobileDrawerOpen"
      class="fixed left-0 top-0 z-50 flex h-screen w-64 flex-col p-4 acrylic border-r border-black/5 dark:border-white/5 shadow-xl lg:hidden"
    >
      <div class="mb-6 mt-2 px-2">
        <h1 class="text-display-lg tracking-widest text-primary">ANRIOD</h1>
      </div>
      <nav class="flex flex-1 flex-col gap-1">
        <RouterLink
          v-for="item in navItems"
          :key="item.name"
          :to="item.path"
          class="flex items-center gap-3 rounded-lg px-4 py-2 font-medium transition-all duration-200"
          :class="route.name === item.name
            ? 'bg-primary-container text-on-primary-container scale-[0.98]'
            : 'text-on-surface-variant hover:bg-surface-container-high'"
        >
          <span
            class="material-symbols-outlined select-none"
            :style="{ fontVariationSettings: route.name === item.name ? '\'FILL\' 1' : '\'FILL\' 0' }"
          >{{ item.icon }}</span>
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>
      <div class="mt-auto space-y-3">
        <button class="btn-secondary w-full" type="button" @click="toggleTheme">
          <span class="material-symbols-outlined text-[18px]">dark_mode</span>
          切换主题
        </button>
      </div>
    </aside>

    <!-- ============================================ -->
    <!-- MAIN AREA                                    -->
    <!-- ============================================ -->
    <div :class="mainPadding" class="transition-all duration-200">
      <!-- Top App Bar (also serves as Tauri drag region) -->
      <header
        class="sticky top-0 z-40 border-b border-black/5 dark:border-white/5 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-lg"
        :data-tauri-drag-region="isTauri ? '' : undefined"
      >
        <div class="flex h-16 items-center justify-between px-container-padding lg:px-8">
          <div class="flex items-center gap-4">
            <!-- Sidebar toggle (always visible) -->
            <button class="btn-icon" type="button" @click="toggleSidebar" title="展开/收起侧边栏">
              <span class="material-symbols-outlined">menu</span>
            </button>
            <div>
              <h2 class="text-title-sm font-semibold">{{ pageTitle }}</h2>
            </div>
          </div>

          <!-- Right actions -->
          <div class="flex items-center gap-1">
            <button class="btn-icon" type="button" @click="toggleTheme" title="切换深浅色主题">
              <span class="material-symbols-outlined">dark_mode</span>
            </button>
            <div class="hidden h-8 w-8 items-center justify-center rounded-full bg-primary-container text-on-primary-container text-label-sm font-bold lg:flex">
              A
            </div>
            <!-- Window controls (Tauri only) — right of avatar -->
            <template v-if="isTauri">
              <div class="mx-1 h-5 w-px bg-outline-variant/40" />
              <button class="titlebar-btn-win" type="button" title="最小化" @click="minimizeWindow">
                <svg width="10" height="10" viewBox="0 0 12 12"><rect x="1" y="5.5" width="10" height="1" fill="currentColor"/></svg>
              </button>
              <button class="titlebar-btn-win" type="button" title="最大化" @click="toggleMaximize">
                <svg width="10" height="10" viewBox="0 0 12 12"><rect x="1.5" y="1.5" width="9" height="9" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>
              </button>
              <button class="titlebar-btn-win titlebar-btn-close" type="button" title="关闭" @click="closeWindow">
                <svg width="10" height="10" viewBox="0 0 12 12"><path d="M1 1L11 11M11 1L1 11" stroke="currentColor" stroke-width="1.2"/></svg>
              </button>
            </template>
          </div>
        </div>
      </header>

      <!-- Page Content -->
      <main class="px-container-padding py-6 lg:px-8">
        <RouterView />
      </main>
    </div>
    <Toast ref="toastRef" />
  </div>
</template>
