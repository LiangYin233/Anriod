<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { RouterLink } from 'vue-router'
import type { Media, Status } from '@anriod/shared'
import { MEDIA_TYPES, STATUS_LABELS } from '@anriod/shared'
import { getCoverSrc } from '@/utils/cover'

const props = defineProps<{ media: Media }>()

const emit = defineEmits<{
  increment: [media: Media]
  setProgress: [media: Media, episode: number]
  status: [media: Media, status: Status]
}>()

const editing = ref(false)
const editValue = ref(0)
const editInput = ref<HTMLInputElement | null>(null)

const coverSrc = computed(() => getCoverSrc(props.media.cover_url))

const currentEp = computed(() => {
  const p = props.media.current_progress
  if (!p) return 0
  return p.episode ?? p.chapter ?? p.hours_played ?? 0
})

const totalEp = computed(() => props.media.total_episodes ?? 0)

const progressPercent = computed(() => {
  const p = props.media.current_progress
  if (!p) return 0
  if (props.media.type === 'movie') return p.watched ? 100 : 0
  if (totalEp.value <= 0) return 0
  return Math.min(100, Math.round((currentEp.value / totalEp.value) * 100))
})

const progressLabel = computed(() => {
  if (props.media.status === 'plan_to_watch') return ''
  const p = props.media.current_progress
  if (!p) return ''
  if (props.media.type === 'game') return `${p.hours_played ?? 0}h`
  if (props.media.type === 'movie') return p.watched ? '已看' : ''
  if (currentEp.value === 0) return ''
  return totalEp.value ? `${currentEp.value}/${totalEp.value}` : `${currentEp.value}`
})

const isSeries = computed(() =>
  ['anime', 'tv', 'novel', 'manga'].includes(props.media.type) && totalEp.value > 0
)

function startEdit() {
  if (!isSeries.value) {
    emit('increment', props.media)
    return
  }
  editValue.value = currentEp.value + 1
  editing.value = true
  nextTick(() => editInput.value?.focus())
}

function confirmEdit() {
  editing.value = false
  const ep = Math.max(0, Math.min(totalEp.value, editValue.value))
  if (ep !== currentEp.value) {
    emit('setProgress', props.media, ep)
  }
}

function cancelEdit() {
  editing.value = false
}
</script>

<template>
  <article class="glass-card rounded-lg overflow-hidden group cursor-pointer reveal-hover transition-all duration-300 hover:-translate-y-1 hover:shadow-lg flex flex-col">
    <!-- Poster -->
    <RouterLink :to="`/media/${media.id}`" class="cover-wrapper relative w-full aspect-poster bg-surface-variant block overflow-hidden">
      <img
        v-if="coverSrc"
        :src="coverSrc"
        :alt="media.title"
        class="cover-img h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        loading="lazy"
      />
      <div v-else class="flex h-full w-full items-center justify-center">
        <span class="material-symbols-outlined text-4xl text-on-surface-variant">movie</span>
      </div>

      <span class="absolute left-2 top-2 rounded-full bg-surface/80 backdrop-blur-md border border-white/20 px-2 py-1 text-caption-xs text-on-surface shadow-sm">
        {{ STATUS_LABELS[media.status] }}
      </span>
    </RouterLink>

    <!-- Progress bar (always present for consistent card height) -->
    <div class="h-1 w-full bg-surface-variant/50">
      <div
        v-if="progressPercent > 0"
        class="h-full transition-all"
        :class="progressPercent >= 100 ? 'bg-emerald-400' : 'bg-primary'"
        :style="{ width: `${progressPercent}%` }"
      />
    </div>

    <!-- Info (min-h ensures consistent card height with/without rating) -->
    <div class="flex flex-1 flex-col p-3 min-h-[92px]">
      <RouterLink :to="`/media/${media.id}`" class="truncate font-semibold text-on-surface hover:text-primary transition-colors">
        {{ media.title }}
      </RouterLink>
      <p class="mt-1 text-caption-xs text-on-surface-variant">
        {{ MEDIA_TYPES[media.type] }}
        <template v-if="media.air_date"> · {{ media.air_date }}</template>
        <span v-if="media.rating" class="ml-1 inline-flex items-center gap-px align-middle">
          <span class="material-symbols-outlined text-[12px] text-amber-500" style="font-variation-settings: 'FILL' 1;">star</span>
          <span class="text-caption-xs text-amber-600 font-medium">{{ media.rating }}</span>
        </span>
      </p>

      <div class="mt-auto flex items-center justify-between pt-3">
        <!-- Progress: editable for series, simple +1 for movies/games -->
        <template v-if="isSeries">
          <div v-if="editing" class="flex items-center gap-1">
            <input
              ref="editInput"
              v-model.number="editValue"
              class="w-12 rounded border border-outline-variant bg-surface-container-lowest px-1 py-0.5 text-center text-label-sm text-on-surface outline-none focus:border-primary"
              type="number"
              :min="0"
              :max="totalEp"
              @keydown.enter="confirmEdit"
              @keydown.escape="cancelEdit"
              @blur="confirmEdit"
            />
            <span class="text-caption-xs text-on-surface-variant">/ {{ totalEp }}</span>
          </div>
          <button
            v-else
            class="text-label-sm font-medium hover:underline cursor-pointer"
            :class="progressLabel ? 'text-primary' : 'text-on-surface-variant'"
            @click="startEdit"
          >
            {{ progressLabel || (media.status === 'plan_to_watch' ? '' : '开始') }}
          </button>
        </template>
        <button
          v-else
          class="text-label-sm font-medium hover:underline cursor-pointer"
          :class="progressLabel ? 'text-primary' : 'text-on-surface-variant'"
          @click="startEdit"
        >
          {{ progressLabel || '—' }}
        </button>
      </div>
    </div>
  </article>
</template>
