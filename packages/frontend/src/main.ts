import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { useConfig } from './composables/useConfig'
import '@material-symbols/font-400/outlined.css'
import './style.css'
import './assets/components.css'

const { applyStoredTheme } = useConfig()
applyStoredTheme()

const app = createApp(App)
app.use(router)

// Detect Tauri — apply OS-native styling hints
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
if (isTauri) {
  // In Tauri, set a CSS class so the UI can adapt (no browser chrome needed)
  document.documentElement.classList.add('tauri-app')

  // Tauri 2.0: prevent default context menu (optional, use with caution)
  window.addEventListener('contextmenu', (e) => {
    // Allow context menu on inputs and textareas
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
    e.preventDefault()
  })

  // Disable middle-click auto-scroll panning (WebView2 default)
  window.addEventListener('auxclick', (e) => { e.preventDefault() }, { passive: false })
}

app.mount('#app')
