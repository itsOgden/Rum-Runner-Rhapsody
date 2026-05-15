<script setup lang="ts">
defineProps<{ modelValue: boolean }>()
defineEmits<{ 'update:modelValue': [boolean] }>()
</script>

<template>
  <label class="relative w-9 h-5 cursor-pointer inline-block shrink-0">
    <input
      type="checkbox"
      class="peer hidden"
      :checked="modelValue"
      @change="$emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
    />
    <span class="toggle-track absolute inset-0 bg-bg-surface rounded-[10px] border border-border-light transition-all peer-checked:bg-accent peer-checked:border-accent" />
    <span class="absolute top-[3px] left-[3px] w-3.5 h-3.5 bg-text-secondary rounded-full transition-all peer-checked:left-[19px] peer-checked:bg-text-on-accent" />
  </label>
</template>

<style scoped>
input:checked + .toggle-track {
  box-shadow: 0 0 6px var(--color-accent-glow);
}
</style>
