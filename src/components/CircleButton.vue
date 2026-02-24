<script setup lang="ts">
import Icon from '@/components/Icon.vue'
import type { IconName } from '@/types/icons'

defineProps<{
  icon: IconName
  title?: string
}>()
</script>

<template>
  <button
    class="w-5 h-5 flex items-center justify-center shrink-0 rounded-full border border-accent/60 text-accent/60 bg-bg-surface/80 text-[10px] leading-none cursor-pointer outline-none transition-all hover:border-accent hover:text-text-on-accent hover:bg-accent"
    :title="title"
  >
    <Icon :name="icon" />
  </button>
</template>
