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
    return {
      success: () => {},
      error: () => {},
      info: () => {},
    }
  }
  return toast
}
