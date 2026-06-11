<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { Tag } from '@anriod/shared'
import PageHeader from '@/components/PageHeader.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import ErrorBanner from '@/components/ErrorBanner.vue'
import EmptyState from '@/components/EmptyState.vue'
import Modal from '@/components/Modal.vue'
import { useToast } from '@/composables/useToast'
import { api } from '@/utils/api'

const router = useRouter()
const tags = ref<(Tag & { count: number })[]>([])
const loading = ref(false)
const error = ref('')
const toast = useToast()

const deleteTarget = ref<{ id: number; name: string } | null>(null)
const modalVisible = ref(false)

async function loadTags() {
  loading.value = true
  error.value = ''
  try {
    const [tagList, tagStats] = await Promise.all([
      api.listTags(),
      api.tagStats()
    ])
    const countMap = new Map(tagStats.map((s) => [s.tag, s.count]))
    tags.value = tagList.map((t) => ({ ...t, count: countMap.get(t.name) ?? 0 }))
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '加载标签失败'
  } finally {
    loading.value = false
  }
}

function goToMedia(tagName: string) {
  router.push({ path: '/', query: { tag: tagName } })
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
    <PageHeader title="标签管理" description="点击标签查看该标签下的媒体。">
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

    <div v-else class="flex flex-wrap gap-3 justify-center px-4">
      <span
        v-for="tag in tags"
        :key="tag.id"
        class="chip chip-neutral !px-4 !py-2.5 !text-[14px] cursor-pointer transition-all hover:scale-105 hover:shadow-sm group"
        @click="goToMedia(tag.name)"
      >
        <span class="font-medium">{{ tag.name }}</span>
        <span class="ml-1.5 text-caption-xs text-on-surface-variant/60 font-normal">{{ tag.count }}</span>
        <button
          class="material-symbols-outlined text-[14px] ml-1.5 text-on-surface-variant/30 hover:text-error transition-colors"
          type="button"
          title="删除标签"
          @click.stop="confirmDelete(tag)"
        >close</button>
      </span>
    </div>
  </div>

  <Modal
    v-if="modalVisible && deleteTarget"
    title="确认删除"
    :message="`确定删除标签「${deleteTarget.name}」吗？此操作会从所有作品中移除该标签。`"
    confirm-text="删除"
    cancel-text="取消"
    danger
    @confirm="handleDelete"
    @cancel="modalVisible = false"
  />
</template>
