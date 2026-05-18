<script setup lang="ts">
import Icon from '@/components/Icon.vue'
import Tooltip from '@/components/Tooltip.vue'
import type { IconName } from '@/types/icons'

defineProps<{
  icon: IconName
  title?: string
  noColors?: boolean
}>()

defineOptions({ inheritAttrs: false })
</script>

<template>
  <Tooltip :text="title">
    <button
      v-bind="$attrs"
      :class="!noColors && 'border border-accent/60 text-accent/60 bg-bg-surface/80 hover:border-accent hover:text-text-on-accent hover:bg-accent transition-all'"
      class="w-5 h-5 flex items-center justify-center shrink-0 rounded-full text-[10px] leading-none cursor-pointer outline-none"
    >
      <Icon :name="icon" />
    </button>
  </Tooltip>
</template>
