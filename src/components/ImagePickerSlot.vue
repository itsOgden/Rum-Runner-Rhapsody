<script setup lang="ts">
import Icon from './Icon.vue'

defineProps<{
  label: string
  path: string | null
  preview: string | null
  error: string | null
  disabled?: boolean
  emptyText?: string
}>()

const emit = defineEmits<{
  pick: []
  clear: []
}>()
</script>

<template>
  <div class="flex-1 min-w-0 flex flex-col gap-1.5" :class="{ 'opacity-45 pointer-events-none': disabled }">
    <div class="text-sm font-semibold uppercase text-text-secondary tracking-[0.04em]">{{ label }}</div>
    <div
      class="group/slot relative w-full aspect-square rounded-sm overflow-hidden border cursor-pointer outline-none"
      :class="error
        ? 'border-danger bg-[color-mix(in_srgb,var(--color-danger)_12%,var(--color-bg-surface))] focus-visible:outline focus-visible:outline-1 focus-visible:outline-danger'
        : 'border-border-light bg-bg-surface focus-visible:border-accent'"
      role="button"
      :tabindex="disabled ? -1 : 0"
      @click="emit('pick')"
      @keydown.enter="emit('pick')"
    >
      <img v-if="preview" :src="preview" class="w-full h-full object-cover block" draggable="false" alt="" />
      <div v-else-if="error" class="w-full h-full flex items-center justify-center">
        <Icon name="triangle-exclamation" class="text-[22px] text-danger" />
      </div>
      <div v-else class="w-full h-full flex items-center justify-center p-2">
        <span class="text-sm text-text-dim text-center leading-snug">{{ emptyText ?? 'Select Icon' }}</span>
      </div>
      <button
        v-if="path"
        class="absolute top-1 right-1 w-[18px] h-[18px] rounded-full bg-black/60 border-none text-white text-sm leading-none cursor-pointer flex items-center justify-center p-0 z-[1] transition-colors duration-100 hover:bg-danger"
        title="Clear override"
        @click.stop="emit('clear')"
      >
        <Icon name="xmark-solid" />
      </button>
      <div v-if="!disabled" class="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity duration-150 pointer-events-none group-hover/slot:opacity-100 group-focus-visible/slot:opacity-100">
        <span class="text-sm font-semibold text-white uppercase tracking-[0.05em]">Change Icon</span>
      </div>
    </div>
    <div v-if="error" class="text-sm text-danger leading-snug break-all">File not found: {{ error }}</div>
  </div>
</template>
