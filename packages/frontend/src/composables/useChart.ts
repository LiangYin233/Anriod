import { onMounted, onUnmounted, watch, type Ref } from 'vue'
import { Chart, registerables, type ChartConfiguration } from 'chart.js'

// Register Chart.js components exactly once
Chart.register(...registerables)

/**
 * Chart.js lifecycle composable.
 *
 * Usage:
 * ```ts
 * const trigger = ref(0)
 * useChart(canvasRef, () => ({ type: 'doughnut', data: {...}, options: {...} }), trigger)
 *
 * // When data changes:
 * trigger.value++
 * // Charts auto-rebuild on theme change (MutationObserver on <html class>)
 * ```
 */
export function useChart(
  canvasRef: Ref<HTMLCanvasElement | null>,
  configFactory: () => ChartConfiguration | null,
  trigger?: Ref<number>
) {
  let chartInstance: Chart | null = null
  let themeObserver: MutationObserver | null = null

  function create() {
    chartInstance?.destroy()
    chartInstance = null
    if (!canvasRef.value) return
    const config = configFactory()
    if (!config) return
    chartInstance = new Chart(canvasRef.value, config as ChartConfiguration)
  }

  function destroy() {
    chartInstance?.destroy()
    chartInstance = null
  }

  onMounted(() => {
    create()

    // Rebuild chart when dark/light theme toggles
    themeObserver = new MutationObserver(() => create())
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })
  })

  onUnmounted(() => {
    destroy()
    themeObserver?.disconnect()
  })

  if (trigger) {
    watch(trigger, () => create())
  }

  return { create, destroy }
}
