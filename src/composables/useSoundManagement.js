import { ref, computed } from 'vue'
import { useSettings } from './useSettings.js'
import { showToast } from '../toastState.js'

// Session-only state — resets on folder change
const showHidden = ref(false)

export function useSoundManagement() {
  const { settings, saveSettings, soundGroups } = useSettings()

  function resetSessionState() {
    showHidden.value = false
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function getAllSoundsMap() {
    const map = {}
    soundGroups.value.forEach(g =>
      g.sounds.forEach(s => { map[s.filename] = { ...s, originalFolder: g.folderName } })
    )
    return map
  }

  // Returns all sections as { id, name } for the "Move to…" picker.
  // Optionally excludes the section the sound currently lives in.
  function getAvailableCategories(excludeId = null) {
    const cats = []
    soundGroups.value.forEach(g => {
      if (g.folderName !== excludeId)
        cats.push({ id: g.folderName, name: getCategoryDisplayName(g.folderName, g.folderName) })
    })
    ;(settings.value.customCategories || []).forEach(c => {
      if (c.id !== excludeId)
        cats.push({ id: c.id, name: getCategoryDisplayName(c.id, c.name) })
    })
    return cats
  }

  // ── Category display names ─────────────────────────────────────────────────

  function getCategoryDisplayName(sectionId, fallback = sectionId) {
    return (settings.value.categoryNames || {})[sectionId] ?? fallback
  }

  function renameCategory(sectionId, newName) {
    const trimmed = newName.trim()
    if (!trimmed) return
    const names = { ...(settings.value.categoryNames || {}), [sectionId]: trimmed }
    settings.value.categoryNames = names
    saveSettings({ categoryNames: names })
  }

  // ── Hidden sounds ──────────────────────────────────────────────────────────

  function hideSound(filename) {
    const hidden = [...new Set([...(settings.value.hiddenSounds || []), filename])]
    settings.value.hiddenSounds = hidden
    saveSettings({ hiddenSounds: hidden })
  }

  function restoreSound(filename) {
    const hidden = (settings.value.hiddenSounds || []).filter(f => f !== filename)
    settings.value.hiddenSounds = hidden
    saveSettings({ hiddenSounds: hidden })
  }

  // ── Custom categories ──────────────────────────────────────────────────────

  function addCategory() {
    const id = `cat_${Date.now()}`
    const cats = [...(settings.value.customCategories || []), { id, name: 'New Category', sounds: [] }]
    settings.value.customCategories = cats
    saveSettings({ customCategories: cats })
    return id
  }

  function deleteCategory(categoryId) {
    const sc = settings.value.soundCategories || {}
    if (Object.values(sc).some(v => v === categoryId)) {
      showToast('Cannot delete a non-empty category. Move or reset its sounds first.')
      return false
    }
    const cats = (settings.value.customCategories || []).filter(c => c.id !== categoryId)
    const names = { ...(settings.value.categoryNames || {}) }
    delete names[categoryId]
    settings.value.customCategories = cats
    settings.value.categoryNames = names
    saveSettings({ customCategories: cats, categoryNames: names })
    return true
  }

  // ── Sound categories (move / reset) ────────────────────────────────────────

  function moveSound(filename, targetCategoryId) {
    const sc = { ...(settings.value.soundCategories || {}), [filename]: targetCategoryId }
    settings.value.soundCategories = sc
    // Keep customCategories.sounds arrays in sync
    const cats = (settings.value.customCategories || []).map(c => ({
      ...c,
      sounds: c.id === targetCategoryId
        ? [...new Set([...c.sounds, filename])]
        : c.sounds.filter(f => f !== filename),
    }))
    settings.value.customCategories = cats
    saveSettings({ soundCategories: sc, customCategories: cats })
  }

  function resetSound(filename) {
    const sc = { ...(settings.value.soundCategories || {}) }
    delete sc[filename]
    const cats = (settings.value.customCategories || []).map(c => ({
      ...c,
      sounds: c.sounds.filter(f => f !== filename),
    }))
    const hidden = (settings.value.hiddenSounds || []).filter(f => f !== filename)
    settings.value.soundCategories = sc
    settings.value.customCategories = cats
    settings.value.hiddenSounds = hidden
    saveSettings({ soundCategories: sc, customCategories: cats, hiddenSounds: hidden })
  }

  function getSoundCategory(filename) {
    return (settings.value.soundCategories || {})[filename] ?? null
  }

  // ── Collapse state ─────────────────────────────────────────────────────────

  function isCollapsedSection(sectionId) {
    return (settings.value.collapsedSections || []).includes(sectionId)
  }

  function setCollapsedSection(sectionId, isCollapsed) {
    const current = settings.value.collapsedSections || []
    const next = isCollapsed
      ? (current.includes(sectionId) ? current : [...current, sectionId])
      : current.filter(id => id !== sectionId)
    settings.value.collapsedSections = next
    saveSettings({ collapsedSections: next })
  }

  // ── Section building (called inside SoundGrid's computed) ──────────────────
  // Reads reactive state so calling it inside computed() tracks dependencies.

  function buildSections() {
    const sc = settings.value.soundCategories || {}
    const hiddenSet = new Set(settings.value.hiddenSounds || [])
    const customCats = settings.value.customCategories || []
    const catNames = settings.value.categoryNames || {}
    const showing = showHidden.value
    const soundMap = getAllSoundsMap()
    const result = []

    // Original folder sections (in discovery order)
    for (const group of soundGroups.value) {
      const sounds = group.sounds
        .filter(s => { const c = sc[s.filename]; return !c || c === group.folderName })
        .map(s => ({
          ...s,
          isHidden: hiddenSet.has(s.filename),
          isMoved: false,
          originalFolder: group.folderName,
        }))
        .filter(s => showing || !s.isHidden)
      result.push({
        id: group.folderName,
        displayName: catNames[group.folderName] ?? group.folderName,
        isCustom: false,
        folderPath: group.folderPath,
        sounds,
      })
    }

    // Custom category sections (in creation order)
    for (const cat of customCats) {
      const sounds = Object.entries(sc)
        .filter(([, catId]) => catId === cat.id)
        .map(([filename]) => soundMap[filename])
        .filter(Boolean)
        .map(s => ({ ...s, isHidden: hiddenSet.has(s.filename), isMoved: true }))
        .filter(s => showing || !s.isHidden)
      result.push({
        id: cat.id,
        displayName: catNames[cat.id] ?? cat.name,
        isCustom: true,
        sounds,
      })
    }

    return result
  }

  return {
    showHidden,
    resetSessionState,
    getAvailableCategories,
    getCategoryDisplayName,
    renameCategory,
    hideSound,
    restoreSound,
    addCategory,
    deleteCategory,
    moveSound,
    resetSound,
    getSoundCategory,
    isCollapsedSection,
    setCollapsedSection,
    buildSections,
  }
}
