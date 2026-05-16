<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue'
import { useSettings } from './composables/useSettings'
import { useAudioDevices } from './composables/useAudioDevices'
import { useAudioPlayer } from './composables/useAudioPlayer'
import { useSoundManagement } from './composables/useSoundManagement'
import { useStreamDeckImageErrors } from './composables/useStreamDeckImageErrors'
import { filterQuery } from './filterState'
import { formatAccelerator } from './utils/hotkey'
import TitleBar from './components/TitleBar.vue'
import FolderBar from './components/FolderBar.vue'
import SoundGrid from './components/SoundGrid.vue'
import StatusBar from './components/StatusBar.vue'
import SettingsModal from './components/SettingsModal.vue'
import HelpModal from './components/HelpModal.vue'
import Toast from './components/Toast.vue'
import FullLogo from '@/assets/images/full-logo.svg'

const { settings, loadSettings, onFolderChanged } = useSettings()
const { refreshDevices } = useAudioDevices()
const { playSound, stopAll } = useAudioPlayer()
const { resetSessionState } = useSoundManagement()
const { scanAll } = useStreamDeckImageErrors()

// Re-scan broken images whenever the image settings change (covers picks, clears, and folder switches).
watch(
  () => [settings.value.streamDeckDefaultImages, settings.value.categoryStreamDeckImages],
  () => scanAll(settings.value),
  { deep: true }
)

const hasSoundFolder = computed(() => !!settings.value.soundFolder)

watch(
  () => settings.value.theme,
  (theme) => {
    document.documentElement.classList.toggle('light', theme === 'light')
  },
  { immediate: true }
)

watch(
  [() => settings.value.accentColor, () => settings.value.theme],
  ([color, theme]) => {
    const el = document.documentElement
    if (color) {
      el.style.setProperty('--color-accent', color)
      el.style.setProperty('--color-accent-dim', darkenHex(color, 0.15))
      if (theme === 'light') {
        el.style.setProperty('--color-accent-text', darkenHex(color, 0.35))
      } else {
        el.style.removeProperty('--color-accent-text')
      }
    } else {
      el.style.removeProperty('--color-accent')
      el.style.removeProperty('--color-accent-dim')
      el.style.removeProperty('--color-accent-text')
    }
  },
  { immediate: true }
)

function darkenHex(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const d = (v: number) => Math.round(v * (1 - factor)).toString(16).padStart(2, '0')
  return `#${d(r)}${d(g)}${d(b)}`
}

function handleKeydown(e: KeyboardEvent): void {
  const combo = formatAccelerator(e)
  if (combo && combo.toLowerCase() === (settings.value.hotkeys?.stop || 'Escape').toLowerCase()) {
    stopAll()
  }
}

async function handlePlaySoundByKey(key: string): Promise<void> {
  if (!key) return
  const foldersToTry: string[] = []
  if (settings.value.soundFolder) foldersToTry.push(settings.value.soundFolder)
  for (const f of settings.value.savedFolders) {
    if (f !== settings.value.soundFolder) foldersToTry.push(f)
  }
  const filename = key.split('/').pop() ?? key
  for (const folder of foldersToTry) {
    const absPath = folder.replace(/[/\\]+$/, '') + '\\' + key.replace(/\//g, '\\')
    const exists = await window.api.checkFileExists(absPath)
    if (exists) {
      const soundNames = folder === settings.value.soundFolder ? (settings.value.soundNames ?? {}) : {}
      const name = soundNames[key] ?? filename.replace(/\.[^.]+$/, '')
      await playSound({ path: absPath, filename, name, key, originalFolder: '', isHidden: false, isMoved: false })
      return
    }
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
  await scanAll(settings.value)
  document.addEventListener('keydown', handleKeydown)

  window.api.onWsPlaySound(({ key }) => handlePlaySoundByKey(key))
  window.api.onGlobalPlaySound(({ key }) => handlePlaySoundByKey(key))

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
        <div class="flex flex-col gap-3">
          <FullLogo class="text-accent" />
          <div class=" text-shadow-text-primary leading-relaxed">
            Choose a folder containing your audio files to get started.
          </div>
        </div>
        <button class="btn btn-accent px-6 py-2 text-sm" @click="handleChooseFolder">
          Choose a sounds folder
        </button>
      </div>
    </template>

    <!-- ── Normal app chrome ─────────────────────────────────────────────── -->
    <template v-else>
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

