<template>
  <i class="icon" :class="iconClass" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { IconName } from '@/types/icons'
import { IconsFolder } from '@/types/icons'

const DefaultIconsFolder = 'duotone'

const props = withDefaults(defineProps<{
  name: IconName
  useWidth?: boolean
}>(), {
  useWidth: false
})

interface IconInfo {
  folder: string
  name: string
  colored: boolean
}

function getIconInfo(icon: IconName): IconInfo {
  const folder = IconsFolder.find((f) => icon.endsWith(`-${f}`)) ?? DefaultIconsFolder
  const name = icon.replace(`-${folder}`, '')
  return {
    folder,
    name,
    colored: folder === 'colored',
  }
}

function getIconClass(icon: IconName): string {
  const info = getIconInfo(icon)
  return `i-${info.name}-${info.folder}${info.colored ? ' colored' : ''}`
}

const iconClass = computed(() => [
  getIconClass(props.name),
  props.useWidth && 'scale-width'
])
</script>