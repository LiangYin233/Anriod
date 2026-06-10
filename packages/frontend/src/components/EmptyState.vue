<script setup lang="ts">
defineProps<{
  icon?: string
  title?: string
  description?: string
}>()

defineSlots<{
  default?(): unknown
}>()
</script>

<template>
  <div class="glass-card rounded-xl p-12 text-center">
    <span class="material-symbols-outlined text-5xl text-on-surface-variant">{{ icon || 'inventory_2' }}</span>
    <h3 class="mt-4 text-title-sm font-semibold">{{ title || '暂无数据' }}</h3>
    <p class="mt-2 text-body-md text-on-surface-variant">{{ description || '这里还没有内容。' }}</p>
    <div v-if="$slots.default" class="mt-4">
      <slot />
    </div>
  </div>
</template>
