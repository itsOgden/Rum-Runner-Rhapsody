import { ref, computed, toRaw } from 'vue'
import type { GlobalSettings, SoundGroup, FolderChangeResult } from '../types'

const settings = ref<GlobalSettings>({
  soundFolder: '',
  windowWidth: 960,
  windowHeight: 680,
  theme: 'dark',
  masterVolume: 1.0,
  density: 'loose',
  devices: [
    { label: '', volume: 1.0, enabled: true },
    { label: '', volume: 1.0, enabled: true },
  ],
  hotkeys: { stop: 'Escape', search: 'Space' },
  playbackMode: 'stop',
  normalize: false,
  streamDeckButtonMode: true,
  streamDeckDefaultImages: {},
  showCategorySidebar: true,
  closeToTray: false,
  autoStart: false,
  launchMinimized: false,
  accentColor: '',
  hiddenSounds: [],
  hiddenCategories: [],
  sectionRenames: {},
  customCategories: [],
  movedSounds: {},
  collapsedCategories: [],
  soundNames: {},
  soundOrder: {},
  categoryOrder: [],
  playCounts: {},
  soundVolumes: {},
  categoryStreamDeckImages: {},
})

const soundGroups = ref<SoundGroup[]>([])
const isLoadingSounds = ref(false)

const soundCount = computed(() =>
  soundGroups.value.reduce((sum, g) => sum + g.sounds.length, 0)
)

export function useSettings() {
  async function loadSettings(): Promise<void> {
    const raw = await window.api.getSettings()
    settings.value = raw
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
    await window.api.saveSettings(toRaw(partial))
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
