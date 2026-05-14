<script setup lang="ts">
import { computed } from 'vue'
import { COLOR_PALETTE } from '../colorPalette'

const props = defineProps<{
  modelValue: string   // selected hex, or '' for no selection
  defaultValue?: string  // highlight this swatch when modelValue is ''
}>()

const emit = defineEmits<{ 'update:modelValue': [hex: string] }>()

const effectiveSelected = computed(() => props.modelValue || props.defaultValue || '')
</script>

<template>
  <div class="flex flex-wrap gap-1.5">
    <button
      v-for="color in COLOR_PALETTE"
      :key="color.hex"
      class="w-7 h-7 rounded-full cursor-pointer transition-all outline-none border-2 shrink-0"
      :class="color.hex === effectiveSelected
        ? 'border-text-primary scale-110'
        : 'border-transparent opacity-65 hover:opacity-100 hover:scale-105'"
      :style="{ backgroundColor: color.hex }"
      :title="color.label"
      @click="emit('update:modelValue', color.hex)"
    />
  </div>
</template>
