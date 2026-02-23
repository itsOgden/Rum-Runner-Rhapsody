import { ref, computed } from 'vue'
import type { GlobalSettings, SoundGroup, FolderChangeResult } from '../types'

const settings = ref<GlobalSettings>({
  soundFolder: '',
  windowWidth: 960,
  windowHeight: 680,
  theme: 'dark',
  masterVolume: 1.0,
  playbackMode: 'restart',
  density: 'loose',
  primaryDevice: '',
  secondaryDevice: '',
  primaryVolume: 1.0,
  secondaryVolume: 1.0,
  primaryEnabled: true,
  secondaryEnabled: true,
  stopHotkey: 'Escape',
  hiddenSounds: [],
  hiddenSections: [],
  categoryNames: {},
  customCategories: [],
  soundCategories: {},
  collapsedSections: [],
  soundNames: {},
  soundOrder: {},
  categoryOrder: [],
})

const soundGroups = ref<SoundGroup[]>([])
const isLoadingSounds = ref(false)

const soundCount = computed(() =>
  soundGroups.value.reduce((sum, g) => sum + g.sounds.length, 0)
)

export function useSettings() {
  async function loadSettings(): Promise<void> {
    const s = await window.api.getSettings()
    settings.value = s
    await loadSounds()
  }

  async function loadSounds(): Promise<void> {
    isLoadingSounds.value = true
    try {
      soundGroups.value = await window.api.getSounds()
    } finally {
      isLoadingSounds.value = false
    }
  }

  async function saveSettings(partial: Partial<GlobalSettings>): Promise<void> {
    await window.api.saveSettings(partial)
  }

  async function onFolderChanged(result: FolderChangeResult): Promise<void> {
    settings.value.soundFolder = result.folder
    Object.assign(settings.value, result.folderSettings)
    await loadSounds()
  }

  return {
    settings,
    soundGroups,
    soundCount,
    isLoadingSounds,
    loadSettings,
    loadSounds,
    saveSettings,
    onFolderChanged,
  }
}
