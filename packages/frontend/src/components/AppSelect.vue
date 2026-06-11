<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

export interface SelectOption {
  value: string
  label: string
}

const props = withDefaults(defineProps<{
  modelValue: string
  options: SelectOption[]
  placeholder?: string
  variant?: 'field' | 'fluent' | 'minimal'
}>(), {
  placeholder: '请选择',
  variant: 'field',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  change: []
}>()

const open = ref(false)
const buttonRef = ref<HTMLButtonElement | null>(null)
const panelRef = ref<HTMLDivElement | null>(null)

const selectedLabel = computed(() => {
  const opt = props.options.find((o) => o.value === props.modelValue)
  return opt ? opt.label : (props.modelValue || props.placeholder)
})

const hasValue = computed(() => props.options.some((o) => o.value === props.modelValue))

function toggle() {
  open.value = !open.value
}

function select(value: string) {
  emit('update:modelValue', value)
  open.value = false
  emit('change')
}

function onMousedown(e: MouseEvent) {
  if (
    open.value &&
    panelRef.value &&
    buttonRef.value &&
    !panelRef.value.contains(e.target as Node) &&
    !buttonRef.value.contains(e.target as Node)
  ) {
    open.value = false
  }
}

function onScroll() {
  open.value = false
}

onMounted(() => {
  document.addEventListener('mousedown', onMousedown)
  document.addEventListener('scroll', onScroll, { passive: true, capture: true })
})

onUnmounted(() => {
  document.removeEventListener('mousedown', onMousedown)
  document.removeEventListener('scroll', onScroll, { capture: true })
})
</script>

<template>
  <div class="app-select" :class="[`variant-${variant}`, { open }]">
    <button
      ref="buttonRef"
      type="button"
      class="app-select-trigger"
      :class="{ 'has-value': hasValue }"
      @click="toggle"
    >
      <span class="app-select-label">{{ selectedLabel }}</span>
      <span class="material-symbols-outlined app-select-arrow">expand_more</span>
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        ref="panelRef"
        class="app-select-panel"
        :style="{
          top: buttonRef ? buttonRef.getBoundingClientRect().bottom + 4 + 'px' : '0',
          left: buttonRef ? buttonRef.getBoundingClientRect().left + 'px' : '0',
          minWidth: buttonRef ? buttonRef.offsetWidth + 'px' : 'auto',
        }"
      >
        <button
          v-for="opt in options"
          :key="opt.value"
          type="button"
          class="app-select-option"
          :class="{ selected: opt.value === modelValue }"
          @click="select(opt.value)"
        >
          {{ opt.label }}
        </button>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.app-select {
  position: relative;
  width: 100%;
}

.app-select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  width: 100%;
  cursor: pointer;
  text-align: left;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.app-select-trigger:focus-visible {
  box-shadow: 0 0 0 1px #005faa;
}

/* ── variant: field ── */
.variant-field .app-select-trigger {
  border-radius: 0.75rem;
  border: 1px solid #c0c7d4;
  background-color: #f3f3f3;
  padding: 0.5rem 0.75rem;
  font-size: 16px;
  color: #c0c7d4;
}
.variant-field .app-select-trigger.has-value {
  color: #1a1c1c;
}
.variant-field .app-select-trigger:focus {
  border-color: #005faa;
  box-shadow: 0 0 0 1px #005faa;
}
.dark .variant-field .app-select-trigger {
  border-color: #404040;
  background-color: #262626;
  color: #737373;
}
.dark .variant-field .app-select-trigger.has-value {
  color: #f5f5f5;
}
.dark .variant-field .app-select-trigger:focus {
  border-color: #d3e3ff;
  box-shadow: 0 0 0 1px #d3e3ff;
}

/* ── variant: fluent ── */
.variant-fluent .app-select-trigger {
  border-radius: 0.5rem 0.5rem 0 0;
  border: 0;
  border-bottom: 2px solid #c0c7d4;
  background-color: rgba(243, 243, 243, 0.4);
  padding: 0.625rem 0.75rem;
  font-size: 16px;
  color: #c0c7d4;
}
.variant-fluent .app-select-trigger.has-value {
  color: #1a1c1c;
}
.variant-fluent .app-select-trigger:focus {
  border-bottom-color: #005faa;
  background-color: rgba(238, 238, 238, 0.8);
}
.dark .variant-fluent .app-select-trigger {
  border-color: #404040;
  background-color: rgba(38, 38, 38, 0.4);
  color: #737373;
}
.dark .variant-fluent .app-select-trigger.has-value {
  color: #f5f5f5;
}
.dark .variant-fluent .app-select-trigger:focus {
  border-bottom-color: #d3e3ff;
  background-color: rgba(38, 38, 38, 0.8);
}

/* ── variant: minimal ── */
.variant-minimal .app-select-trigger {
  background: transparent;
  font-size: 20px;
  font-weight: 600;
  color: #1a1c1c;
  padding: 4px 24px 4px 0;
  border: none;
}
.variant-minimal .app-select-trigger.has-value {
  color: #1a1c1c;
}
.dark .variant-minimal .app-select-trigger {
  color: #e0e0e0;
}

/* ── arrow icon ── */
.app-select-arrow {
  font-size: 20px;
  color: #c0c7d4;
  transition: transform 0.2s ease;
  pointer-events: none;
}
.app-select[open] .app-select-arrow {
  transform: rotate(180deg);
}
.variant-minimal .app-select-arrow {
  color: #404752;
}
.dark .variant-minimal .app-select-arrow {
  color: #a0a0a0;
}

/* ── panel ── */
.app-select-panel {
  position: fixed;
  z-index: 99999;
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 0.75rem;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0, 0, 0, 0.06);
  padding: 4px;
  max-height: 260px;
  overflow-y: auto;
}
.dark .app-select-panel {
  background: #2a2a2a;
  border: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

.app-select-option {
  display: block;
  width: 100%;
  padding: 8px 12px;
  border-radius: 0.5rem;
  font-size: 14px;
  color: #1a1c1c;
  cursor: pointer;
  outline: none;
  transition: background 0.12s ease;
  border: none;
  background: none;
  text-align: left;
}
.app-select-option:hover {
  background: rgba(0, 0, 0, 0.04);
}
.app-select-option.selected {
  background: rgba(0, 120, 212, 0.08);
  color: #005faa;
  font-weight: 500;
}
.dark .app-select-option {
  color: #e0e0e0;
}
.dark .app-select-option:hover {
  background: rgba(255, 255, 255, 0.06);
}
.dark .app-select-option.selected {
  background: rgba(211, 227, 255, 0.12);
  color: #a3c9ff;
}

/* ── scrollbar ── */
.app-select-panel::-webkit-scrollbar { width: 4px; }
.app-select-panel::-webkit-scrollbar-thumb { background: #c0c7d4; border-radius: 2px; }
.dark .app-select-panel::-webkit-scrollbar-thumb { background: #555; }
</style>
