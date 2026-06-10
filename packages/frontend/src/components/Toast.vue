<script setup lang="ts">
import { ref } from 'vue'

export interface ToastOptions {
  message: string
  type?: 'success' | 'error' | 'info'
  duration?: number
}

const toasts = ref<Array<ToastOptions & { id: number; leaving: boolean }>>([])
let nextId = 0

function show(opts: ToastOptions) {
  const id = nextId++
  toasts.value.push({ ...opts, id, leaving: false })
  const duration = opts.duration ?? 3000
  setTimeout(() => {
    const t = toasts.value.find((t) => t.id === id)
    if (t) t.leaving = true
    setTimeout(() => {
      toasts.value = toasts.value.filter((t) => t.id !== id)
    }, 300)
  }, duration)
}

function success(message: string) { show({ message, type: 'success' }) }
function error(message: string) { show({ message, type: 'error', duration: 5000 }) }
function info(message: string) { show({ message, type: 'info' }) }

defineExpose({ show, success, error, info })
</script>

<template>
  <Teleport to="body">
    <div class="fixed bottom-6 left-1/2 z-[110] flex -translate-x-1/2 flex-col items-center gap-2 pointer-events-none">
      <div
        v-for="t in toasts"
        :key="t.id"
        class="pointer-events-auto rounded-xl px-5 py-3 text-label-sm font-medium shadow-lg backdrop-blur-md transition-all duration-300 border"
        :class="[
          t.leaving ? 'opacity-0 translate-y-2' : 'opacity-100',
          t.type === 'success' ? 'bg-emerald-50/90 text-emerald-700 border-emerald-200 dark:bg-emerald-950/90 dark:text-emerald-300 dark:border-emerald-800' :
          t.type === 'error' ? 'bg-red-50/90 text-red-700 border-red-200 dark:bg-red-950/90 dark:text-red-300 dark:border-red-800' :
          'bg-white/90 text-on-surface border-outline-variant/30 dark:bg-neutral-800/90 dark:text-neutral-100'
        ]"
      >
        <span class="material-symbols-outlined text-[16px] mr-2 align-middle leading-none">
          {{ t.type === 'success' ? 'check_circle' : t.type === 'error' ? 'error' : 'info' }}
        </span>
        {{ t.message }}
      </div>
    </div>
  </Teleport>
</template>
