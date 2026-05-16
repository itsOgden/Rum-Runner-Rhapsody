<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { formatAccelerator } from '../utils/hotkey'

const props = defineProps<{
  modelValue: string
  placeholder?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const listening = ref(false)

function startListening(): void {
  listening.value = true
  window.addEventListener('keydown', onKeydown, true)
}

function stopListening(): void {
  listening.value = false
  window.removeEventListener('keydown', onKeydown, true)
}

function onKeydown(e: KeyboardEvent): void {
  e.preventDefault()
  e.stopImmediatePropagation()
  if (e.key === 'Escape') {
    stopListening()
    return
  }
  const combo = formatAccelerator(e)
  if (!combo) return
  emit('update:modelValue', combo)
  stopListening()
}

onUnmounted(stopListening)
</script>

<template>
  <button
    type="button"
    class="min-w-32 px-2 py-1.5 text-sm bg-bg-surface border border-border-light outline-none text-center transition-all cursor-pointer select-none"
    :class="listening
      ? 'border-accent text-accent shadow-[0_0_6px_var(--color-accent-glow)]'
      : 'text-text-primary hover:border-accent/50 focus:border-accent'"
    @click="listening ? stopListening() : startListening()"
  >
    <span v-if="listening" class="animate-pulse">Press a key…</span>
    <span v-else>{{ modelValue || placeholder || 'None' }}</span>
  </button>
</template>
