<script setup lang="ts">
defineProps<{
  number: number
  title: string
}>()
</script>

<template>
  <div class="flex gap-3 items-start">
    <div class="w-6 h-6 rounded-full bg-accent text-text-on-accent font-semibold text-[12px] flex items-center justify-center shrink-0 mt-[1px]">{{ number }}</div>
    <div class="flex-1 min-w-0">
      <div class="text-text-primary font-semibold text-[13px] mb-1">{{ title }}</div>
      <slot />
    </div>
  </div>
</template>
