import { computed, ref } from 'vue'
import { api, getStoredConfig, normalizeBackendUrl } from '@/utils/api'

const initialConfig = getStoredConfig()
const backendUrl = ref(initialConfig.backendUrl)
const apiKey = ref(initialConfig.apiKey)
const testing = ref(false)
const testMessage = ref('')

export function useConfig() {
  const isConfigured = computed(() => Boolean(backendUrl.value && apiKey.value))

  function saveConfig(url: string, key: string) {
    backendUrl.value = normalizeBackendUrl(url)
    apiKey.value = key.trim()
    localStorage.setItem('backendUrl', backendUrl.value)
    localStorage.setItem('apiKey', apiKey.value)
  }

  function clearConfig() {
    backendUrl.value = ''
    apiKey.value = ''
    testMessage.value = ''
    localStorage.removeItem('backendUrl')
    localStorage.removeItem('apiKey')
  }

  async function testConnection() {
    testing.value = true
    testMessage.value = ''

    try {
      const result = await api.health()
      testMessage.value = result.ok ? '连接成功' : '后端响应异常'
      return result.ok
    } catch (error) {
      testMessage.value = error instanceof Error ? error.message : '连接失败'
      return false
    } finally {
      testing.value = false
    }
  }

  function toggleTheme() {
    const nextDark = !document.documentElement.classList.contains('dark')
    document.documentElement.classList.toggle('dark', nextDark)
    localStorage.setItem('theme', nextDark ? 'dark' : 'light')
  }

  function applyStoredTheme() {
    const theme = localStorage.getItem('theme') || 'light'
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }

  return {
    backendUrl,
    apiKey,
    isConfigured,
    testing,
    testMessage,
    saveConfig,
    clearConfig,
    testConnection,
    toggleTheme,
    applyStoredTheme
  }
}
