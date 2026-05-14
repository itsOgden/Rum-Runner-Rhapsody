<script setup lang="ts">
import { toast } from '../toastState'
</script>

<template>
  <Teleport to="body">
    <Transition name="toast">
      <div
        v-if="toast"
        class="fixed bottom-0 left-0 right-0 z-[200] flex justify-center pb-5 pointer-events-none"
      >
        <div
          class="pointer-events-auto flex items-center gap-2 px-4 py-3 rounded-md border text-sm font-medium shadow-lg"
          :class="toast.type === 'error'
            ? 'bg-danger/10 border-danger/30 text-danger'
            : 'bg-accent/10 border-accent/30 text-accent'"
        >
          <span>{{ toast.message }}</span>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
