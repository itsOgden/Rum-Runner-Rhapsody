import { ref, computed } from 'vue'

const settings = ref({
  soundFolder: '',
  windowWidth: 960,
  windowHeight: 680,
  primaryDevice: '',
  secondaryDevice: '',
  primaryVolume: 1.0,
  secondaryVolume: 1.0,
  primaryEnabled: true,
  secondaryEnabled: true,
  columns: 4,
  stopHotkey: 'Escape',
})

const soundGroups = ref([])

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
    soundGroups.value = await window.api.getSounds()
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
    loadSettings,
    loadSounds,
    saveSettings,
    onFolderChanged,
  }
}
