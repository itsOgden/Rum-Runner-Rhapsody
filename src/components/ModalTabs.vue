<script setup lang="ts">
import Icon from './Icon.vue'

defineProps<{
  tabs: Array<{ id: string; label: string; badge?: boolean }>
  modelValue: string
}>()

defineEmits<{ 'update:modelValue': [string] }>()
</script>

<template>
  <nav class="w-35 shrink-0 bg-bg-base border-r border-border-light py-2 overflow-y-auto">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      class="modal-tab block w-full text-left px-4 py-2.5 font-sans text-sm cursor-pointer transition-colors duration-100 outline-none"
      :class="modelValue === tab.id
        ? 'text-accent-text font-medium bg-accent/10 modal-tab--active'
        : 'text-text-secondary hover:bg-bg-surface-active hover:text-text-primary'"
      @click="$emit('update:modelValue', tab.id)"
    >
      {{ tab.label }}<Icon v-if="tab.badge" name="triangle-exclamation" class="text-[10px] text-danger ml-1" />
    </button>
  </nav>
</template>

<style scoped>
.modal-tab {
  position: relative;
}
.modal-tab::before {
  content: '';
  position: absolute;
  left: 0;
  top: 15%;
  bottom: 15%;
  width: 2px;
  background: var(--color-accent);
  transform: scaleY(0);
  transition: transform 0.12s ease;
  transform-origin: center;
}
.modal-tab:hover::before {
  transform: scaleY(1);
}
.modal-tab--active::before {
  transform: scaleY(1);
  transition: none;
}
</style>
