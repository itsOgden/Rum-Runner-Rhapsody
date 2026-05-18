<script setup lang="ts">
import Icon from '@/components/Icon.vue'
import Tooltip from '@/components/Tooltip.vue'
import type { IconName } from '@/types/icons'

defineProps<{
  icon: IconName
  title?: string
  enabled?: boolean
}>()

defineOptions({ inheritAttrs: false })
</script>

<template>
  <Tooltip :text="title">
    <button
      v-bind="$attrs"
      :class="enabled ? 'opacity-100 bg-accent text-text-on-accent' : 'opacity-0 group-hover/btn:opacity-100 text-text-secondary hover:text-text-primary'"
      class="w-5 h-5 flex items-center justify-center shrink-0 rounded-full text-xs cursor-pointer transition-all"
    >
      <Icon :name="icon" />
    </button>
  </Tooltip>
</template>
