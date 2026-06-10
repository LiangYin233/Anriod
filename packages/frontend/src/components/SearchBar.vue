<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  modelValue: string
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  search: [value: string]
}>()

const localValue = ref(props.modelValue)

watch(
  () => props.modelValue,
  (value) => {
    localValue.value = value
  }
)

function submit() {
  emit('update:modelValue', localValue.value)
  emit('search', localValue.value)
}
</script>

<template>
  <form class="flex w-full items-stretch" @submit.prevent="submit">
    <input
      v-model="localValue"
      class="field-fluent flex-1 min-w-0"
      :placeholder="placeholder || '搜索...'"
      @input="emit('update:modelValue', localValue)"
    />
    <button
      class="flex items-center justify-center rounded-r-lg bg-primary-container px-4 text-on-primary-container hover:opacity-90 transition-opacity"
      type="submit"
    >
      <span class="material-symbols-outlined text-[20px]">search</span>
    </button>
  </form>
</template>
