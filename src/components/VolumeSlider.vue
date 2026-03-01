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

<style scoped>
input[type="range"] {
  -webkit-appearance: none;
  flex: 1;
  width: 100%;
  height: 4px;
  background: var(--color-bg-surface);
  border-radius: 2px;
  outline: none;
}
input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px; height: 14px;
  border-radius: 50%;
  background: var(--color-accent);
  cursor: pointer;
  box-shadow: 0 0 6px var(--color-accent-glow);
  transition: box-shadow 0.15s;
}
input[type="range"]::-webkit-slider-thumb:hover {
  box-shadow: 0 0 12px var(--color-accent-glow);
}
</style>
