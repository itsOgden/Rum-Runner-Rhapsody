import { ref, computed } from 'vue'

const settings = ref({
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
  categoryNames: {},
  customCategories: [],
  soundCategories: {},
  collapsedSections: [],
})

const soundGroups = ref([])
const isLoadingSounds = ref(false)

const soundCount = computed(() =>
  soundGroups.value.reduce((sum, g) => sum + g.sounds.length, 0)
)

export function useSettings() {
  async function loadSettings() {
    const s = await window.api.getSettings()
    settings.value = s
    await loadSounds()
  }

  async function loadSounds() {
    isLoadingSounds.value = true
    try {
      soundGroups.value = await window.api.getSounds()
    } finally {
      isLoadingSounds.value = false
    }
  }

  async function saveSettings(partial) {
    const merged = await window.api.saveSettings(partial)
    Object.assign(settings.value, merged)
  }

  async function onFolderChanged(result) {
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
