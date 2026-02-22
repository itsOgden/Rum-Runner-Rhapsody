<script setup>
import { useSettings } from '../composables/useSettings.js'
import { filterQuery } from '../filterState.js'

const { settings, onFolderChanged, saveSettings } = useSettings()

async function handleBrowse() {
  const result = await window.api.pickFolder()
  if (result) {
    filterQuery.value = ''
    await onFolderChanged(result)
  }
}

function adjustColumns(delta) {
  const next = Math.min(10, Math.max(1, (settings.value.columns || 4) + delta))
  settings.value.columns = next
  saveSettings({ columns: next })
}
</script>

<template>
  <div class="flex items-center gap-3 px-5 py-2 bg-bg-base border-b border-border shrink-0">
    <!-- Folder path -->
    <span
      class="flex-1 font-mono text-xs truncate min-w-0"
      :class="settings.soundFolder ? 'text-text-secondary' : 'text-text-dim'"
    >
      {{ settings.soundFolder || '(no folder selected)' }}
    </span>

    <!-- Column count control -->
    <div class="flex items-center gap-1 shrink-0">
      <span class="font-mono text-[10px] text-text-dim uppercase tracking-wider mr-0.5">Cols</span>
      <button class="btn py-0.5 px-2 text-[12px]" @click="adjustColumns(-1)">−</button>
      <span class="font-mono text-[12px] text-text-secondary w-5 text-center select-none">{{ settings.columns || 4 }}</span>
      <button class="btn py-0.5 px-2 text-[12px]" @click="adjustColumns(1)">+</button>
    </div>

    <!-- Search input -->
    <div class="relative flex items-center shrink-0">
      <input
        type="text"
        v-model="filterQuery"
        placeholder="Filter sounds…"
        class="font-sans text-[12px] bg-bg-surface border border-border rounded-sm pl-2.5 pr-6 py-1 text-text-primary placeholder:text-text-dim outline-none focus:border-accent w-40 transition-colors"
      />
      <button
        v-if="filterQuery"
        @click="filterQuery = ''"
        class="absolute right-2 text-[11px] text-text-dim hover:text-text-primary leading-none"
        title="Clear filter"
      >✕</button>
    </div>

    <button class="btn btn-accent shrink-0" @click="handleBrowse">Browse…</button>
  </div>
</template>
