<script setup>
import { useSettings } from '../composables/useSettings.js'
import { useAudioDevices } from '../composables/useAudioDevices.js'
import { filterQuery } from '../filterState.js'

const { settings, onFolderChanged, saveSettings, loadSounds } = useSettings()
const { refreshDevices } = useAudioDevices()

async function handleBrowse() {
  const result = await window.api.pickFolder()
  if (result) {
    filterQuery.value = ''
    await onFolderChanged(result)
  }
}

async function handleRefresh() {
  await refreshDevices()
  await loadSounds()
}

function toggleDensity() {
  const next = settings.value.density === 'compact' ? 'loose' : 'compact'
  settings.value.density = next
  saveSettings({ density: next })
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

    <!-- Search input -->
    <div class="relative flex items-center shrink-0">
      <input
        type="text"
        v-model="filterQuery"
        placeholder="Search"
        class="font-sans text-[12px] bg-bg-surface border border-border rounded-sm pl-2.5 pr-6 py-1 text-text-primary placeholder:text-text-dim outline-none focus:border-accent w-40 transition-colors"
      />
      <button
        v-if="filterQuery"
        @click="filterQuery = ''"
        class="absolute right-2 rounded-full text-[10px] w-4 h-4 flex items-center justify-center shrink-0 border border-accent text-accent hover:bg-accent hover:text-bg-base leading-none cursor-pointer"
        title="Clear filter"
      >✕</button>
    </div>

    <!-- Density toggle -->
    <button
      class="btn p-1.5 shrink-0"
      @click="toggleDensity"
      :title="settings.density === 'loose' ? 'Switch to compact view' : 'Switch to loose view'"
    >
      <!-- Loose grid icon — shown in compact mode, clicking → loose -->
      <svg v-if="settings.density === 'loose'" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="6" height="6"/>
        <rect x="10" y="0" width="6" height="6"/>
        <rect x="0" y="10" width="6" height="6"/>
        <rect x="10" y="10" width="6" height="6"/>
      </svg>
      <!-- Dense grid icon — shown in loose mode, clicking → compact -->
      <svg v-else width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="4" height="4"/>
        <rect x="6" y="0" width="4" height="4"/>
        <rect x="12" y="0" width="4" height="4"/>
        <rect x="0" y="6" width="4" height="4"/>
        <rect x="6" y="6" width="4" height="4"/>
        <rect x="12" y="6" width="4" height="4"/>
        <rect x="0" y="12" width="4" height="4"/>
        <rect x="6" y="12" width="4" height="4"/>
        <rect x="12" y="12" width="4" height="4"/>
      </svg>
    </button>

    <button class="btn btn-accent shrink-0" @click="handleBrowse">Browse…</button>

    <!-- Refresh -->
    <button
      class="btn p-1.5 shrink-0 text-[15px] leading-none"
      @click="handleRefresh"
      title="Refresh devices and sounds"
    >↻</button>
  </div>
</template>
