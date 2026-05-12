<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'

const props = withDefaults(defineProps<{
  title: string
  width?: string
  open?: boolean
}>(), {
  width: '560px',
  open: false,
})

const emit = defineEmits<{
  close: []
}>()

const visible = ref(false)

watch(() => props.open, (val) => { visible.value = val }, { immediate: true })

const onKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') emit('close')
}

watch(visible, (val) => {
  if (val) document.addEventListener('keydown', onKeyDown)
  else document.removeEventListener('keydown', onKeyDown)
})

onUnmounted(() => document.removeEventListener('keydown', onKeyDown))
</script>

<template>
  <Teleport to="body">
    <Transition name="modal" appear>
      <div
        v-if="visible"
        class="fixed inset-0 bg-black/60 backdrop-blur-xs z-100 flex justify-center items-center"
        @click.self="emit('close')"
      >
        <div
          class="modal-container bg-bg-raised border border-border rounded-lg shadow-lg overflow-hidden"
          :style="{ width }"
        >
          <div class="flex items-center justify-between px-5 py-3.5 border-b border-border">
            <div class="text-lg font-bold text-text-primary">{{ title }}</div>
            <button class="close-btn" @click="emit('close')">×</button>
          </div>
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.close-btn {
  background: none;
  border: none;
  color: var(--color-text-dim);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  padding: 0 2px;
  border-radius: 4px;
  transition: color 0.15s;
}
.close-btn:hover { color: var(--color-text-primary); }

/* ── Enter animation ── */
.modal-enter-active {
  transition: opacity 0.2s ease;
}
.modal-enter-active .modal-container {
  transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.modal-enter-from {
  opacity: 0;
}
.modal-enter-from .modal-container {
  opacity: 0;
  transform: scale(0.95) translateY(-8px);
}

/* ── Leave animation ── */
.modal-leave-active {
  transition: opacity 0.15s ease;
}
.modal-leave-active .modal-container {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.modal-leave-to {
  opacity: 0;
}
.modal-leave-to .modal-container {
  opacity: 0;
  transform: scale(0.95) translateY(-8px);
}
</style>
