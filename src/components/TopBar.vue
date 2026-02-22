<script setup>
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
</script>

<template>
  <div class="flex items-center justify-between px-5 py-3.5 bg-bg-deepest border-b border-border shrink-0">
    <div class="flex items-center gap-3">
      <img :src="appIcon" alt="" aria-hidden="true" class="h-9 w-auto" />
      <span class="font-display text-xl text-accent leading-none">
        Rum-Runner Rhapsody<span class="logo-dot"></span>
      </span>
    </div>
    <div class="flex gap-2">
      <button
        class="btn"
        @click="toggleTheme"
        :title="settings.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
      >{{ settings.theme === 'dark' ? '☀' : '☾' }}</button>
      <button class="btn" @click="settingsModalOpen = true">Settings</button>
      <button class="btn" @click="handleRefresh">Refresh</button>
      <button class="btn btn-danger" @click="stopAll">Stop All</button>
    </div>
  </div>
</template>
