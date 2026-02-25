<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue'
import { useSettings } from './composables/useSettings'
import { useAudioDevices } from './composables/useAudioDevices'
import { useAudioPlayer } from './composables/useAudioPlayer'
import { useSoundManagement } from './composables/useSoundManagement'
import { filterQuery } from './filterState'
import appIcon from '../app-icon.png'
import TopBar from './components/TopBar.vue'
import DevicePanel from './components/DevicePanel.vue'
import FolderBar from './components/FolderBar.vue'
import SoundGrid from './components/SoundGrid.vue'
import StatusBar from './components/StatusBar.vue'
import SettingsModal from './components/SettingsModal.vue'
import Toast from './components/Toast.vue'

const { settings, loadSettings, onFolderChanged } = useSettings()
const { refreshDevices } = useAudioDevices()
const { stopAll } = useAudioPlayer()
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
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="flex flex-col h-screen overflow-hidden">

    <!-- ── Welcome screen — no folder selected yet ───────────────────────── -->
    <template v-if="!hasSoundFolder">
      <div class="flex-1 flex flex-col items-center justify-center text-center gap-7 px-10">
        <img :src="appIcon" alt="" aria-hidden="true" class="h-[120px] w-auto opacity-90" />
        <div class="flex flex-col gap-2">
          <div class="font-display text-3xl text-accent">Rum-Runner Rhapsody<span class="logo-dot"></span></div>
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
      <TopBar />
      <DevicePanel />
      <FolderBar />
      <SoundGrid />
      <StatusBar />
    </template>

    <!-- Overlays always available (toasts, settings) -->
    <SettingsModal />
    <Toast />
  </div>
</template>

<style scoped>
/* logo-dot is also used in TopBar.vue — duplicated here for the welcome screen */
@keyframes pulse-dot {
  0%, 100% { opacity: 1; box-shadow: 0 0 8px var(--color-accent-glow); }
  50% { opacity: 0.5; box-shadow: 0 0 4px var(--color-accent-glow); }
}

.logo-dot {
  display: inline-block;
  width: 8px; height: 8px;
  background: var(--color-accent);
  border-radius: 50%;
  margin-left: 4px;
  box-shadow: 0 0 8px var(--color-accent-glow);
  animation: pulse-dot 2s ease-in-out infinite;
}
</style>
