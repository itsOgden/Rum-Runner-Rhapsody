<script setup lang="ts">
defineProps<{
  label: string
  description?: string
}>()
</script>

<template>
  <div>
    <div class="flex items-center justify-between gap-4">
      <div class="text-sm text-text-primary">{{ label }}</div>
      <slot />
    </div>
    <p v-if="description" class="mt-1 text-xs text-text-dim">{{ description }}</p>
  </div>
</template>
