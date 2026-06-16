<script setup lang="ts">
import type { CreditPerson } from '@anriod/shared'

defineProps<{
  cast: CreditPerson[]
  crew: CreditPerson[]
}>()
</script>

<template>
  <div v-if="cast.length > 0">
    <h3 class="mb-unit flex items-center gap-2 text-title-sm text-on-surface">
      <span class="h-4 w-1 rounded-full bg-primary" />
      声优 / 演员
    </h3>
    <div class="flex gap-4 overflow-x-auto pb-2 -mx-2 px-2 snap-x snap-mandatory scrollbar-thin">
      <div
        v-for="person in cast.slice(0, 15)"
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

  <div v-if="crew.length > 0">
    <h3 class="mb-unit flex items-center gap-2 text-title-sm text-on-surface">
      <span class="h-4 w-1 rounded-full bg-primary" />
      制作人员
    </h3>
    <div class="flex gap-4 overflow-x-auto pb-2 -mx-2 px-2 snap-x snap-mandatory scrollbar-thin">
      <div
        v-for="person in crew.slice(0, 15)"
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
</template>
