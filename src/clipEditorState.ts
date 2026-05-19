import { ref } from 'vue'

// Full-tab editor — replaces the sound grid
export const clipEditorOpen = ref(false)

// Quick-trim sidebar — sits in layout beside the sound grid
export const trimSidebarOpen = ref(false)
export const trimSidebarFile = ref<string | null>(null) // path to auto-select on open

// Per-clip edit state, survives editor open/close cycles; cleared on export/delete/reset
export interface ClipEditState {
  filename: string
  exportFolder: string
  deleteAfterExport: boolean
  inPoint: number
  outPoint: number
  hasSelection: boolean
}
export const clipEditStates = new Map<string, ClipEditState>()
