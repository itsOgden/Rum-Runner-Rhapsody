<script setup lang="ts">
defineProps<{
  topBorder?: boolean
}>()
</script>

<template>
  <button
    class="w-full text-left px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-surface hover:text-text-primary cursor-pointer flex items-center justify-between"
    :class="{ 'border-t border-border': topBorder }"
  ><slot /></button>
</template>
