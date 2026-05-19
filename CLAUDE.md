# Rum-Runner Rhapsody — Claude Project Document

## Keeping This File Current

**Updating this document is the last step of every task.** Do not consider a task complete until relevant sections reflect the current state — architecture changes, new files, IPC handlers, settings fields, component behaviors. If nothing changed, that's fine, but check first.

---

## What This Project Is

Rum-Runner Rhapsody (RRR) is a **dual-output Windows soundboard application** built with Electron, Vue 3, and TypeScript. It plays audio simultaneously to two output devices — typically headphones and a virtual audio cable (VB-Cable) — so streamers can hear sounds locally while routing them to Discord, OBS, or any other app.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vue 3 + TypeScript + Vite |
| Desktop shell | Electron 33 |
| Audio | Web Audio API (AudioContext, GainNode) |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`) + custom CSS variables via `@theme` |
| Icons | Custom SVG icon system with Vite plugin + tree shaking |
| Settings persistence | JSON files (global + per-folder) |
| Stream Deck | SDK v3 plugin (separate package, bundled into exe) |
| Build | electron-builder (portable .exe + NSIS installer targets) |
| Package manager | pnpm (monorepo with packages/rrr-streamdeck) |

---

## Code Style Rules

### Keep it DRY — extract components and composables
Before writing logic inline in a component, check whether a composable already handles it. Before writing UI inline, check whether a component already exists for it or whether the new piece is reusable enough to extract. Duplicating logic or markup across components is a bug, not a shortcut.

### Tailwind-first — almost never write raw CSS
Priority order:
1. **Existing Tailwind utilities** — `flex`, `gap-2`, `text-sm`, `bg-bg-raised`, `text-text-dim`, etc.
2. **New `@utility` in `style.css`** — when a pattern is used in 3+ places and no utility covers it
3. **Arbitrary values** — `w-[300px]`, `text-[13px]`, `mt-[5px]` for one-off sizes
4. **Raw CSS only** — for things Tailwind genuinely cannot express: pseudo-elements (`::-webkit-slider-thumb`), `@keyframes`, complex attribute selectors, `-webkit-app-region`

When you catch yourself writing a `<style scoped>` block full of custom class definitions, stop and convert to Tailwind classes in the template instead.

### No text icons or emoji — use `<Icon>` only
Never use Unicode characters, emoji, or text glyphs as icons (e.g. `×`, `→`, `⚠`, `+`, `✓`). Always use `<Icon name="..." />`. If the icon you need doesn't exist in `src/assets/icons/`, stop, document what's needed, and tell the user to add the SVG before continuing.

### `text-text-dim` is for decoration only
The global body font is weight 300. At this weight, `text-text-dim` (#5A5550) is genuinely hard to read. Reserve it for placeholders, empty-state hints, and purely decorative labels. All functional body copy — descriptions, helper text, labels that a user needs to read — must use `text-text-secondary` (#C0B6AA) or higher.

---

## Project Structure

```
Rum-Runner Rhapsody/
├── electron/
│   ├── main.js                  — Main process, IPC handlers, WebSocket server
│   └── preload.js               — IPC bridge (contextIsolation: true)
├── src/
│   ├── App.vue                  — Root component, layout (TitleBar + FolderBar + SoundGrid + StatusBar)
│   ├── components/
│   │   ├── TitleBar.vue         — Custom frameless titlebar (48px); grid-cols-3; shadow record buttons
│   │   ├── FolderBar.vue        — Soundboard switcher, search, layout/density controls
│   │   ├── SoundboardModal.vue  — Edit/remove soundboard name and path
│   │   ├── SoundGrid.vue        — Main grid: category sidebar, accordion/flat view, DnD, CategorySettingsModal
│   │   ├── AccordionSection.vue — Category header + sound button grid + DnD
│   │   ├── SoundButton.vue      — Sound button + context menu + preview
│   │   ├── BaseModal.vue        — Reusable modal wrapper; optional `label` rubric above title
│   │   ├── ModalTabs.vue        — Left-sidebar tab nav (v-model, badge support); 2px accent ::before bar
│   │   ├── SettingsModal.vue    — Settings (App / Keybinds / Appearance / Playback / Audio Devices / Stream Deck)
│   │   ├── HelpModal.vue        — Help (Patch Notes / VB-Cable guide)
│   │   ├── CategorySettingsModal.vue — Per-category settings (General / Stream Deck tabs)
│   │   ├── StreamDeckImagePicker.vue — Reusable SD button image picker (idle/playing/stop slots)
│   │   ├── ClipEditor.vue       — Full-tab clip trim editor (overlays content area, slides up from bottom); 3-panel: file list with sort (newest/oldest/A-Z/Z-A) / waveform / export (Save to Category); per-clip edit state persists in `clipEditStates` Map (survives open/close); cleared on export/delete/reset
│   │   ├── ClipTrimSidebar.vue  — Quick-trim sidebar (320px, in-layout beside SoundGrid — not a fixed overlay); auto-opens after save; reloads soundboard on export
│   │   ├── ClipPlaybackControls.vue — Shared playback controls (skip/play/stop/loop/reset) + time display (In/Out/selection); used by both ClipEditor and ClipTrimSidebar; `compact` prop switches to smaller 30×28px buttons for the sidebar
│   │   ├── WaveformCanvas.vue   — Canvas waveform: peaks drawn once on canvas; selection dim overlays are pointer-events-none divs (no repaint on drag); `accentColor` prop triggers redraw on color change
│   │   ├── StatusBar.vue        — Audio status, SD image error warnings, sound count
│   │   ├── KeybindCapture.vue   — Keybind capture widget; key chips; `allowDelete` prop
│   │   ├── VolumeSlider.vue     — Reusable range slider (v-model, min/max/step/unit)
│   │   ├── Tooltip.vue          — Custom tooltip; teleports to body; 4-way flip; never use native `title`
│   │   ├── Icon.vue             — SVG icon component
│   │   ├── SquareButton.vue     — 36×36px icon button (icon, title, active, disabled, variant)
│   │   ├── CircleButton.vue     — 20×20px circle icon button
│   │   ├── ToggleCircleButton.vue — Circle button with enabled state
│   │   ├── ToggleSwitch.vue     — Boolean toggle switch (v-model)
│   │   ├── SettingRow.vue       — Label + control + optional description row
│   │   ├── AppSelect.vue        — Custom dropdown; variants: 'default' | 'ghost'; teleported + animated; options support optional `color?: string` for a colored dot
│   │   ├── ColorPalette.vue     — 17-swatch color grid (modelValue, defaultValue)
│   │   ├── MenuItem.vue         — Context menu button row
│   │   ├── ImagePickerSlot.vue  — Single image picker card; used in StreamDeckImagePicker
│   │   └── InstructionStep.vue  — Numbered step with accent badge; used in HelpModal
│   ├── composables/
│   │   ├── useAudioDevices.ts   — Device enumeration, label cleaning, hotplug; `audioInputDevices` + `findInputDeviceId()`
│   │   ├── useAudioPlayer.ts    — Audio playback, gain, playing state, preview
│   │   ├── useSettings.ts       — Reactive settings, IPC sync, sound groups
│   │   ├── useSoundManagement.ts — Sound list building, categories, ordering, drag helpers
│   │   ├── useShadowRecord.ts   — Shadow record singleton; AudioWorklet ring buffer, WAV encode, save via IPC
│   │   ├── useClipLibrary.ts    — Singleton; lists .wav clips in recordingFolder, manages selection/delete
│   │   ├── useClipPlayer.ts     — Instance composable; WAV decode, waveform peaks, playback, export; accepts optional `normalize: Ref<boolean>`; `hasSelection` tracks whether user has made a trim selection
│   │   └── useStreamDeckImageErrors.ts — Singleton; scans image paths, tracks broken ones
│   ├── assets/css/
│   │   ├── style.css            — Global styles, Tailwind @theme tokens, .btn classes, scrollbar, light mode
│   │   ├── icons.css            — Base icon mask/background rules
│   │   └── icon-data.css        — Generated icon CSS (do not edit)
│   ├── types/
│   │   └── icons.ts             — Generated IconName type + IconsFolder array (do not edit)
│   ├── filterState.ts           — `filterQuery: Ref<string>` singleton
│   ├── dragState.ts             — `draggingSound`, `draggingSection` singletons
│   ├── toastState.ts            — `toast`, `showToast()` singleton
│   ├── modalState.ts            — `settingsModalOpen/InitialTab`, `helpModalOpen/InitialTab` singletons
│   ├── clipEditorState.ts       — `clipEditorOpen`, `trimSidebarOpen`, `trimSidebarFile` singletons
│   ├── dropdownState.ts         — `activeDropdownId` singleton (one-at-a-time dropdown coordination)
│   ├── colorPalette.ts          — `COLOR_PALETTE` array (17 presets) + `DEFAULT_ACCENT`
│   ├── utils/
│   │   ├── hotkey.ts            — `formatAccelerator(e: KeyboardEvent): string | null`
│   │   └── audio.ts             — `encodeWavFromAudioBuffer()`, `trimAudioBuffer()`, `generatePeaks()`
│   └── types.ts                 — GlobalSettings, FolderSettings, WindowApi, Sound, SoundSection
├── packages/rrr-streamdeck/     — Stream Deck plugin (separate rollup build)
│   ├── src/
│   │   ├── plugin.ts            — SDK v3 entry point
│   │   ├── rrr-client.ts        — WebSocket client (port 57432, exponential backoff)
│   │   ├── svg-compose.ts       — SVG compositing: applies accent color, returns base64 data URIs
│   │   └── actions/
│   │       ├── play-sound.ts    — Play Sound action
│   │       ├── stop-all.ts      — Stop All action
│   │       └── save-clip.ts     — Save Clip action
│   └── action_svgs/             — Source SVGs bundled at build time (background, stop, save, etc.)
├── scripts/
│   ├── vite-plugin-icons.ts     — Custom Vite plugin for SVG icon system
│   └── update-changelog.md      — Reusable prompt for bumping versions/changelog
├── CHANGELOG.md
├── package.json                 — Root package, electron-builder config
└── vite.config.ts               — Vue + Tailwind + Electron + iconsPlugin; alias @ → src/
```

---

## Key Commands

```bash
pnpm dev                    # start dev server + Electron
pnpm build                  # build portable exe → release/Rum-Runner-Rhapsody.exe
pnpm build:installer        # build NSIS installer → release/RRR-Setup.exe
pnpm typecheck              # vue-tsc --noEmit (should always be zero errors)
pnpm streamdeck:dev         # build SD plugin + restart Stream Deck
pnpm streamdeck:link        # symlink plugin for dev (run once from project root)
```

---

## Settings Architecture

### Three files, three scopes:

**`rrr-settings.json`** (next to the exe, global):
```typescript
interface GlobalSettings {
  soundFolder: string
  savedFolders: string[]
  folderDisplayNames: Record<string, string>
  windowWidth: number
  windowHeight: number
  theme: 'dark' | 'light'
  masterVolume: number
  density: 'loose' | 'compact'
  devices: Array<{ label: string, volume: number, enabled: boolean }>
  hotkeys: { stop: string; search: string; saveClip: string }
  playbackMode: 'stop' | 'restart' | 'overlap'
  normalize: boolean
  streamDeckButtonMode: boolean
  closeToTray: boolean
  autoStart: boolean
  launchMinimized: boolean
  blockTypingConflicts: boolean
  showCategorySidebar: boolean
  viewMode: 'accordion' | 'flat'
  streamDeckDefaultImages: { idle?: string, playing?: string, stop?: string }
  accentColor: string              // hex override for --color-accent; empty = theme default gold
  shadowEnabled: boolean
  recordingInputDeviceLabel: string
  shadowBufferDuration: number     // seconds: 5/10/15/30/60
  recordingFolder: string
  clipAutoOpenTrim: boolean
  // Also contains all FolderSettings keys (GlobalSettings extends FolderSettings)
}
```

**`rrr-soundboard.json`** (inside the selected sound folder, per-folder):
```typescript
interface FolderSettings {
  hiddenSounds: string[]
  hiddenCategories: string[]
  sectionRenames: Record<string, string>
  customCategories: Array<{ id: string; name: string }>
  movedSounds: Record<string, string>
  collapsedCategories: string[]
  soundNames: Record<string, string>
  soundOrder: Record<string, string[]>
  categoryOrder: string[]
  soundVolumes: Record<string, number>             // dB offset, -20 to +20
  categoryStreamDeckImages: Record<string, { idle?: string, playing?: string }>
  categoryColors: Record<string, string>
  soundHotkeys: Record<string, string>
  playCounts: Record<string, number>               // stored in rrr-stats.json; merged on load
}
```

**`rrr-stats.json`** — `{ playCounts: Record<string, number> }` kept separate so stats writes don't dirty soundboard settings.

**Important**: `GlobalSettings extends FolderSettings`. Main process routes keys via `GLOBAL_KEYS` and `STATS_KEYS`; everything else goes to `rrr-soundboard.json`.

### Modifying settings — required checklist

**Any time you add, remove, or rename a settings field**, update ALL of the following:

1. **`DEFAULT_GLOBAL_SETTINGS` / `DEFAULT_FOLDER_SETTINGS` / `DEFAULT_STATS`** in `electron/main.js`
2. **`src/types.ts`** — update the matching interface
3. **`src/composables/useSettings.ts`** — update the initial `settings` ref value
4. **Write a migration** if renaming or removing an existing field:
   - Add migration function to `electron/main.js`, append to `_*_MIGRATIONS` array
   - Increment the relevant `GLOBAL_VERSION` / `FOLDER_VERSION` / `STATS_VERSION`
   - Simply adding a new key with a default does NOT require a migration
5. **Update this file** if the change affects architecture docs

### Reactive Proxy and IPC
`saveSettings` wraps its payload in `toRaw()` — shallow only. Nested objects from `settings.value` must be spread into a new plain object first:

```typescript
// Safe
saveSettings({ theme: settings.value.theme })

