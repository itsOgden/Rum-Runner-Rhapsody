<script setup lang="ts">
import { useSettings } from '../composables/useSettings'
import { useAudioDevices } from '../composables/useAudioDevices'
import { useSoundManagement } from '../composables/useSoundManagement'
import { useStreamDeckImageErrors } from '../composables/useStreamDeckImageErrors'
import { filterQuery } from '../filterState'
import SquareButton from '@/components/SquareButton.vue'
import CircleButton from '@/components/CircleButton.vue'
import Icon from '@/components/Icon.vue'

const { settings, onFolderChanged, saveSettings, loadSounds } = useSettings()
const { refreshDevices } = useAudioDevices()
const { showHidden, resetSessionState } = useSoundManagement()
const { scanAll } = useStreamDeckImageErrors()

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
  await scanAll(settings.value)
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
      <CircleButton
        v-if="filterQuery"
        icon="xmark-solid"
        title="Clear filter"
        class="absolute right-2"
        @click="filterQuery = ''"
      />
    </div>

    <!-- Show hidden toggle -->
    <SquareButton
      :icon="showHidden ? 'eye' : 'eye-slash'"
      :title="showHidden ? 'Hide hidden sounds' : 'Show hidden sounds'"
      :active="showHidden"
      @click="toggleShowHidden"
    />

    <!-- Density toggle -->
    <SquareButton
      :icon="settings.density === 'loose' ? 'grid-2' : 'grid-4'"
      :title="settings.density === 'loose' ? 'Switch to compact view' : 'Switch to loose view'"
      @click="toggleDensity"
    />

    <button class="btn btn-accent shrink-0 flex items-center gap-1.5 h-9" @click="handleBrowse">
      <Icon name="folder-open" />
      Browse…
    </button>

    <!-- Refresh -->
    <SquareButton
      icon="arrow-rotate-right"
      title="Refresh devices and sounds"
      @click="handleRefresh"
    />
  </div>
</template>
