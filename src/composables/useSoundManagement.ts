import { ref } from 'vue'
import { useSettings } from './useSettings'
import { showToast } from '../toastState'
import type { Sound, SoundSection, RawSound } from '../types'

// Session-only state — resets on folder change
const showHidden = ref(false)

// Signals which newly-created category should auto-enter rename mode
const pendingRenameId = ref<string | null>(null)

// Section IDs whose settings modal is currently open — kept in the rendered list
// even when hidden so the modal component is not unmounted mid-interaction.
const pinnedSectionIds = ref<Set<string>>(new Set())

export function useSoundManagement() {
  const { settings, saveSettings, soundGroups } = useSettings()

  function resetSessionState(): void {
    showHidden.value = false
  }

  // ── Key helpers ────────────────────────────────────────────────────────────
  // Returns the path of a sound relative to the root sound folder.
  // e.g. "sfx/boom.wav" (subfolder) or "boom.wav" (root-level).
  // Used as the stable identifier in hiddenSounds, soundCategories, etc.

  function getSoundKey(sound: RawSound): string {
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

  function getAllSoundsMap(): Record<string, Sound> {
    const map: Record<string, Sound> = {}
    soundGroups.value.forEach(g =>
      g.sounds.forEach(s => {
        const key = getSoundKey(s)
        map[key] = { ...s, key, originalFolder: g.folderName, isHidden: false, isMoved: false }
      })
    )
    return map
  }

  // Returns all sections as { id, name } for the "Move to…" picker.
  // Optionally excludes the section the sound currently lives in.
  function getAvailableCategories(excludeId: string | null = null): Array<{ id: string; name: string }> {
    const cats: Array<{ id: string; name: string }> = []
    const sectionRenames = settings.value.sectionRenames || {}
    soundGroups.value.forEach(g => {
      if (g.folderName !== excludeId)
        cats.push({ id: g.folderName, name: sectionRenames[g.folderName] ?? g.folderName })
    })
    ;(settings.value.customCategories || []).forEach(c => {
      if (c.id !== excludeId)
        cats.push({ id: c.id, name: c.name })
    })
    return cats
  }

  // ── Category display names ─────────────────────────────────────────────────

  function getCategoryDisplayName(sectionId: string, fallback = sectionId): string {
    const customCat = (settings.value.customCategories || []).find(c => c.id === sectionId)
    if (customCat) return customCat.name
    return (settings.value.sectionRenames || {})[sectionId] ?? fallback
  }

  function renameCategory(sectionId: string, newName: string): void {
    const trimmed = newName.trim()
    if (!trimmed) return
    const isCustom = (settings.value.customCategories || []).some(c => c.id === sectionId)
    if (isCustom) {
      const cats = (settings.value.customCategories || []).map(c =>
        c.id === sectionId ? { ...c, name: trimmed } : c
      )
      settings.value.customCategories = cats
      saveSettings({ customCategories: cats })
    } else {
      const renames = { ...(settings.value.sectionRenames || {}), [sectionId]: trimmed }
      settings.value.sectionRenames = renames
      saveSettings({ sectionRenames: renames })
    }
  }

  // ── Sound display names ────────────────────────────────────────────────────

  function getSoundDisplayName(key: string, fallback: string): string {
    return (settings.value.soundNames || {})[key] ?? fallback
  }

  function renameSound(key: string, newName: string): void {
    const trimmed = newName.trim()
    const names: Record<string, string> = { ...(settings.value.soundNames || {}), [key]: trimmed }
    // Remove entry entirely if name is cleared (revert to filename)
    if (!trimmed) delete names[key]
    settings.value.soundNames = names
    saveSettings({ soundNames: names })
  }

  // ── Hidden sounds ──────────────────────────────────────────────────────────

  function hideSound(key: string): void {
    const hidden = [...new Set([...(settings.value.hiddenSounds || []), key])]
    settings.value.hiddenSounds = hidden
    saveSettings({ hiddenSounds: hidden })
  }

  function restoreSound(key: string): void {
    const hidden = (settings.value.hiddenSounds || []).filter(k => k !== key)
    settings.value.hiddenSounds = hidden
    saveSettings({ hiddenSounds: hidden })
  }

  // ── Hidden categories ──────────────────────────────────────────────────────

  function hideSection(sectionId: string): void {
    const hidden = [...new Set([...(settings.value.hiddenCategories || []), sectionId])]
    settings.value.hiddenCategories = hidden
    saveSettings({ hiddenCategories: hidden })
  }

  function unhideSection(sectionId: string): void {
    const hidden = (settings.value.hiddenCategories || []).filter(id => id !== sectionId)
    settings.value.hiddenCategories = hidden
    saveSettings({ hiddenCategories: hidden })
  }

  // ── Custom categories ──────────────────────────────────────────────────────

  function addCategory(): string {
    const id = `cat_${Date.now()}`
    const cats = [...(settings.value.customCategories || []), { id, name: 'New Category' }]
    settings.value.customCategories = cats
    saveSettings({ customCategories: cats })
    pendingRenameId.value = id
    return id
  }

  function deleteCategory(categoryId: string): boolean {
    const sc = settings.value.movedSounds || {}
    if (Object.values(sc).some(v => v === categoryId)) {
      showToast('Cannot delete a non-empty category. Move or reset its sounds first.')
      return false
    }
    const cats = (settings.value.customCategories || []).filter(c => c.id !== categoryId)
    const hiddenCats = (settings.value.hiddenCategories || []).filter(id => id !== categoryId)
    const catOrder = (settings.value.categoryOrder || []).filter(id => id !== categoryId)
    settings.value.customCategories = cats
    settings.value.hiddenCategories = hiddenCats
    settings.value.categoryOrder = catOrder
    saveSettings({ customCategories: cats, hiddenCategories: hiddenCats, categoryOrder: catOrder })
    return true
  }

  // ── Sound categories (move / reset) ────────────────────────────────────────

  function moveSound(key: string, targetCategoryId: string): void {
    const movedSounds = { ...(settings.value.movedSounds || {}), [key]: targetCategoryId }
    settings.value.movedSounds = movedSounds
    saveSettings({ movedSounds })
  }

  function resetSound(key: string): void {
    const movedSounds = { ...(settings.value.movedSounds || {}) }
    delete movedSounds[key]
    const hidden = (settings.value.hiddenSounds || []).filter(k => k !== key)
    const soundOrder = { ...(settings.value.soundOrder || {}) }
    for (const sectionId of Object.keys(soundOrder)) {
      soundOrder[sectionId] = soundOrder[sectionId].filter(k => k !== key)
      if (soundOrder[sectionId].length === 0) delete soundOrder[sectionId]
    }
    settings.value.movedSounds = movedSounds
    settings.value.hiddenSounds = hidden
    settings.value.soundOrder = soundOrder
    saveSettings({ movedSounds, hiddenSounds: hidden, soundOrder })
  }

  function getSoundCategory(key: string): string | null {
    return (settings.value.movedSounds || {})[key] ?? null
  }

  // ── Category colors ────────────────────────────────────────────────────────

  function setCategoryColor(sectionId: string, color: string | null): void {
    const colors = { ...(settings.value.categoryColors || {}) }
    if (color) {
      colors[sectionId] = color
    } else {
      delete colors[sectionId]
    }
    settings.value.categoryColors = colors
    saveSettings({ categoryColors: colors })
  }

  // ── Section restore ────────────────────────────────────────────────────────
  // Resets a folder section to defaults: removes custom display name, unhides
  // the section, unhides its sounds, and returns any moved sounds back.

  function restoreSection(sectionId: string): void {
    const group = soundGroups.value.find(g => g.folderName === sectionId)
    if (!group) return

    const soundKeys = group.sounds.map(s => getSoundKey(s))

    const movedSounds = { ...(settings.value.movedSounds || {}) }
    soundKeys.forEach(k => delete movedSounds[k])

    const hidden = (settings.value.hiddenSounds || []).filter(k => !soundKeys.includes(k))

    const sectionRenames = { ...(settings.value.sectionRenames || {}) }
    delete sectionRenames[sectionId]

    const hiddenCats = (settings.value.hiddenCategories || []).filter(id => id !== sectionId)

    const soundOrder = { ...(settings.value.soundOrder || {}) }
    delete soundOrder[sectionId]

    settings.value.movedSounds = movedSounds
    settings.value.hiddenSounds = hidden
    settings.value.sectionRenames = sectionRenames
    settings.value.hiddenCategories = hiddenCats
    settings.value.soundOrder = soundOrder
    saveSettings({ movedSounds, hiddenSounds: hidden, sectionRenames, hiddenCategories: hiddenCats, soundOrder })
  }

  // ── Collapse state ─────────────────────────────────────────────────────────

  function isCollapsedSection(sectionId: string): boolean {
    return (settings.value.collapsedCategories || []).includes(sectionId)
  }

  function setCollapsedSection(sectionId: string, isCollapsed: boolean): void {
    const current = settings.value.collapsedCategories || []
    const next = isCollapsed
      ? (current.includes(sectionId) ? current : [...current, sectionId])
      : current.filter(id => id !== sectionId)
    settings.value.collapsedCategories = next
    saveSettings({ collapsedCategories: next })
  }

  // ── Sound / category ordering ──────────────────────────────────────────────

  // Persists a new manual sort order for sounds within a section.
  // orderedKeys should contain the sound keys in their desired display order.
  function reorderSoundsInSection(sectionId: string, orderedKeys: string[]): void {
    // Build a plain object with plain arrays. After a previous save, existing entries
    // in settings.value.soundOrder are reactive Array Proxies (Vue re-wraps on every
    // assignment). The Electron IPC structured-clone serializer cannot serialize Proxies,
    // so the second+ section always fails. Spreading each value with [...v] converts
    // reactive Array Proxies back to plain arrays before the IPC call.
    const existing = settings.value.soundOrder || {}
    const soundOrder: Record<string, string[]> = {}
    for (const k of Object.keys(existing)) {
      soundOrder[k] = [...existing[k]]
    }
    soundOrder[sectionId] = orderedKeys
    settings.value.soundOrder = soundOrder
    saveSettings({ soundOrder })
  }

  // Persists a new manual sort order for categories (section IDs).
  function reorderCategories(orderedIds: string[]): void {
    settings.value.categoryOrder = orderedIds
    saveSettings({ categoryOrder: orderedIds })
  }

  // ── Section building (called inside SoundGrid's computed) ──────────────────
  // Reads reactive state so calling it inside computed() tracks dependencies.

  // Sorts a sounds array in-place using the saved soundOrder for that section.
  // Keys listed in soundOrder come first (in order); remaining sounds sort alphabetically.
  function applySoundOrder(sounds: Sound[], sectionId: string): void {
    const order = (settings.value.soundOrder || {})[sectionId] || []
    if (order.length > 0) {
      const indexMap = new Map(order.map((k, i) => [k, i]))
      sounds.sort((a, b) => {
        const ia = indexMap.has(a.key) ? indexMap.get(a.key)! : Infinity
        const ib = indexMap.has(b.key) ? indexMap.get(b.key)! : Infinity
        if (ia !== ib) return ia - ib
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      })
    } else {
      sounds.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    }
  }

  function buildSections(): SoundSection[] {
    const sc = settings.value.movedSounds || {}
    const hiddenSet = new Set(settings.value.hiddenSounds || [])
    const hiddenCategoriesSet = new Set(settings.value.hiddenCategories || [])
    const customCats = settings.value.customCategories || []
    const sectionRenames = settings.value.sectionRenames || {}
    const soundNames = settings.value.soundNames || {}
    const categoryColors = settings.value.categoryColors || {}
    const showing = showHidden.value
    const soundMap = getAllSoundsMap()
    const result: SoundSection[] = []

    // Original folder sections (in discovery order)
    for (const group of soundGroups.value) {
      const isHidden = hiddenCategoriesSet.has(group.folderName)
      if (!showing && isHidden && !pinnedSectionIds.value.has(group.folderName)) continue

      // Sounds originally in this group that haven't been moved away
      const nativeKeys = new Set(group.sounds.map(s => getSoundKey(s)))
      const nativeSounds: Sound[] = group.sounds
        .filter(s => { const k = getSoundKey(s); const c = sc[k]; return !c || c === group.folderName })
        .map(s => {
          const key = getSoundKey(s)
          return { ...s, key, name: soundNames[key] ?? s.name, isHidden: hiddenSet.has(key), isMoved: false, originalFolder: group.folderName }
        })

      // sounds from other groups explicitly moved to this folder section
      const movedInSounds: Sound[] = Object.entries(sc)
        .filter(([key, catId]) => catId === group.folderName && !nativeKeys.has(key))
        .map(([key]) => soundMap[key])
        .filter((s): s is Sound => Boolean(s))
        .map(s => ({ ...s, name: soundNames[s.key] ?? s.name, isHidden: hiddenSet.has(s.key), isMoved: true }))

      const sounds = [...nativeSounds, ...movedInSounds]
        .filter(s => showing || !s.isHidden)

      applySoundOrder(sounds, group.folderName)

      result.push({
        id: group.folderName,
        displayName: sectionRenames[group.folderName] ?? group.folderName,
        isCustom: false,
        isHidden,
        folderPath: group.folderPath,
        color: categoryColors[group.folderName] || undefined,
        sounds,
      })
    }

    // Custom category sections (in creation order)
    for (const cat of customCats) {
      const isHidden = hiddenCategoriesSet.has(cat.id)
      if (!showing && isHidden && !pinnedSectionIds.value.has(cat.id)) continue

      const sounds: Sound[] = Object.entries(sc)
        .filter(([, catId]) => catId === cat.id)
        .map(([key]) => soundMap[key])
        .filter((s): s is Sound => Boolean(s))
        .map(s => ({ ...s, name: soundNames[s.key] ?? s.name, isHidden: hiddenSet.has(s.key), isMoved: true }))
        .filter(s => showing || !s.isHidden)

      applySoundOrder(sounds, cat.id)

      result.push({
        id: cat.id,
        displayName: cat.name,
        isCustom: true,
        isHidden,
        color: categoryColors[cat.id] || undefined,
        sounds,
      })
    }

    // Apply manual category order if set; default is already correct
    // (folder sections alphabetically, then custom categories in creation order).
    const categoryOrder = settings.value.categoryOrder || []
    if (categoryOrder.length > 0) {
      const indexMap = new Map(categoryOrder.map((id, i) => [id, i]))
      result.sort((a, b) => {
        const ia = indexMap.has(a.id) ? indexMap.get(a.id)! : Infinity
        const ib = indexMap.has(b.id) ? indexMap.get(b.id)! : Infinity
        return ia - ib
        // Sections not in categoryOrder keep their relative position at the end
      })
    }

    return result
  }

  return {
    showHidden,
    pendingRenameId,
    pinnedSectionIds,
    resetSessionState,
    getAvailableCategories,
    getCategoryDisplayName,
    renameCategory,
    setCategoryColor,
    getSoundDisplayName,
    renameSound,
    hideSound,
    restoreSound,
    hideSection,
    unhideSection,
    addCategory,
    deleteCategory,
    moveSound,
    resetSound,
    getSoundCategory,
    isCollapsedSection,
    setCollapsedSection,
    buildSections,
    restoreSection,
    reorderSoundsInSection,
    reorderCategories,
  }
}