// Required — spread nested objects to avoid nested Proxy
const newCounts = { ...settings.value.playCounts, [key]: value }
saveSettings({ playCounts: newCounts })
```

Applies to: `playCounts`, `soundVolumes`, `soundOrder`, `devices`, `categoryStreamDeckImages`, `streamDeckDefaultImages`.

---

## Audio System

### Gain chain (per device):
1. Normalize gain (if enabled)
2. **+ clip dB offset** (`soundVolumes[key]`, additive, -20 to +20 dB)
3. × master volume
4. × device volume

### Key notes:
- Two `AudioContext` instances, one per output device
- Local files loaded via `window.api.readSoundFile(path)` (IPC → `fs.readFile`), wrapped in a Blob → `URL.createObjectURL()`. Never use `file://` URLs.
- `previewSound()` plays primary device only, does NOT affect `playingPaths` (no button glow, doesn't block Stop All)
- Supported formats: `.wav`, `.flac`, `.ogg`, `.mp3`, `.webm`, `.aac`, `.m4a`

---

## Shadow Record

`useShadowRecord.ts` — module-level singleton. AudioWorklet ring buffer captures mic input; `saveClip()` encodes as 16-bit PCM WAV and writes to `recordingFolder` via IPC. App.vue owns start/stop lifecycle.

### Composable state:
- `isRecording: Ref<boolean>`, `isSaving: Ref<boolean>`, `hasBuffer: Ref<boolean>`

### IPC handlers:
- `pick-clips-folder` — folder picker dialog
- `save-shadow-clip(data, folder)` — writes `clip-<timestamp>.wav`; returns `{ success, filename, filePath }`
- `registerShadowHotkey(combo)` / `registerStopHotkey(combo)` — OS-level shortcuts

### TitleBar integration:
- **Recording active**: `[● ✂ Clip]` button — pulsing red dot; disabled until `hasBuffer && !isSaving`; label reads "Saving…" while saving
- **Partially configured** (only device or folder set, not both): dim `[○ ✂ Clip]` button; clicking opens Settings → `shadowrecord` tab
- **Clip editor toggle**: scissors icon; shown when `recordingFolder` is set; accent when editor is open
- If `clipAutoOpenTrim` is true, `saveClip()` auto-sets `trimSidebarFile` and opens the trim sidebar

### Settings tab (id = `shadowrecord`):
Input Device, Saved Recordings Folder, `shadowEnabled` toggle. Sub-section (indented, disabled when off): Buffer Duration (5/10/15/30/60 s), Auto-open clip editor. Save hotkey is in Keybinds → System-Wide.

---

## Clip Editor

Two UI modes: full-tab editor (`ClipEditor.vue`) and quick-trim sidebar (`ClipTrimSidebar.vue`). State in `clipEditorState.ts`.

- `clipEditorOpen = true` → App.vue renders `<ClipEditor />` as an `absolute inset-0` overlay with a 0.28s slide-up transition; normal chrome stays mounted behind it
- `trimSidebarOpen = true` → `<ClipTrimSidebar />` appears in-layout beside SoundGrid (320px, squashes grid width); not a fixed overlay
- Set `trimSidebarFile` before `trimSidebarOpen = true` to auto-load a clip

### Clip Editor interactions:
- **Waveform drag**: Click-drag on the waveform body to set in/out selection. Small movement (< 5px) = seek instead. Handles remain for fine-tuning.
- **`hasSelection`**: `useClipPlayer` tracks whether the user has explicitly made a trim selection. Export is disabled until `hasSelection = true`. Reset by `resetTrim()` or loading a new file.
- **Clip list delete**: Hover a clip row to reveal an ✕ button (top-right). Clicking it shows an inline two-button confirmation (Cancel / Delete) that replaces the row content. Escape or selecting another clip cancels. Rows are `<div role="button">` (not `<button>`) to allow a proper `<button>` for the delete action inside.
- **Save to Category**: Export dropdown lists current soundboard's physical categories (`soundGroups[].folderPath`) with category color dots. Reloads soundboard (`loadSounds()`) after export.
- **Per-clip state persistence**: `clipEditStates` Map (in `clipEditorState.ts`) stores filename, export folder, delete-original toggle, in/out points per clip path. State survives clip switches and editor open/close. Cleared on export, delete, or "Reset" button click.

### IPC handlers:
- `list-clips-folder(folder)` → `Array<{path, filename, size, mtime}>` newest-first
- `trash-clip-file(path)` → `shell.trashItem`
- `reveal-in-explorer(folderPath)` → `shell.openPath`
- `save-exported-clip(data, destFolder, filename)` → sanitizes filename, writes `.wav`

---

## Custom Titlebar

Frameless window (`frame: false`). `TitleBar.vue` uses `grid grid-cols-3` — aligns center volume slider with FolderBar search.
- Left: brandmark SVG (`-webkit-app-region: drag`; buttons get `no-drag`)
- Center: master volume slider (`w-[260px] mx-auto`)
- Right: Stop All + Help + Settings, then 1px divider, then Minimize / Maximize / Close

Bar height: `h-12` (48px).

---

## Module-Level State Singletons

| File | Export(s) | Purpose |
|---|---|---|
| `filterState.ts` | `filterQuery: Ref<string>` | Search box value |
| `dragState.ts` | `draggingSound`, `draggingSection` | Active DnD state |
| `toastState.ts` | `toast`, `showToast(msg, type?)` | 4-second auto-dismiss toast; positioned `bottom-9` |
| `modalState.ts` | `settingsModalOpen/InitialTab`, `helpModalOpen/InitialTab` | Set `InitialTab` before open ref to land on a specific tab |
| `dropdownState.ts` | `activeDropdownId` | One context menu open at a time |
| `clipEditorState.ts` | `clipEditorOpen`, `trimSidebarOpen`, `trimSidebarFile`, `clipEditStates` (Map) | `clipEditStates` stores per-clip edit state (filename, folder, in/out points); set `trimSidebarFile` before `trimSidebarOpen = true` |

---

## Drag and Drop

- **Same-section reorder**: drop onto another slot → `reorderSoundsInSection(sectionId, orderedKeys)`
- **Cross-section move**: drop onto different AccordionSection → `moveSound(key, targetSectionId)`
- **Category reorder**: drag section header → drop onto SoundGrid wrapper → `reorderCategories(newOrder)`
- DnD is disabled when a search filter is active

---

## Modal System

**Design language** shared across all interactive lists (ModalTabs, AppSelect, category nav, context menu): 2px accent `::before` scaleY bar (0→1, 0.12s) on hover/active. Active state reveals instantly (`transition: none`).

**BaseModal.vue**: `title`, `label?` (type rubric above title), `size`, `open`. Escape closes. No border-radius — 0px matches angular design system.

**ModalTabs.vue**: Left-sidebar nav. Sidebar uses `bg-bg-base` (#0C0C0C) to recede behind `bg-bg-raised` content area.

**SettingsModal.vue** tabs: App / Keybinds / Appearance / Playback / Audio Devices / Stream Deck (Recording tab id = `shadowrecord`).
- Keybinds: **In-App** section (Focus Search) + **System-Wide** section (Stop All, Save Clip, per-sound list)

**CategorySettingsModal.vue**: General (rename, hide/show, color) + Stream Deck tabs. Rendered in `SoundGrid.vue` outside `<nav>` so it works when sidebar is hidden. Settings auto-save; no Save button.

---

## Category Quick-Nav Sidebar

- Each item: 6px colored dot (`w-1.5 h-1.5 rounded-full`) — always rendered but `transparent` when no color assigned
- **Accordion mode**: click scrolls to section; active item tracked by scroll via `activeSectionId` + `manualActiveSection` veto (300ms idle debounce)
- **Flat mode**: prepends "All" item; click sets `flatActiveCategoryId` to filter grid; resets on folder switch
- **Category color theming**: CSS custom properties `--nav-hover-color` + `--nav-active-bg` set as inline style; scoped rules read these with fallbacks, so uncolored items are identical to before
- Nav items are `<div>` (not `<button>`) wrapping a flex `<button>` + pencil `<button>` to avoid nested interactives
- Pencil and right-click open `CategorySettingsModal`; `pinnedSectionIds` keeps section mounted while modal is open

---

## Stream Deck Integration

### WebSocket server (port 57432, `127.0.0.1` only):
- Broadcasts `sounds-list` / `sounds-updated` / `playing-status` / `folder-status`
- All broadcasts include: `sounds`, `folderSelected`, `buttonMode`, `categoryStreamDeckImages`, `streamDeckDefaultImages`, `accentColor` (empty → `"#F9B71D"`), `shadowEnabled`

### Message types (plugin → app):
| Type | Payload | Effect |
|---|---|---|
| `get-sounds` | — | App responds with `sounds-list` to that client only |
| `play-sound` | `{ key: string }` | Searches `savedFolders` in priority order; plays from first match |
| `stop-all` | — | Forwards `ws-stop-all` IPC to renderer |
| `save-clip` | — | If `shadowEnabled`: calls `saveClip()`; if disabled: opens shadow recording settings |

### Image priority (Play Sound action):
1. Category override (`categoryStreamDeckImages[categoryId]`) — wins if `useCategoryImage !== false`
2. Global default (`streamDeckDefaultImages`)
3. Composited SVG from `svg-compose.ts` (background + optional icon, white fills → accent color)

### Adding a new SD action with a custom button image:
1. Add center icon SVG to `action_svgs/` (white fills, 144×144 viewBox)
2. Import in `svg-compose.ts`, export a `build*Image(accent)` function using `bgIdleSvg` or `bgActiveSvg`
3. Import and call from the new action file

---

## Stream Deck Image Error Reporting

`useStreamDeckImageErrors.ts` singleton: `brokenCount`, `brokenSources` (labels), `scanAll(settings)`.

StatusBar shows "⚠ N Stream Deck image(s) missing (…)" in `--color-danger` when broken images exist. SettingsModal and CategorySettingsModal show error badge on the Stream Deck tab.

---

## Changelog / Versioning

- Keepachangelog format, App + Stream Deck subsections per version
- Current version: **0.8.0** (app) / **0.8.0.0** (Stream Deck, 4-part)
- To update: use `scripts/update-changelog.md` prompt
- Bundled in `extraResources` → readable at runtime from `process.resourcesPath`

---

## Windows Integration

- **Autostart**: `app.setLoginItemSettings()` with `PORTABLE_EXECUTABLE_FILE`; `--autostarted` flag prevents minimizing unless `launchMinimized` is set
- **Close to tray**: `mainWindow.hide()` on close; tray menu: Open + Quit; `isQuitting` flag bypasses handler on app.quit
- **Port cleanup**: `netstat` + `taskkill` free port 57432 on startup with 2s timeout

---

## Build System

```bash
pnpm build
# = pnpm --filter @rrr/streamdeck build && vue-tsc --noEmit && vite build && electron-builder --win portable
```

- Portable: `release/Rum-Runner-Rhapsody.exe`; Installer: `release/RRR-Setup.exe`
- `extraResources`: SD plugin, `app-icon.png`, `CHANGELOG.md`
- No code signing (`CSC_IDENTITY_AUTO_DISCOVERY=false`)

---

## Debug Logging

```javascript
const DEBUG_LOGGING = false  // top of electron/main.js
```

Always `false` for production. Test override flags (`TEST_SD_*`) also at the top of `main.js`.

---

## CSS Variables Reference

All design tokens in `src/assets/css/style.css` under `@theme`. Available as Tailwind utilities and CSS custom properties. **Always use these — never hardcode hex values.**

```css
/* Backgrounds (darkest → lightest) */
--color-bg-deepest        /* #000000 — titlebar, status bar */
--color-bg-base           /* #0C0C0C — main app background */
--color-bg-raised         /* #161616 — card/panel surfaces */
--color-bg-surface        /* #202020 — inputs, selects, dropdowns */
--color-bg-surface-hover  /* #2A2A2A */
--color-bg-surface-active /* #333333 */

/* Accent — user-customizable; default gold */
--color-accent            /* #F9B71D */
--color-accent-dim        /* #D49A00 — hover */
--color-accent-glow       /* rgba accent at 0.18 opacity */

/* Text */
--color-text-primary      /* #EAE8E6 */
--color-text-secondary    /* #B8B5B3 — muted/description */
--color-text-dim          /* #5A5857 — decoration only (see Code Style Rules) */
--color-text-on-accent    /* #000000 */

/* Semantic */
--color-danger            /* #FF5040 */

/* Borders */
--color-border            /* #1E1E1E — context menu separators */
--color-border-light      /* #282828 — all visible UI borders */

/* Radii */
--radius-sm   /* 0px — sharp */
--radius-lg   /* 8px — modals only */

/* Fonts */
--font-sans     /* Outfit, weight 300 globally */
--font-display  /* TavernloreBB — branding/headers */
```

Light mode: toggled by `html.light` class. Neutral palette, default accent `#C88800`. User accent overrides via inline style on `<html>`.

Global button classes: `.btn`, `.btn-accent`, `.btn-danger` — see `style.css`.

---

## Context Menu (SoundButton.vue)

Two-page design: Page 1 (daily use: hide/rename/shortcut/volume), Page 2 (move/delete).

Key behaviors:
- `menuPage: Ref<'main' | 'more'>` resets to `'main'` on open/close
- Menu is `flex flex-col`; header/footer are `shrink-0`; actions are `flex-1 min-h-0 overflow-y-auto`
- Upward opening uses `bottom` CSS (not `top`) — never jumps to page top
- Shortcut badge: 9px monospace with `style="color: var(--color-text-dim)"` inline — resists playing-state color cascade
- Teleported to `<body>`; closes on outside click or scroll (capture phase)
- Hover: 2px accent `::before` scaleY bar — unified design language with ModalTabs, nav, AppSelect

### SoundButton hover overlays:
- Top-right: `ToggleCircleButton` (`ellipsis-solid`) → context menu
- Bottom-right: `ToggleCircleButton` (`headphones-simple-solid`) → preview

---

## Icon System

Vite plugin (`scripts/vite-plugin-icons.ts`) generates `icon-data.css` and `src/types/icons.ts` from `src/assets/icons/`.

```vue
<Icon name="gear-solid" />
<!-- format: <name>-<folder> e.g. "gear-solid", "eye-slash", "chevron-down-light" -->
<!-- duotone icons omit folder suffix: "gear" not "gear-duotone" -->
```

---

## Known Deferred Items

- **Icon tree shaking** — filter `getSvgFiles()` by `getIconsInUse()` in `buildStart`
- **Stream Deck cold start** — launching RRR from a Stream Deck button press
- **Auto-updater** — post-launch
- **GitHub Actions CI** — post-launch
- **Code signing** — SignPath Foundation application pending public repo

---

## File Paths That Matter

| What | Path |
|---|---|
| Global settings (packaged) | Next to `Rum-Runner-Rhapsody.exe` |
| Global settings (dev) | Project root |
| Folder settings | Inside selected sound folder as `rrr-soundboard.json` |
| Debug log | Next to exe (only when `DEBUG_LOGGING = true`) |
| Changelog | `process.resourcesPath/CHANGELOG.md` (packaged) or project root (dev) |
| Stream Deck plugin (dev) | `packages/rrr-streamdeck/com.pdog1.rum-runner-rhapsody.sdPlugin/` |
| Stream Deck plugin (packaged) | `resources/streamdeck-plugin/com.pdog1.rum-runner-rhapsody.sdPlugin/` |
| Stream Deck installed | `%APPDATA%\Elgato\StreamDeck\Plugins\com.pdog1.rum-runner-rhapsody.sdPlugin\` |
| Tray icon (packaged) | `process.resourcesPath/app-icon.png` |
| Tray icon (dev) | Project root `app-icon.png` |
