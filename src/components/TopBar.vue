<script setup>
import { computed } from 'vue'
import { useAudioDevices } from '../composables/useAudioDevices.js'
import { useAudioPlayer } from '../composables/useAudioPlayer.js'
import { useSettings } from '../composables/useSettings.js'
import { settingsModalOpen } from '../modalState.js'
import appIcon from '../../app-icon.png'

const { refreshDevices } = useAudioDevices()
const { stopAll } = useAudioPlayer()
const { settings, loadSounds, saveSettings } = useSettings()

async function handleRefresh() {
  await refreshDevices()
  await loadSounds()
}

function toggleTheme() {
  const next = settings.value.theme === 'dark' ? 'light' : 'dark'
  settings.value.theme = next
  saveSettings({ theme: next })
}

// Master volume: stored as 0–1 float, displayed as 0–100 integer
const masterPercent = computed({
  get: () => Math.round((settings.value.masterVolume ?? 1.0) * 100),
  set: (v) => { settings.value.masterVolume = v / 100 },
})

function onMasterChange() {
  saveSettings({ masterVolume: settings.value.masterVolume })
}
</script>

<template>
  <div class="flex items-center justify-between px-5 py-3 bg-bg-deepest border-b border-border shrink-0 gap-4">
    <!-- Logo lockup -->
    <div class="flex items-center gap-3 shrink-0">
      <img :src="appIcon" alt="" aria-hidden="true" class="h-9 w-auto" />
      <span class="font-display text-xl text-accent leading-none">
        Rum-Runner Rhapsody<span class="logo-dot"></span>
      </span>
    </div>

    <!-- Master Volume (center) -->
    <div class="flex items-center gap-2.5 flex-1 max-w-xs">
      <span class="font-mono text-[10px] text-text-dim shrink-0 uppercase tracking-wider">Master Volume</span>
      <input
        type="range"
        min="0"
        max="100"
        v-model.number="masterPercent"
        @change="onMasterChange"
        class="flex-1"
      />
      <span class="font-mono text-[11px] text-text-secondary min-w-9 text-right shrink-0">{{ masterPercent }}%</span>
    </div>

    <!-- Controls -->
    <div class="flex gap-2 shrink-0">
      <button
        class="btn"
        @click="toggleTheme"
        :title="settings.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
      >{{ settings.theme === 'dark' ? '☾' : '☀' }}</button>
      <button class="btn" @click="settingsModalOpen = true">Settings</button>
      <button class="btn" @click="handleRefresh">Refresh</button>
      <button class="btn btn-danger" @click="stopAll">Stop All</button>
    </div>
  </div>
</template>
