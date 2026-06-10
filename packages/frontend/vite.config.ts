import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Detect if we're building for Tauri (set by Tauri CLI)
const isTauri = process.env.TAURI_ENV_PLATFORM !== undefined || process.env.TAURI_ARCH !== undefined

export default defineConfig({
  plugins: [vue()],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@anriod/shared': fileURLToPath(new URL('../shared/src/types.ts', import.meta.url))
    }
  },

  // Tauri expects a static site on the same port in dev, and expects the build to serve
  // from a relative path. We keep defaults.
  server: {
    // On Tauri dev, strictPort ensures the Vite dev server is on the port Tauri expects
    strictPort: true,
    port: 5173,
    // Allow Tauri webview to connect
    host: isTauri ? 'localhost' : true,
    // HMR over the network when running via Tauri
    watch: {
      ignored: ['**/src-tauri/**']
    }
  },

  // In production builds, clear Vite-specific env prefix leakage
  envPrefix: ['VITE_', 'TAURI_'],

  build: {
    // Tauri uses Chromium on Windows, WebKit on macOS/Linux
    target: isTauri ? ['es2021', 'chrome105', 'safari15'] : ['es2020'],
    // Don't minify for debug builds during development
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    // Generate sourcemaps for debugging in Tauri devtools
    sourcemap: !!process.env.TAURI_ENV_DEBUG
  },

  // Clear console on Tauri dev
  clearScreen: !isTauri
})
