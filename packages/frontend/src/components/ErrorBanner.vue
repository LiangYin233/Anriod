<script setup lang="ts">
defineProps<{
  message: string
}>()
</script>

<template>
  <div class="rounded-xl border border-error-container bg-error-container p-4 text-body-md text-on-error-container">
    <span class="material-symbols-outlined mr-2 align-middle text-[20px]">error</span>
    {{ message }}
  </div>
</template>
