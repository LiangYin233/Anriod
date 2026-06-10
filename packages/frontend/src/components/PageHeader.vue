<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()

defineSlots<{
  actions?(): unknown
}>()
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-4">
    <div>
      <h1 class="text-headline-md text-on-surface mb-unit">{{ title }}</h1>
      <p v-if="description" class="text-body-md text-on-surface-variant">{{ description }}</p>
    </div>
    <div v-if="$slots.actions" class="flex items-center gap-2">
      <slot name="actions" />
    </div>
  </div>
</template>
