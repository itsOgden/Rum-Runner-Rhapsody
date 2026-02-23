// ── Raw data from Electron IPC ─────────────────────────────────────────────

export interface RawSound {
  path: string
  filename: string
  name: string
}

export interface SoundGroup {
  folderName: string
  folderPath: string
  sounds: RawSound[]
}

// ── Processed / enriched sound (built by useSoundManagement) ──────────────

export interface Sound {
  key: string
  path: string
  filename: string
  name: string
  isMoved: boolean
  isHidden: boolean
  originalFolder: string
}

// ── Section returned by buildSections() ───────────────────────────────────

export interface SoundSection {
  id: string
  displayName: string
  sounds: Sound[]
  isHidden: boolean
  isCustom: boolean
  folderPath?: string
}

// ── Settings ───────────────────────────────────────────────────────────────

export interface FolderSettings {
  primaryDevice: string
  secondaryDevice: string
  primaryVolume: number
  secondaryVolume: number
  primaryEnabled: boolean
  secondaryEnabled: boolean
  stopHotkey: string
  hiddenSounds: string[]
  hiddenSections: string[]
  categoryNames: Record<string, string>
  customCategories: Array<{ id: string; name: string; sounds: string[] }>
  soundCategories: Record<string, string>
  soundNames: Record<string, string>
  soundOrder: Record<string, string[]>
  categoryOrder: string[]
  collapsedSections: string[]
  playbackMode: 'overlap' | 'restart' | 'stop'
  density: 'loose' | 'compact'
  theme: 'dark' | 'light'
}

export interface GlobalSettings extends FolderSettings {
  soundFolder: string
  masterVolume: number
  windowWidth: number
  windowHeight: number
}

// ── Folder-change IPC result ───────────────────────────────────────────────

export interface FolderChangeResult {
  folder: string
  folderSettings: Partial<FolderSettings>
}

// ── Window API (exposed by preload.js via contextBridge) ───────────────────

export interface WindowApi {
  getSettings(): Promise<GlobalSettings>
  saveSettings(partial: Partial<GlobalSettings>): Promise<void>
  getSounds(): Promise<SoundGroup[]>
  pickFolder(): Promise<FolderChangeResult | null>
  readSoundFile(filePath: string): Promise<ArrayBuffer | null>
}

declare global {
  interface Window {
    api: WindowApi
  }
}
