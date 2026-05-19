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
  color?: string
}

// ── Device settings ────────────────────────────────────────────────────────

export interface DeviceSettings {
  label: string    // human-readable name, used for cross-session matching via useAudioDevices
  volume: number   // 0–1
  enabled: boolean
}

// ── Settings ───────────────────────────────────────────────────────────────

// Per-folder soundboard settings — stored in rrr-soundboard.json inside the sounds folder.
// playCounts lives in rrr-stats.json but is merged into this type for renderer transparency.
export interface FolderSettings {
  hiddenSounds: string[]
  hiddenCategories: string[]
  sectionRenames: Record<string, string>                 // display-name overrides for folder sections
  customCategories: Array<{ id: string; name: string }>  // user-created categories
  movedSounds: Record<string, string>                    // soundKey → categoryId for sounds moved from their default section
  soundNames: Record<string, string>
  soundOrder: Record<string, string[]>
  categoryOrder: string[]
  collapsedCategories: string[]
  playCounts: Record<string, number>                     // stored in rrr-stats.json
  soundVolumes: Record<string, number>
  categoryStreamDeckImages: Record<string, { idle?: string; playing?: string }>
  categoryColors: Record<string, string>
  soundHotkeys: Record<string, string>
}

// Global app settings — stored in rrr-settings.json next to the executable
export interface GlobalSettings extends FolderSettings {
  soundFolder: string
  savedFolders: string[]
  folderDisplayNames: Record<string, string>  // path → custom display name (falls back to folder basename)
  windowWidth: number
  windowHeight: number
  masterVolume: number
  theme: 'dark' | 'light'
  density: 'loose' | 'compact'
  devices: DeviceSettings[]
  hotkeys: { stop: string; search: string; saveClip: string }
  playbackMode: 'overlap' | 'restart' | 'stop'
  normalize: boolean
  streamDeckButtonMode: boolean
  streamDeckDefaultImages: { idle?: string; playing?: string; stop?: string }
  showCategorySidebar: boolean
  viewMode: 'accordion' | 'flat'
  closeToTray: boolean
  autoStart: boolean
  launchMinimized: boolean
  blockTypingConflicts: boolean
  accentColor: string
  shadowEnabled: boolean
  recordingInputDeviceLabel: string
  shadowBufferDuration: number
  recordingFolder: string
  clipAutoOpenTrim: boolean
}

// ── Folder-change IPC results ──────────────────────────────────────────────

export interface FolderChangeResult {
  folder: string
  folderSettings: Partial<FolderSettings>
  savedFolders?: string[]
}

export interface FolderRemoveResult {
  savedFolders: string[]
  switched: FolderChangeResult | null
}

// ── Window API (exposed by preload.js via contextBridge) ───────────────────

export interface WindowApi {
  getChangelog(): Promise<string | null>
  getSettings(): Promise<GlobalSettings>
  saveSettings(partial: Partial<GlobalSettings>): Promise<void>
  getSounds(): Promise<SoundGroup[]>
  checkFileExists(path: string): Promise<boolean>
  trashSoundFile(path: string): Promise<void>
  pickFolder(): Promise<FolderChangeResult | null>
  switchFolder(path: string): Promise<FolderChangeResult | null>
  removeFolder(path: string): Promise<FolderRemoveResult>
  pickImage(): Promise<string | null>
  readSoundFile(filePath: string): Promise<ArrayBuffer | null>
  onWsPlaySound(callback: (data: { key: string }) => void): void
  onWsStopAll(callback: () => void): void
  onWsSaveClip(callback: () => void): void
  onWsOpenShadowSettings(callback: () => void): void
  onGlobalPlaySound(callback: (data: { key: string }) => void): void
  onGlobalSaveClip(callback: () => void): void
  onGlobalStopAll(callback: () => void): void
  pickClipsFolder(): Promise<string | null>
  saveShadowClip(data: ArrayBuffer, folder: string): Promise<{ success: boolean; filename?: string; filePath?: string; error?: string }>
  listClipsFolder(folder: string): Promise<Array<{ path: string; filename: string; size: number; mtime: number }>>
  trashClipFile(path: string): Promise<{ success: boolean; error?: string }>
  revealInExplorer(folderPath: string): Promise<void>
  saveExportedClip(data: ArrayBuffer, destFolder: string, filename: string): Promise<{ success: boolean; filePath?: string; filename?: string; error?: string }>
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
