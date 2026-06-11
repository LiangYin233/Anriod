<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { Tag } from '@anriod/shared'
import PageHeader from '@/components/PageHeader.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import ErrorBanner from '@/components/ErrorBanner.vue'
import Modal from '@/components/Modal.vue'
import { useToast } from '@/composables/useToast'
import { api } from '@/utils/api'

const tags = ref<Tag[]>([])
const loading = ref(false)
const error = ref('')
const toast = useToast()

const deleteTarget = ref<{ id: number; name: string } | null>(null)
const modalVisible = ref(false)

async function loadTags() {
  loading.value = true
  error.value = ''
  try {
    tags.value = await api.listTags()
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '加载标签失败'
  } finally {
    loading.value = false
  }
}

function confirmDelete(tag: Tag) {
  deleteTarget.value = { id: tag.id, name: tag.name }
  modalVisible.value = true
}

async function handleDelete() {
  if (!deleteTarget.value) return
  const id = deleteTarget.value.id
  modalVisible.value = false
  try {
    await api.deleteTag(id)
    tags.value = tags.value.filter((t) => t.id !== id)
    toast.success(`已删除标签「${deleteTarget.value.name}」`)
  } catch (caught) {
    toast.error('删除失败: ' + (caught instanceof Error ? caught.message : String(caught)))
  }
  deleteTarget.value = null
}

onMounted(loadTags)
</script>

<template>
  <div class="section-gap">
    <PageHeader title="标签管理" description="查看和管理所有媒体标签。">
      <template #actions>
        <button class="btn-ghost" type="button" @click="loadTags">
          <span class="material-symbols-outlined text-[18px]">refresh</span>
        </button>
      </template>
    </PageHeader>

    <ErrorBanner v-if="error" :message="error" />
    <LoadingSpinner v-if="loading" message="加载标签..." />

    <EmptyState
      v-else-if="tags.length === 0"
      icon="label_off"
      title="暂无标签"
      description="给媒体添加标签后，它们会出现在这里。"
    />

    <div v-else class="max-w-2xl mx-auto">
      <div class="grid gap-2">
        <div
          v-for="tag in tags"
          :key="tag.id"
          class="acrylic group flex items-center justify-between rounded-xl px-5 py-4 shadow-sm border border-black/5 dark:border-white/5"
        >
          <div class="flex items-center gap-4">
            <span class="material-symbols-outlined text-outline-variant">label</span>
            <div>
              <span class="text-body-md font-medium text-on-surface">{{ tag.name }}</span>
              <p class="text-caption-xs text-on-surface-variant mt-0.5">
                创建于 {{ new Date(tag.created_at).toLocaleDateString('zh-CN') }}
              </p>
            </div>
          </div>
          <button
            class="btn-icon text-on-surface-variant hover:text-error"
            type="button"
            title="删除标签"
            @click="confirmDelete(tag)"
          >
            <span class="material-symbols-outlined text-[20px]">delete</span>
          </button>
        </div>
      </div>
      <p class="mt-4 text-center text-caption-xs text-on-surface-variant">
        共 {{ tags.length }} 个标签
      </p>
    </div>
  </div>

  <Modal
    v-if="modalVisible && deleteTarget"
    title="确认删除"
    :message="`确定删除标签「${deleteTarget.name}」吗？`"
    confirm-text="删除"
    cancel-text="取消"
    danger
    @confirm="handleDelete"
    @cancel="modalVisible = false"
  />
</template>
