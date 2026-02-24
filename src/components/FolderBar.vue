<script setup lang="ts">
import { useSettings } from '../composables/useSettings'
import { useAudioDevices } from '../composables/useAudioDevices'
import { useSoundManagement } from '../composables/useSoundManagement'
import { filterQuery } from '../filterState'
import Icon from '@/components/Icon.vue'

const { settings, onFolderChanged, saveSettings, loadSounds } = useSettings()
const { refreshDevices } = useAudioDevices()
const { showHidden, resetSessionState } = useSoundManagement()

function toggleShowHidden() {
  showHidden.value = !showHidden.value
}

async function handleBrowse() {
  const result = await window.api.pickFolder()
  if (result) {
    filterQuery.value = ''
    resetSessionState()
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
      ><Icon name="xmark-solid" aria-hidden="true" /></button>
    </div>

    <!-- Show hidden toggle -->
    <button
      class="btn p-1.5 shrink-0"
      :class="showHidden ? 'btn-accent' : ''"
      @click="toggleShowHidden"
      :title="showHidden ? 'Hide hidden sounds' : 'Show hidden sounds'"
    >
      <Icon v-if="!showHidden" name="eye-slash" aria-hidden="true" />
      <Icon v-else name="eye" aria-hidden="true" />
    </button>

    <!-- Density toggle -->
    <button
      class="btn p-1.5 shrink-0"
      @click="toggleDensity"
      :title="settings.density === 'loose' ? 'Switch to compact view' : 'Switch to loose view'"
    >
      <Icon v-if="settings.density === 'loose'" name="grid-2" aria-hidden="true" />
      <Icon v-else name="grid-4" aria-hidden="true" />
    </button>

    <button class="btn btn-accent shrink-0 flex items-center gap-1.5" @click="handleBrowse">
      <Icon name="folder-open" aria-hidden="true" />
      Browse…
    </button>

    <!-- Refresh -->
    <button
      class="btn p-1.5 shrink-0"
      @click="handleRefresh"
      title="Refresh devices and sounds"
    ><Icon name="arrow-rotate-right" aria-hidden="true" /></button>
  </div>
</template>
