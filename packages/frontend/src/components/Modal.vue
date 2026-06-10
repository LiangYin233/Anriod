<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const visible = ref(true)

function onConfirm() {
  visible.value = false
  emit('confirm')
}

function onCancel() {
  visible.value = false
  emit('cancel')
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="onCancel" />
      <!-- Dialog -->
      <div class="acrylic relative z-10 w-full max-w-sm rounded-2xl border border-white/40 p-6 shadow-xl">
        <h3 v-if="title" class="mb-2 text-title-sm font-semibold text-on-surface">{{ title }}</h3>
        <p class="text-body-md text-on-surface-variant">{{ message }}</p>
        <div class="mt-6 flex justify-end gap-3">
          <button v-if="cancelText" class="btn-secondary" type="button" @click="onCancel">{{ cancelText }}</button>
          <button
            class="btn-primary"
            :class="{ '!bg-error !text-on-error': danger }"
            type="button"
            @click="onConfirm"
          >
            {{ confirmText || '确定' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
