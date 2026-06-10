import { ref, readonly } from 'vue'

/**
 * Tauri environment detection and bridge utilities.
 * Gracefully degrades in web browser mode.
 */
export function useTauri() {
  const isTauri = ref(hasTauri())

  function hasTauri(): boolean {
    try {
      return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
    } catch {
      return false
    }
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

  /** Minimize the Tauri window. */
  async function minimizeWindow() {
    if (!isTauri.value) return
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      await getCurrentWindow().minimize()
    } catch { /* ignore */ }
  }

  /** Maximize/restore the Tauri window. */
  async function toggleMaximize() {
    if (!isTauri.value) return
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      const win = getCurrentWindow()
      if (await win.isMaximized()) {
        await win.unmaximize()
      } else {
        await win.maximize()
      }
    } catch { /* ignore */ }
  }

  /** Close the Tauri window. */
  async function closeWindow() {
    if (!isTauri.value) return
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      await getCurrentWindow().close()
    } catch { /* ignore */ }
  }

  return {
    isTauri: readonly(isTauri),
    openUrl,
    getVersion,
    checkUpdate,
    minimizeWindow,
    toggleMaximize,
    closeWindow
  }
}
