<script setup lang="ts">
import { ref } from 'vue'
import { useConfig } from '@/composables/useConfig'
import PageHeader from '@/components/PageHeader.vue'
import { useToast } from '@/composables/useToast'
import { api } from '@/utils/api'

const { backendUrl, apiKey, testing, testMessage, saveConfig, clearConfig, testConnection } = useConfig()
const toast = useToast()
const syncing = ref(false)
const migratingCovers = ref(false)
const exporting = ref(false)
const importing = ref(false)
const urlInput = ref(backendUrl.value || 'http://localhost:8000')
const keyInput = ref(apiKey.value)
const showKey = ref(false)

function save() {
  saveConfig(urlInput.value, keyInput.value)
}

async function saveAndTest() {
  save()
  await testConnection()
}

function clear() {
  clearConfig()
  urlInput.value = ''
  keyInput.value = ''
}

async function triggerSync() {
  syncing.value = true
  try {
    const res = await api.triggerSync()
    toast.success(`已同步 ${res.synced} 条` + (res.errors.length ? `，${res.errors.length} 条失败` : ''))
  } catch (err) {
    toast.error('同步失败: ' + (err instanceof Error ? err.message : String(err)))
  } finally {
    syncing.value = false
  }
}

async function triggerCoverMigration() {
  migratingCovers.value = true
  try {
    const res = await api.migrateCovers()
    toast.success(`已加入下载队列 ${res.queued} 张封面`)
  } catch (err) {
    toast.error('操作失败: ' + (err instanceof Error ? err.message : String(err)))
  } finally {
    migratingCovers.value = false
  }
}

async function handleExport() {
  exporting.value = true
  try {
    const data = await api.exportBackup()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `anriod-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('备份已下载')
  } catch (err) {
    toast.error('导出失败: ' + (err instanceof Error ? err.message : String(err)))
  } finally {
    exporting.value = false
  }
}

const importInput = ref<HTMLInputElement | null>(null)

function triggerImport() {
  importInput.value?.click()
}

async function handleImportFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  importing.value = true
  try {
    const text = await file.text()
    const data = JSON.parse(text)
    await api.importBackup(data)
    toast.success('备份已导入')
  } catch (err) {
    toast.error('导入失败: ' + (err instanceof Error ? err.message : String(err)))
  } finally {
    importing.value = false
    if (importInput.value) importInput.value.value = ''
  }
}
</script>

<template>
  <div class="section-gap mx-auto max-w-2xl">
    <PageHeader
      title="系统配置"
      description="管理服务器连接与 API 授权。请确保信息准确以保证同步正常进行。"
    />

    <!-- Form -->
    <div class="acrylic relative overflow-hidden rounded-xl border border-outline-variant/20 p-6 shadow-sm">
      <form class="relative z-10 flex flex-col gap-stack-lg" @submit.prevent="saveAndTest">
        <label class="flex flex-col gap-stack-sm">
          <span class="text-label-sm text-on-surface">服务器地址 (Server Address)</span>
          <input v-model="urlInput" class="field-fluent" placeholder="https://api.example.com" type="text" />
          <span class="text-caption-xs text-on-surface-variant">输入主服务器的完整 URL，支持 HTTP/HTTPS。</span>
        </label>

        <label class="flex flex-col gap-stack-sm">
          <span class="text-label-sm text-on-surface">API 密钥 (API Key)</span>
          <div class="relative">
            <input
              v-model="keyInput"
              class="field-fluent pr-10"
              :placeholder="showKey ? '输入密钥...' : '••••••••••••••••'"
              :type="showKey ? 'text' : 'password'"
            />
            <button
              class="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant transition-colors hover:text-primary"
              type="button"
              @click="showKey = !showKey"
            >
              <span class="material-symbols-outlined text-[20px]">{{ showKey ? 'visibility_off' : 'visibility' }}</span>
            </button>
          </div>
          <span class="text-caption-xs text-on-surface-variant">用于验证您的客户端身份，请勿泄露。</span>
        </label>

        <div class="flex flex-col items-center gap-stack-md border-t border-surface-container-highest pt-stack-sm sm:flex-row">
          <button class="btn-primary w-full sm:w-auto" type="button" @click="save">
            <span class="material-symbols-outlined text-[18px]">save</span>
            保存配置
          </button>
          <button class="btn-secondary w-full sm:w-auto" type="submit" :disabled="testing">
            <span v-if="testing" class="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
            <span v-else class="material-symbols-outlined text-[18px]">wifi_tethering</span>
            {{ testing ? '连接中...' : '测试连接' }}
          </button>
          <div class="flex-1" />
          <button class="btn-danger w-full sm:w-auto" type="button" @click="clear">
            <span class="material-symbols-outlined text-[18px]">delete</span>
            清空配置
          </button>
        </div>
      </form>

      <p
        v-if="testMessage"
        class="mt-4 rounded-lg p-3 text-label-sm"
        :class="testMessage.includes('成功') ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-error-container text-on-error-container'"
      >
        {{ testMessage }}
      </p>
    </div>

    <!-- Maintenance -->
    <div class="acrylic rounded-xl border border-outline-variant/20 p-6 shadow-sm flex flex-col gap-3">
      <h3 class="text-title-sm font-semibold text-on-surface mb-1">维护</h3>
      <div class="flex flex-wrap gap-2">
        <button class="btn-secondary" type="button" :disabled="syncing" @click="triggerSync">
          <span v-if="syncing" class="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
          <span v-else class="material-symbols-outlined text-[18px]">sync</span>
          {{ syncing ? '同步中...' : '同步数据源' }}
        </button>
        <button class="btn-secondary" type="button" :disabled="migratingCovers" @click="triggerCoverMigration">
          <span v-if="migratingCovers" class="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
          <span v-else class="material-symbols-outlined text-[18px]">download</span>
          {{ migratingCovers ? '下载中...' : '下载所有封面' }}
        </button>
      </div>
    </div>

    <!-- Backup -->
    <div class="acrylic rounded-xl border border-outline-variant/20 p-6 shadow-sm flex flex-col gap-3">
      <h3 class="text-title-sm font-semibold text-on-surface mb-1">数据备份</h3>
      <div class="flex flex-wrap gap-2">
        <button class="btn-secondary" type="button" :disabled="exporting" @click="handleExport">
          <span v-if="exporting" class="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
          <span v-else class="material-symbols-outlined text-[18px]">download</span>
          {{ exporting ? '导出中...' : '导出备份' }}
        </button>
        <button class="btn-secondary" type="button" :disabled="importing" @click="triggerImport">
          <span v-if="importing" class="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
          <span v-else class="material-symbols-outlined text-[18px]">upload</span>
          {{ importing ? '导入中...' : '导入备份' }}
        </button>
      </div>
      <p class="text-caption-xs text-on-surface-variant mt-1">
        备份为 JSON 文件，包含所有媒体、标签和观看记录。导入会覆盖当前数据。
      </p>
      <input
        ref="importInput"
        type="file"
        accept=".json"
        class="hidden"
        @change="handleImportFile"
      />
    </div>

  </div>
</template>
