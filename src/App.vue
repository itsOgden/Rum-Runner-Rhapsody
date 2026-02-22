<script setup>
import { onMounted, onUnmounted, watch } from 'vue'
import { useSettings } from './composables/useSettings.js'
import { useAudioDevices } from './composables/useAudioDevices.js'
import { useAudioPlayer } from './composables/useAudioPlayer.js'
import TopBar from './components/TopBar.vue'
import DevicePanel from './components/DevicePanel.vue'
import FolderBar from './components/FolderBar.vue'
import SoundGrid from './components/SoundGrid.vue'
import StatusBar from './components/StatusBar.vue'
import SettingsModal from './components/SettingsModal.vue'
import Toast from './components/Toast.vue'

const { settings, loadSettings } = useSettings()
const { refreshDevices } = useAudioDevices()
const { stopAll } = useAudioPlayer()

watch(
  () => settings.value.theme,
  (theme) => {
    document.documentElement.classList.toggle('light', theme === 'light')
  },
  { immediate: true }
)

function handleKeydown(e) {
  if (e.key === (settings.value.stopHotkey || 'Escape')) {
    stopAll()
  }
}

onMounted(async () => {
  await loadSettings()
  await refreshDevices()
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="flex flex-col h-screen overflow-hidden">
    <TopBar />
    <DevicePanel />
    <FolderBar />
    <SoundGrid />
    <StatusBar />
    <SettingsModal />
    <Toast />
  </div>
</template>
