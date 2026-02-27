<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue'
import { useSettings } from './composables/useSettings'
import { useAudioDevices } from './composables/useAudioDevices'
import { useAudioPlayer } from './composables/useAudioPlayer'
import { useSoundManagement } from './composables/useSoundManagement'
import { filterQuery } from './filterState'
import appIcon from '../app-icon.png'
import TitleBar from './components/TitleBar.vue'
import DevicePanel from './components/DevicePanel.vue'
import FolderBar from './components/FolderBar.vue'
import SoundGrid from './components/SoundGrid.vue'
import StatusBar from './components/StatusBar.vue'
import SettingsModal from './components/SettingsModal.vue'
import HelpModal from './components/HelpModal.vue'
import Toast from './components/Toast.vue'

const { settings, loadSettings, onFolderChanged } = useSettings()
const { refreshDevices } = useAudioDevices()
const { playSound, stopAll } = useAudioPlayer()
const { resetSessionState } = useSoundManagement()

const hasSoundFolder = computed(() => !!settings.value.soundFolder)

watch(
  () => settings.value.theme,
  (theme) => {
    document.documentElement.classList.toggle('light', theme === 'light')
  },
  { immediate: true }
)

function handleKeydown(e: KeyboardEvent): void {
  if (e.key === (settings.value.hotkeys?.stop || 'Escape')) {
    stopAll()
  }
}

async function handleChooseFolder() {
  const result = await window.api.pickFolder()
  if (result) {
    filterQuery.value = ''
    resetSessionState()
    await onFolderChanged(result)
  }
}

onMounted(async () => {
  await loadSettings()
  await refreshDevices()
  document.addEventListener('keydown', handleKeydown)

  window.api.onWsPlaySound(async ({ key }) => {
    const soundFolder = settings.value.soundFolder
    if (!soundFolder || !key) return
    const absPath = soundFolder.replace(/[/\\]+$/, '') + '\\' + key.replace(/\//g, '\\')
    const filename = key.split('/').pop() ?? key
    const name = (settings.value.soundNames ?? {})[key] ?? filename.replace(/\.[^.]+$/, '')
    await playSound({ path: absPath, filename, name, key, originalFolder: '', isHidden: false, isMoved: false })
  })

  window.api.onWsStopAll(() => {
    stopAll()
  })
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="flex flex-col h-screen overflow-hidden">

    <!-- ── Custom titlebar — always visible ──────────────────────────────── -->
    <TitleBar />

    <!-- ── Welcome screen — no folder selected yet ───────────────────────── -->
    <template v-if="!hasSoundFolder">
      <div class="flex-1 flex flex-col items-center justify-center text-center gap-7 px-10">
        <img :src="appIcon" alt="" aria-hidden="true" class="h-[120px] w-auto opacity-90" />
        <div class="flex flex-col gap-2">
          <div class="font-display text-3xl text-accent">Rum-Runner Rhapsody</div>
          <div class="text-[13px] text-text-dim max-w-sm leading-relaxed">
            Choose a folder containing your audio files to get started.
          </div>
        </div>
        <button class="btn btn-accent px-6 py-2 text-[13px]" @click="handleChooseFolder">
          Choose a sounds folder
        </button>
      </div>
    </template>

    <!-- ── Normal app chrome ─────────────────────────────────────────────── -->
    <template v-else>
      <DevicePanel />
      <FolderBar />
      <SoundGrid />
      <StatusBar />
    </template>

    <!-- Overlays always available (toasts, settings, help) -->
    <SettingsModal />
    <HelpModal />
    <Toast />
  </div>
</template>

<style scoped>
</style>
