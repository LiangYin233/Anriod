import { ref } from 'vue'

/**
 * Composable for managing async operation state (loading, error).
 * Eliminates the repetitive pattern of `const loading = ref(false); const error = ref('')`
 *
 * @example
 * const { loading, error, execute } = useAsyncState()
 *
 * async function loadData() {
 *   await execute(async () => {
 *     const data = await api.fetchSomething()
 *     // handle data
 *   }, '加载失败')
 * }
 */
export function useAsyncState() {
  const loading = ref(false)
  const error = ref('')

  /**
   * Execute an async function with automatic loading/error state management
   *
   * @param fn - The async function to execute
   * @param errorMessage - Optional custom error message (default: use error.message)
   * @returns The result of the async function
   */
  async function execute<T>(
    fn: () => Promise<T>,
    errorMessage?: string
  ): Promise<T | undefined> {
    loading.value = true
    error.value = ''

    try {
      const result = await fn()
      return result
    } catch (caught) {
      const realMsg = caught instanceof Error ? caught.message : String(caught)
      error.value = errorMessage ? `${errorMessage}: ${realMsg}` : realMsg
      return undefined
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    error,
    execute
  }
}
