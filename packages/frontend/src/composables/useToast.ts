import { inject, type InjectionKey } from 'vue'

export interface ToastAPI {
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

export const TOAST_KEY: InjectionKey<ToastAPI> = Symbol('toast')

export function useToast(): ToastAPI {
  const toast = inject(TOAST_KEY)
  if (!toast) {
    // Fallback: just log
    return {
      success: (msg) => console.log('[success]', msg),
      error: (msg) => console.error('[error]', msg),
      info: (msg) => console.log('[info]', msg),
    }
  }
  return toast
}
