<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { formatAccelerator } from '@/utils/hotkey'
import Icon from '@/components/Icon.vue'
import Tooltip from '@/components/Tooltip.vue'

const props = defineProps<{
  modelValue: string
  allowDelete?: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string]; cancel: [] }>()

const keyParts = computed(() => props.modelValue ? props.modelValue.split('+') : [])

const listening = ref(false)
const confirmingClear = ref(false)

function startListening(): void {
  confirmingClear.value = false
  listening.value = true
  window.addEventListener('keydown', onKeydown, true)
  setTimeout(() => window.addEventListener('mousedown', onOutsideMousedown, true), 0)
}

function stopListening(): void {
  listening.value = false
  window.removeEventListener('keydown', onKeydown, true)
  window.removeEventListener('mousedown', onOutsideMousedown, true)
}

function onOutsideMousedown(): void {
  stopListening()
  emit('cancel')
}

function onKeydown(e: KeyboardEvent): void {
  e.preventDefault()
  e.stopImmediatePropagation()
  if (e.key === 'Escape') {
    stopListening()
    emit('cancel')
    return
  }
  const combo = formatAccelerator(e)
  if (!combo) return
  emit('update:modelValue', combo)
  // Don't stopListening here — wait for modelValue to change (parent accepted).
  // If the parent rejects the combo, modelValue stays the same and we keep listening.
}

watch(() => props.modelValue, () => {
  if (listening.value) stopListening()
})

function handleCancel(): void {
  stopListening()
  emit('cancel')
}

function requestClear(): void {
  confirmingClear.value = true
}

function confirmClear(): void {
  confirmingClear.value = false
  emit('update:modelValue', '')
}

function cancelClear(): void {
  confirmingClear.value = false
}

onUnmounted(stopListening)

defineExpose({ startListening })
</script>

<template>
  <div class="keybind-capture flex items-center">
    <div class="flex items-center gap-1 w-full min-h-6.5">
      <template v-if="listening">
        <span class="listening-dot" />
        <span class="text-accent text-sm tracking-wide animate-pulse">Press a key</span>
        <button
          type="button"
          class="text-text-secondary text-sm ml-auto cursor-pointer hover:text-text-primary transition-colors"
          @click="handleCancel"
        >cancel</button>
      </template>
      <template v-else-if="confirmingClear">
        <span class="text-[12px] text-text-secondary">Remove keybind?</span>
        <div class="ml-auto flex items-center gap-3">
          <button
            type="button"
            class="text-[11px] text-danger cursor-pointer hover:text-danger/80 transition-colors"
            @click="confirmClear"
          >Remove</button>
          <button
            type="button"
            class="text-[11px] text-text-secondary cursor-pointer hover:text-text-primary transition-colors"
            @click="cancelClear"
          >Cancel</button>
        </div>
      </template>
      <template v-else>
        <button
          type="button"
          class="flex items-center gap-1 cursor-pointer outline-none select-none"
          @click="startListening"
        >
          <span v-if="keyParts.length === 0" class="add-hint">None</span>
          <span v-for="(part, i) in keyParts" :key="i" class="key-chip">{{ part }}</span>
        </button>
        <Tooltip text="Clear keybind">
          <button
            v-if="allowDelete && modelValue"
            type="button"
            class="ml-auto text-text-secondary hover:text-danger cursor-pointer p-0.5 flex items-center transition-colors"
            @click="requestClear"
          >
            <Icon name="xmark-solid" class="text-xs" />
          </button>
        </Tooltip>
      </template>
    </div>
  </div>
</template>

<style scoped>
.key-chip {
  display: inline-flex;
  align-items: center;
  padding: 3px 7px;
  background: var(--color-bg-deepest);
  border: 1px solid var(--color-border-light);
  border-bottom: 2px solid #111;
  font-family: 'Outfit', sans-serif;
  font-weight: 500;
  font-size: 12px;
  line-height: 1.3;
  color: var(--color-text-primary);
  transition: border-color 0.12s;
  white-space: nowrap;
}

.add-hint {
  display: inline-flex;
  align-items: center;
  padding: 3px 7px 4px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.3;
  border: 1px dashed color-mix(in srgb, var(--color-border-light) 100%, transparent);
  color: var(--color-text-secondary);
  transition: color 0.12s, border-color 0.12s;
}

button:hover .add-hint {
  border-color: rgb(from var(--color-accent) r g b / 0.5);
  color: var(--color-accent);
}

button:hover .key-chip {
  border-color: rgb(from var(--color-accent) r g b / 0.5);
  border-bottom-color: rgb(from var(--color-accent) r g b / 0.7);
}

button:focus-visible .key-chip {
  border-color: var(--color-accent);
}


.listening-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-accent);
  box-shadow: 0 0 8px rgb(from var(--color-accent) r g b / 0.5);
  animation: pulse-dot 1s ease-in-out infinite;
  flex-shrink: 0;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.4; transform: scale(0.75); }
}
</style>
