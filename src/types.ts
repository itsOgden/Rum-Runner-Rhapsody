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

// ── Device settings ────────────────────────────────────────────────────────

export interface DeviceSettings {
  id: string       // device ID used by setSinkId()
  label: string    // human-readable name, used for cross-session matching
  volume: number   // 0–1
  enabled: boolean
}

// ── Settings ───────────────────────────────────────────────────────────────

// Per-folder soundboard settings — stored in rrr-soundboard.json inside the sounds folder
export interface FolderSettings {
  hiddenSounds: string[]
  hiddenCategories: string[]
  categoryNames: Record<string, string>
  customCategories: Array<{ id: string; sounds: string[] }>
  soundCategories: Record<string, string>
  soundNames: Record<string, string>
  soundOrder: Record<string, string[]>
  categoryOrder: string[]
  collapsedCategories: string[]
  playCounts: Record<string, number>
  soundVolumes: Record<string, number>
}

// Global app settings — stored in rrr-settings.json next to the executable
export interface GlobalSettings extends FolderSettings {
  soundFolder: string
  windowWidth: number
  windowHeight: number
  masterVolume: number
  theme: 'dark' | 'light'
  density: 'loose' | 'compact'
  devices: DeviceSettings[]
  hotkeys: { stop: string }
  playbackMode: 'overlap' | 'restart' | 'stop'
  normalize: boolean
  streamDeckButtonMode: boolean
  closeToTray: boolean
  autoStart: boolean
  launchMinimized: boolean
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
  onWsPlaySound(callback: (data: { key: string }) => void): void
  onWsStopAll(callback: () => void): void
  updatePlayingStatus(keys: string[]): void
  installStreamDeckPlugin(): Promise<{ success: boolean; message: string; restartingStreamDeck: boolean }>
  getStreamDeckPluginStatus(): Promise<{ bundledVersion: string; installedVersion: string | null; needsUpdate: boolean; isInstalled: boolean }>
  windowMinimize(): void
  windowMaximize(): void
  windowClose(): void
  windowIsMaximized(): Promise<boolean>
  onWindowMaximized(cb: (isMaximized: boolean) => void): void
  openExternal(url: string): void
}

declare global {
  interface Window {
    api: WindowApi
  }
}
