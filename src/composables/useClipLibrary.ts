import { ref, computed } from 'vue'
import { useSettings } from './useSettings'

export interface ClipFile {
  path: string
  filename: string
  size: number
  mtime: number
}

const clips = ref<ClipFile[]>([])
const selectedClip = ref<ClipFile | null>(null)
const isLoading = ref(false)

export function useClipLibrary() {
  const { settings } = useSettings()

  const folder = computed(() => settings.value.recordingFolder)

  async function refresh(): Promise<void> {
    const f = folder.value
    if (!f) { clips.value = []; return }
    isLoading.value = true
    try {
      clips.value = await window.api.listClipsFolder(f)
    } finally {
      isLoading.value = false
    }
  }

  function selectClip(clip: ClipFile) {
    selectedClip.value = clip
  }

  function selectByPath(path: string) {
    const found = clips.value.find(c => c.path === path)
    if (found) selectedClip.value = found
    else if (clips.value.length > 0) selectedClip.value = clips.value[0]
  }

  async function deleteClip(clip: ClipFile): Promise<boolean> {
    const result = await window.api.trashClipFile(clip.path)
    if (result.success) {
      if (selectedClip.value?.path === clip.path) {
        const idx = clips.value.indexOf(clip)
        selectedClip.value = clips.value[idx + 1] ?? clips.value[idx - 1] ?? null
      }
      await refresh()
    }
    return result.success
  }

  function revealFolder() {
    if (folder.value) window.api.revealInExplorer(folder.value)
  }

  return { clips, selectedClip, isLoading, folder, refresh, selectClip, selectByPath, deleteClip, revealFolder }
}
