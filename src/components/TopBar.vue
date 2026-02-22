<script setup>
import { useAudioDevices } from '../composables/useAudioDevices.js'
import { useAudioPlayer } from '../composables/useAudioPlayer.js'
import { useSettings } from '../composables/useSettings.js'
import { settingsModalOpen } from '../modalState.js'

const { refreshDevices } = useAudioDevices()
const { stopAll } = useAudioPlayer()
const { loadSounds } = useSettings()

async function handleRefresh() {
  await refreshDevices()
  await loadSounds()
}
</script>

<template>
  <div class="flex items-center justify-between px-5 py-3.5 bg-bg-deepest border-b border-border shrink-0">
    <div class="flex items-center gap-3">
      <span class="font-mono font-bold text-lg tracking-widest text-accent uppercase">
        RUM-RUNNER<span class="logo-dot"></span>
      </span>
    </div>
    <div class="flex gap-2">
      <button class="btn" @click="settingsModalOpen = true">Settings</button>
      <button class="btn" @click="handleRefresh">Refresh</button>
      <button class="btn btn-danger" @click="stopAll">Stop All</button>
    </div>
  </div>
</template>
