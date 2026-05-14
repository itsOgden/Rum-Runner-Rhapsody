<script setup lang="ts">
import Icon from './Icon.vue'

defineProps<{
  tabs: Array<{ id: string; label: string; badge?: boolean }>
  modelValue: string
}>()

defineEmits<{ 'update:modelValue': [string] }>()
</script>

<template>
  <nav class="w-[140px] shrink-0 bg-bg-surface border-r border-border py-2 overflow-y-auto">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      class="block w-full text-left px-4 py-[10px] font-sans text-sm border-l-2 text-text-secondary cursor-pointer transition-colors duration-100 outline-none hover:bg-bg-surface-hover hover:text-text-primary"
      :class="modelValue === tab.id
        ? 'border-l-accent text-text-primary bg-bg-surface-hover'
        : 'border-l-transparent'"
      @click="$emit('update:modelValue', tab.id)"
    >
      {{ tab.label }}<Icon v-if="tab.badge" name="triangle-exclamation" class="text-[10px] text-danger ml-1" />
    </button>
  </nav>
</template>
