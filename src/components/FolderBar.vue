<script setup>
import { useSettings } from '../composables/useSettings.js'

const { settings, onFolderChanged } = useSettings()

async function handleBrowse() {
  const result = await window.api.pickFolder()
  if (result) {
    await onFolderChanged(result)
  }
}
</script>

<template>
  <div class="flex items-center gap-3 px-5 py-2.5 bg-bg-base border-b border-border shrink-0">
    <span
      class="flex-1 font-mono text-xs truncate"
      :class="settings.soundFolder ? 'text-text-secondary' : 'text-text-dim'"
    >
      {{ settings.soundFolder || '(no folder selected)' }}
    </span>
    <button class="btn btn-accent" @click="handleBrowse">Browse...</button>
  </div>
</template>
