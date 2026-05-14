<script setup lang="ts">
import { computed } from 'vue'
import { useSettings } from '../composables/useSettings'
import { useAudioDevices } from '../composables/useAudioDevices'
import { useSoundManagement } from '../composables/useSoundManagement'
import { useStreamDeckImageErrors } from '../composables/useStreamDeckImageErrors'
import { filterQuery } from '../filterState'
import CircleButton from '@/components/CircleButton.vue'
import Icon from '@/components/Icon.vue'

const { settings, onFolderChanged, saveSettings, loadSounds } = useSettings()
const { refreshDevices } = useAudioDevices()
const { showHidden, resetSessionState } = useSoundManagement()
const { scanAll } = useStreamDeckImageErrors()

const folderName = computed(() => {
  if (!settings.value.soundFolder) return null
  return settings.value.soundFolder.split(/[\\/]/).filter(Boolean).pop() ?? null
})

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

function setDensity(val: 'loose' | 'compact') {
  if (settings.value.density === val) return
  settings.value.density = val
  saveSettings({ density: val })
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-1.5 bg-bg-base border-b border-border-light shrink-0 md:grid md:grid-cols-3 md:gap-3">

    <!-- Left: browse action + soundboard name + refresh -->
    <div class="flex items-center gap-2">
      <button class="btn btn-accent flex items-center gap-1.5 h-9" @click="handleBrowse">
        <Icon name="folder-open" />
        Browse…
      </button>
      <span
        class="text-sm font-medium truncate max-w-50"
        :class="folderName ? 'text-text-primary' : 'text-text-dim'"
      >{{ folderName ?? 'No soundboard' }}</span>
      <button class="toolbar-icon-btn" title="Refresh devices and sounds" @click="handleRefresh">
        <Icon name="arrow-rotate-right" />
      </button>
    </div>

    <!-- Center: search — own row below md, centered column at md+ -->
    <div class="relative flex items-center w-full order-last md:order-0 md:w-96 max-w-full md:mx-auto">
      <input
        type="text"
        v-model="filterQuery"
        placeholder="Search sounds…"
        class="w-full font-sans text-sm bg-bg-surface border border-border-light pl-3 pr-7 h-9 text-text-primary placeholder:text-text-dim outline-none focus:border-accent transition-colors"
      />
      <CircleButton
        v-if="filterQuery"
        icon="xmark-solid"
        title="Clear search"
        class="absolute right-2"
        @click="filterQuery = ''"
      />
    </div>

    <!-- Right: view controls -->
    <div class="flex items-center gap-3 ml-auto md:ml-0 md:justify-end text-xs select-none">

      <!-- Density -->
      <div class="flex items-center gap-1.5">
        <button
          class="transition-colors cursor-pointer outline-none"
          :class="settings.density !== 'compact' ? 'text-text-primary font-medium' : 'text-text-dim hover:text-text-secondary'"
          @click="setDensity('loose')"
        >Loose</button>
        <span class="text-text-dim">·</span>
        <button
          class="transition-colors cursor-pointer outline-none"
          :class="settings.density === 'compact' ? 'text-text-primary font-medium' : 'text-text-dim hover:text-text-secondary'"
          @click="setDensity('compact')"
        >Compact</button>
      </div>

      <!-- Divider -->
      <span class="w-px h-3.5 bg-border-light shrink-0" aria-hidden="true" />

      <!-- Show hidden toggle -->
      <button
        class="flex items-center gap-1 transition-colors cursor-pointer outline-none"
        :class="showHidden ? 'text-accent' : 'text-text-dim hover:text-text-secondary'"
        :title="showHidden ? 'Hide hidden sounds' : 'Show hidden sounds'"
        @click="toggleShowHidden"
      >
        <Icon :name="showHidden ? 'eye' : 'eye-slash'" class="text-[11px]" />
        Show hidden
      </button>

    </div>

  </div>
</template>
