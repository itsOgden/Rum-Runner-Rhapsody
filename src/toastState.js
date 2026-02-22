import { ref } from 'vue'

export const toast = ref(null) // { message: string, type: 'error' | 'info' }

let toastTimer = null

export function showToast(message, type = 'error') {
  if (toastTimer) clearTimeout(toastTimer)
  toast.value = { message, type }
  toastTimer = setTimeout(() => {
    toast.value = null
    toastTimer = null
  }, 4000)
}
