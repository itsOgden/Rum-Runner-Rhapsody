<script setup lang="ts">
import Icon from '@/components/Icon.vue'
import type { IconName } from '@/types/icons'

withDefaults(defineProps<{
  icon: IconName
  title?: string
  active?: boolean
  disabled?: boolean
  variant?: 'default' | 'danger'
}>(), {
  active: false,
  variant: 'default',
})
</script>

<template>
  <button
    class="w-9 h-9 flex items-center justify-center shrink-0 border rounded-sm transition-all duration-150 outline-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
    :class="[
      variant === 'danger'
        ? 'bg-danger/10 border-danger/30 text-danger hover:bg-danger/20 hover:border-danger'
        : active
          ? 'bg-accent border-accent text-text-on-accent hover:bg-accent-dim hover:border-accent-dim'
          : 'bg-bg-surface border-border-light text-text-secondary hover:bg-bg-surface-hover hover:text-text-primary hover:border-text-dim',
    ]"
    :title="title"
    :disabled="disabled"
  >
    <Icon :name="icon" class="text-sm" aria-hidden="true" />
  </button>
</template>
