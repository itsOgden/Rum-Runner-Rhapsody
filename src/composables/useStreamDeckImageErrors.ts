import { ref } from 'vue'
import type { GlobalSettings } from '../types'

// Module-level singleton — shared across all components.
const brokenCount = ref(0)
const brokenSources = ref<string[]>([])  // deduplicated display labels of affected sources

export function useStreamDeckImageErrors() {
  // Scans all Stream Deck image paths in settings and updates brokenCount / brokenSources.
  // Call on app load and whenever streamDeckDefaultImages or categoryStreamDeckImages change.
  async function scanAll(settings: GlobalSettings): Promise<void> {
    // Build a flat list of (path, sourceLabel) pairs so results can be mapped back to sources.
    const checks: Array<{ path: string; source: string }> = []

    const di = settings.streamDeckDefaultImages
    if (di?.idle)    checks.push({ path: di.idle,    source: 'Default' })
    if (di?.playing) checks.push({ path: di.playing, source: 'Default' })
    if (di?.stop)    checks.push({ path: di.stop,    source: 'Default' })

    for (const [id, entry] of Object.entries(settings.categoryStreamDeckImages || {})) {
      const name = settings.categoryNames?.[id] ?? id
      if (entry?.idle)    checks.push({ path: entry.idle,    source: name })
      if (entry?.playing) checks.push({ path: entry.playing, source: name })
    }

    if (!checks.length) {
      brokenCount.value = 0
      brokenSources.value = []
      return
    }

    const results = await Promise.all(checks.map(c => window.api.readSoundFile(c.path)))

    let count = 0
    const seen = new Set<string>()
    const sources: string[] = []
    for (let i = 0; i < results.length; i++) {
      if (results[i] === null) {
        count++
        const src = checks[i].source
        if (!seen.has(src)) { seen.add(src); sources.push(src) }
      }
    }

    brokenCount.value = count
    brokenSources.value = sources
  }

  return { brokenCount, brokenSources, scanAll }
}
