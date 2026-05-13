<script setup lang="ts">
defineProps<{
  modelValue: number
  min: number
  max: number
  step?: number
  unit?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number]
  'change': [value: number]
}>()

function onInput(e: Event): void {
  emit('update:modelValue', Number((e.target as HTMLInputElement).value))
}

function onChange(e: Event): void {
  emit('change', Number((e.target as HTMLInputElement).value))
}
</script>

<template>
  <div class="flex items-center gap-2">
    <input
      type="range"
      :min="min"
      :max="max"
      :step="step ?? 1"
      :value="modelValue"
      @input="onInput"
      @change="onChange"
    />
    <span class="font-mono text-[11px] text-text-secondary min-w-[40px] text-right">
      {{ modelValue > 0 ? '+' : '' }}{{ modelValue }}{{ unit ?? '' }}
    </span>
  </div>
</template>
