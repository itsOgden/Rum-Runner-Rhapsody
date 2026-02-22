import { ref } from 'vue'
import { useSettings } from './useSettings.js'
import { showToast } from '../toastState.js'

// Session-only state — resets on folder change
const showHidden = ref(false)

// Signals which newly-created category should auto-enter rename mode
const pendingRenameId = ref(null)

export function useSoundManagement() {
  const { settings, saveSettings, soundGroups } = useSettings()

  function resetSessionState() {
    showHidden.value = false
  }

  // ── Key helpers ────────────────────────────────────────────────────────────
  // Returns the path of a sound relative to the root sound folder.
  // e.g. "sfx/boom.wav" (subfolder) or "boom.wav" (root-level).
  // Used as the stable identifier in hiddenSounds, soundCategories, etc.

  function getSoundKey(sound) {
    const rootFolder = settings.value.soundFolder || ''
    if (!rootFolder || !sound.path) return sound.filename
    let rel = sound.path
    if (rel.startsWith(rootFolder)) {
      rel = rel.substring(rootFolder.length)
      if (rel.startsWith('/') || rel.startsWith('\\')) rel = rel.slice(1)
    }
    return rel.replace(/\\/g, '/')
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function getAllSoundsMap() {
    const map = {}
    soundGroups.value.forEach(g =>
      g.sounds.forEach(s => {
        const key = getSoundKey(s)
        map[key] = { ...s, key, originalFolder: g.folderName }
      })
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

  function hideSound(key) {
    const hidden = [...new Set([...(settings.value.hiddenSounds || []), key])]
    settings.value.hiddenSounds = hidden
    saveSettings({ hiddenSounds: hidden })
  }

  function restoreSound(key) {
    const hidden = (settings.value.hiddenSounds || []).filter(k => k !== key)
    settings.value.hiddenSounds = hidden
    saveSettings({ hiddenSounds: hidden })
  }

  // ── Custom categories ──────────────────────────────────────────────────────

  function addCategory() {
    const id = `cat_${Date.now()}`
    const cats = [...(settings.value.customCategories || []), { id, name: 'New Category', sounds: [] }]
    settings.value.customCategories = cats
    saveSettings({ customCategories: cats })
    pendingRenameId.value = id
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

  function moveSound(key, targetCategoryId) {
    const sc = { ...(settings.value.soundCategories || {}), [key]: targetCategoryId }
    settings.value.soundCategories = sc
    // Keep customCategories.sounds arrays in sync
    const cats = (settings.value.customCategories || []).map(c => ({
      ...c,
      sounds: c.id === targetCategoryId
        ? [...new Set([...c.sounds, key])]
        : c.sounds.filter(k => k !== key),
    }))
    settings.value.customCategories = cats
    saveSettings({ soundCategories: sc, customCategories: cats })
  }

  function resetSound(key) {
    const sc = { ...(settings.value.soundCategories || {}) }
    delete sc[key]
    const cats = (settings.value.customCategories || []).map(c => ({
      ...c,
      sounds: c.sounds.filter(k => k !== key),
    }))
    const hidden = (settings.value.hiddenSounds || []).filter(k => k !== key)
    settings.value.soundCategories = sc
    settings.value.customCategories = cats
    settings.value.hiddenSounds = hidden
    saveSettings({ soundCategories: sc, customCategories: cats, hiddenSounds: hidden })
  }

  function getSoundCategory(key) {
    return (settings.value.soundCategories || {})[key] ?? null
  }

  // ── Section restore ────────────────────────────────────────────────────────
  // Resets a folder section to defaults: removes custom display name, unhides
  // sounds, and returns any moved sounds back to their original section.

  function restoreSection(sectionId) {
    const group = soundGroups.value.find(g => g.folderName === sectionId)
    if (!group) return

    const soundKeys = group.sounds.map(s => getSoundKey(s))

    const sc = { ...(settings.value.soundCategories || {}) }
    soundKeys.forEach(k => delete sc[k])

    const hidden = (settings.value.hiddenSounds || []).filter(k => !soundKeys.includes(k))

    const cats = (settings.value.customCategories || []).map(c => ({
      ...c,
      sounds: c.sounds.filter(k => !soundKeys.includes(k)),
    }))

    const names = { ...(settings.value.categoryNames || {}) }
    delete names[sectionId]

    settings.value.soundCategories = sc
    settings.value.hiddenSounds = hidden
    settings.value.customCategories = cats
    settings.value.categoryNames = names
    saveSettings({ soundCategories: sc, hiddenSounds: hidden, customCategories: cats, categoryNames: names })
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
        .filter(s => { const k = getSoundKey(s); const c = sc[k]; return !c || c === group.folderName })
        .map(s => {
          const key = getSoundKey(s)
          return {
            ...s,
            key,
            isHidden: hiddenSet.has(key),
            isMoved: false,
            originalFolder: group.folderName,
          }
        })
        .filter(s => showing || !s.isHidden)
      // Fix 1: hide folder sections with no visible sounds
      if (sounds.length === 0) continue
      result.push({
        id: group.folderName,
        displayName: catNames[group.folderName] ?? group.folderName,
        isCustom: false,
        folderPath: group.folderPath,
        sounds,
      })
    }

    // Custom category sections (in creation order)
    // Always included even when empty — they are user-created and manageable.
    for (const cat of customCats) {
      const sounds = Object.entries(sc)
        .filter(([, catId]) => catId === cat.id)
        .map(([key]) => soundMap[key])
        .filter(Boolean)
        .map(s => ({ ...s, isHidden: hiddenSet.has(s.key), isMoved: true }))
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
    pendingRenameId,
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
    restoreSection,
  }
}
