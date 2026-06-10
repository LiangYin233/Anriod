<script setup lang="ts">
defineProps<{
  message?: string
}>()
</script>

<template>
  <div class="glass-card rounded-xl p-12 text-center text-on-surface-variant">
    <span class="material-symbols-outlined text-4xl animate-spin">progress_activity</span>
    <p class="mt-3 text-body-md">{{ message || '加载中...' }}</p>
  </div>
</template>
