<script setup lang="ts">
import {ref, watch, onUnmounted, computed} from 'vue'
import Icon from './Icon.vue'

const props = withDefaults(defineProps<{
  title: string
  size?: 'sm' | 'md' | 'lg'
  open?: boolean
}>(), {
  size: 'md',
  open: false,
})

const emit = defineEmits<{
  close: []
}>()

const width = computed(() => props.size === 'sm' ? '35rem' : props.size === 'lg' ? '50rem' : '40rem')
const maxHeight = computed(() => props.size === 'sm' ? '26rem' : props.size === 'lg' ? '48rem' : '32rem')

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
          class="modal-container bg-bg-raised border border-border-light rounded-lg shadow-lg overflow-hidden flex flex-col h-[calc(100vh-4rem)]"
          :style="{ width, maxHeight }"
        >
          <div class="flex items-center justify-between px-5 py-3.5 border-b border-border-light shrink-0 bg-bg-surface-active">
            <div class="font-display text-lg text-text-primary">{{ title }}</div>
            <button
              class="text-text-dim text-xl leading-none cursor-pointer p-0.5 bg-transparent border-none transition-colors hover:text-text-primary"
              @click="emit('close')"
            >
              <Icon name="xmark-solid" class="text-[16px]" />
            </button>
          </div>
          <div class="flex-1 min-h-0 flex flex-col">
            <slot />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
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
