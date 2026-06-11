import { computed, ref, readonly } from 'vue'

// Tauri 2 global API (available when withGlobalTauri: true)
declare global {
  interface Window {
    __TAURI__?: {
      window?: {
        getCurrentWindow: () => {
          minimize: () => Promise<void>
          toggleMaximize: () => Promise<void>
          close: () => Promise<void>
          startDragging: () => Promise<void>
        }
      }
    }
    __TAURI_INTERNALS__?: Record<string, any>
  }
}

/**
 * Tauri environment detection and bridge utilities.
 * Gracefully degrades in web browser mode.
 */
export function useTauri() {
  const isTauri = ref(hasTauri())
  const currentPlatform = ref<string | null>(null)

  function hasTauri(): boolean {
    try {
      return typeof window !== 'undefined' && (('__TAURI_INTERNALS__' in window) || ('__TAURI__' in window))
    } catch {
      return false
    }
  }

  // Detect platform on initialization
  if (isTauri.value) {
    import('@tauri-apps/plugin-os')
      .then(({ platform }) => {
        currentPlatform.value = platform()
      })
      .catch(() => {
        currentPlatform.value = null
      })
  }

  /** Open a URL in the system default browser (Tauri) or a new tab (web). */
  async function openUrl(url: string) {
    if (isTauri.value) {
      try {
        const { open } = await import('@tauri-apps/plugin-shell')
        await open(url)
      } catch {
        // Fallback: use opener plugin
        try {
          const { openUrl: tauriOpen } = await import('@tauri-apps/plugin-opener')
          await tauriOpen(url)
        } catch {
          window.open(url, '_blank')
        }
      }
    } else {
      window.open(url, '_blank')
    }
  }

  /** Get the current Tauri app version. */
  async function getVersion(): Promise<string> {
    if (!isTauri.value) return 'web'
    try {
      const { getVersion: tauriGetVersion } = await import('@tauri-apps/api/app')
      return await tauriGetVersion()
    } catch {
      return '0.1.0'
    }
  }

  /** Check for Tauri app updates. */
  async function checkUpdate(): Promise<{ hasUpdate: boolean; version?: string }> {
    if (!isTauri.value) return { hasUpdate: false }
    try {
      const { check } = await import('@tauri-apps/plugin-updater')
      const update = await check()
      if (update) {
        return { hasUpdate: true, version: update.version }
      }
      return { hasUpdate: false }
    } catch {
      return { hasUpdate: false }
    }
  }

  /** Get the current Tauri window handle. */
  function getWin(): any {
    try {
      return window.__TAURI__?.window?.getCurrentWindow()
    } catch { return null }
  }

  /** Minimize the Tauri window. */
  async function minimizeWindow() {
    const win = getWin()
    if (!win) return
    try { await win.minimize() } catch (e) { console.error('[tauri] minimize:', e) }
  }

  /** Maximize/restore the Tauri window. */
  async function toggleMaximize() {
    const win = getWin()
    if (!win) return
    try { await win.toggleMaximize() } catch (e) { console.error('[tauri] toggleMaximize:', e) }
  }

  /** Close the Tauri window. */
  async function closeWindow() {
    const win = getWin()
    if (!win) return
    try { await win.close() } catch (e) { console.error('[tauri] close:', e) }
  }

  const isDesktop = computed(() => {
    if (!isTauri.value) return false
    const platform = currentPlatform.value
    // Platform not yet loaded; treat as non-desktop to be safe
    if (platform === null) return false
    return platform !== 'android' && platform !== 'ios'
  })

  return {
    isTauri: readonly(isTauri),
    isDesktop,
    openUrl,
    getVersion,
    checkUpdate,
    minimizeWindow,
    toggleMaximize,
    closeWindow
  }
}
