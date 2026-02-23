import { ref } from 'vue'

export interface Toast {
  message: string
  type: 'error' | 'info'
}

export const toast = ref<Toast | null>(null)

let toastTimer: ReturnType<typeof setTimeout> | null = null

export function showToast(message: string, type: 'error' | 'info' = 'error'): void {
  if (toastTimer) clearTimeout(toastTimer)
  toast.value = { message, type }
  toastTimer = setTimeout(() => {
    toast.value = null
    toastTimer = null
  }, 4000)
}
