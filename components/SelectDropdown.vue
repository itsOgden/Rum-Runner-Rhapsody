<script lang="ts">
export default defineNuxtComponent({
  emits: ['change'],
  props: {
    label: {
      type: String,
      default: '',
    },
    description: {
      type: String,
      default: '',
    },
    visibleDescription: {
      type: Boolean,
    },
  },
  methods: {
    change(e: Event) {
      const val = (e.target as HTMLSelectElement).value as string | undefined
      this.$emit('change', val)
    },
  },
})
</script>

<template>
  <div class="w-full space-y-2">
    <div v-if="label || description" class="-space-y-1">
      <label v-if="label" class="font-tavernlore block text-xl text-white" :title="visibleDescription ? '' : description">{{ label }}</label>
      <em v-if="description && visibleDescription" class="text-sm text-gray-400 block">{{ description }}</em>
    </div>
    <div>
      <select class="px-4 bg-gray-600 text-white w-full py-3 text-sm border-r-8 border-transparent cursor-pointer" @change="change">
        <slot />
      </select>
    </div>
  </div>
</template>

<style scoped lang="scss">

</style>
