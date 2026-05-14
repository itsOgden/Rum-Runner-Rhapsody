# Rum-Runner Rhapsody — Claude Project Document

## Keeping This File Current

**This file is the source of truth for how RRR works. Keep it up to date.**

**Updating this document is the last step of every task.** Do not consider a task complete until the relevant section(s) reflect the current state. This is not optional — a task that changes the codebase without updating the doc is an incomplete task.

After completing any phase of work or making any non-trivial change, update the relevant section(s) before closing out. This includes:
- Architecture changes (new files, renamed fields, new IPC handlers, new composables)
- Settings schema changes (covered separately in the Modifying settings checklist)
- New components, new behaviors, or changes to existing ones
- Anything that would mislead a future Claude session if left stale

If you finish a task and nothing in the doc needed to change, that's fine — but check first.

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

Tailwind v4 is used for layout/spacing utility classes. Design tokens (colors, radii, fonts) are defined in `style.css` under `@theme` and are available both as Tailwind utilities (e.g. `bg-bg-raised`, `text-text-dim`) and as CSS custom properties (e.g. `var(--color-bg-raised)`).

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
│   │   ├── TitleBar.vue         — Custom frameless titlebar (40px)
│   │   ├── FolderBar.vue        — Folder path, search input, show-hidden toggle, density toggle, Browse, Refresh
│   │   ├── SoundGrid.vue        — Main grid: category quick-nav sidebar, accordion sections, drag-and-drop, empty states
│   │   ├── AccordionSection.vue — Category header (collapsible, draggable) + sound button grid + DnD
│   │   ├── SoundButton.vue      — Individual sound button + context menu + preview
│   │   ├── BaseModal.vue        — Reusable modal wrapper with animations
│   │   ├── ModalTabs.vue        — Shared left-sidebar tab nav used by all modals (v-model activeTab, badge support)
│   │   ├── SettingsModal.vue    — Settings (side-tab: App / Playback / Devices / Stream Deck)
│   │   ├── HelpModal.vue        — Help (side-tab: Patch Notes / VB-Cable guide)
│   │   ├── CategorySettingsModal.vue — Per-category settings (General / Stream Deck tabs)
│   │   ├── StreamDeckImagePicker.vue — Reusable image picker for SD button images
│   │   ├── StatusBar.vue        — Audio status text, SD image error warnings, sound count + hotkey reminder
│   │   ├── VolumeSlider.vue     — Reusable range slider (v-model, min/max/step/unit)
│   │   ├── Icon.vue             — SVG icon component (wraps generated icon CSS classes)
│   │   ├── SquareButton.vue     — 36×36px icon button; props: icon, title, active, disabled, variant ('default'|'danger')
│   │   ├── CircleButton.vue     — 20×20px circle icon button; prop: noColors to skip accent styling
│   │   ├── ToggleCircleButton.vue — Circle button with enabled state (accent bg when enabled, hover-reveal when not)
│   │   ├── ToggleSwitch.vue     — Reusable boolean toggle switch (v-model); used in all settings modals
│   │   ├── SettingRow.vue       — Label + control + optional description row; used in all settings modals (props: label, description)
│   │   ├── MenuItem.vue         — Context menu button row; default slot for content, prop: topBorder
│   │   ├── ImagePickerSlot.vue  — Single image picker card (label, preview, error, clear); used in StreamDeckImagePicker
│   │   └── InstructionStep.vue  — Numbered step with accent badge, title, slot body; used in HelpModal VB-Cable guide
│   ├── composables/
│   │   ├── useAudioDevices.ts   — Device enumeration, label cleaning, cross-session matching, hotplug
│   │   ├── useAudioPlayer.ts    — Audio playback, gain, playing state tracking, preview playback
│   │   ├── useSettings.ts       — Reactive settings, IPC sync, sound groups
│   │   ├── useSoundManagement.ts — Sound list building, categories, ordering, drag helpers
│   │   └── useStreamDeckImageErrors.ts — Singleton; scans image paths, tracks broken ones
│   ├── assets/
│   │   ├── fonts/               — Outfit (body), TavernloreBB (headers)
│   │   ├── images/              — vb-cables-listen-tab.png, vb-cables-rrr-selection.png
│   │   └── css/
│   │       ├── style.css        — Global styles, Tailwind @theme tokens, .btn classes, scrollbar, light mode
│   │       ├── icons.css        — Base icon mask/background rules (referenced by vite-plugin-icons)
│   │       └── icon-data.css    — Generated icon CSS (SVG data-URIs + .i-* classes; do not edit)
│   ├── types/
│   │   └── icons.ts             — Generated IconName type + IconsFolder array (do not edit)
│   ├── filterState.ts           — Module singleton: filterQuery ref (search box value)
│   ├── dragState.ts             — Module singletons: draggingSound, draggingSection refs
│   ├── toastState.ts            — Module singleton: toast ref + showToast() helper
│   ├── modalState.ts            — Module singletons: settingsModalOpen, helpModalOpen refs
│   ├── dropdownState.ts         — Module singleton: activeDropdownId (one-at-a-time dropdown coordination)
│   └── types.ts                 — GlobalSettings, FolderSettings, WindowApi, Sound, SoundSection interfaces
├── packages/
│   └── rrr-streamdeck/          — Stream Deck plugin (separate rollup build)
│       ├── src/
│       │   ├── plugin.ts        — SDK v3 entry point
│       │   ├── rrr-client.ts    — WebSocket client (port 57432, exponential backoff)
│       │   └── actions/
│       │       ├── play-sound.ts — Play Sound action, button state, title formatting
│       │       └── stop-all.ts   — Stop All action, global default stop image support
│       ├── ui/
│       │   ├── play-sound.html  — Property inspector
│       │   └── stop-all.html
│       └── com.pdog1.rum-runner-rhapsody.sdPlugin/  — Built plugin output
├── scripts/
│   ├── vite-plugin-icons.ts     — Custom Vite plugin for SVG icon system
│   └── update-changelog.md      — Reusable Claude Code prompt for bumping versions/changelog
├── CHANGELOG.md                 — Keepachangelog format, split into App / Stream Deck sections per version
├── app-icon.png                 — App icon (project root)
├── package.json                 — Root package, electron-builder config
└── vite.config.ts               — Vite config: Vue + Tailwind + Electron + iconsPlugin; alias @ → src/
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
pnpm streamdeck:unlink      # remove the symlink
```

---

## Settings Architecture

### Three files, three scopes:

**`rrr-settings.json`** (next to the exe, global):
```typescript
interface GlobalSettings {
  soundFolder: string
  windowWidth: number
  windowHeight: number
  theme: 'dark' | 'light'
  masterVolume: number
  density: 'loose' | 'compact'
  devices: Array<{ label: string, volume: number, enabled: boolean }>
  hotkeys: { stop: string }
  playbackMode: 'stop' | 'restart' | 'overlap'
  normalize: boolean
  streamDeckButtonMode: boolean
  closeToTray: boolean
  autoStart: boolean
  launchMinimized: boolean
  showCategorySidebar: boolean
  streamDeckDefaultImages: { idle?: string, playing?: string, stop?: string }
  // Also contains all FolderSettings keys (GlobalSettings extends FolderSettings)
}
```

**`rrr-soundboard.json`** (inside the selected sound folder, per-folder):
```typescript
interface FolderSettings {
  hiddenSounds: string[]
  hiddenCategories: string[]
  sectionRenames: Record<string, string>           // display-name overrides for folder sections
  customCategories: Array<{ id: string; name: string }>
  movedSounds: Record<string, string>              // soundKey → categoryId
  collapsedCategories: string[]
  soundNames: Record<string, string>
  soundOrder: Record<string, string[]>
  categoryOrder: string[]
  soundVolumes: Record<string, number>             // dB offset, -20 to +20
  categoryStreamDeckImages: Record<string, { idle?: string, playing?: string }>
  playCounts: Record<string, number>               // actually stored in rrr-stats.json; merged into FolderSettings on load
}
```

**`rrr-stats.json`** (inside the selected sound folder, separate from soundboard settings):
```typescript
// Kept separate so stats writes don't dirty the soundboard settings file.
{ playCounts: Record<string, number> }
```

**Important**: `GlobalSettings extends FolderSettings` in TypeScript — all folder keys are present in the global type. The main process routes save keys using `GLOBAL_KEYS` (keys of `DEFAULT_GLOBAL_SETTINGS`) and `STATS_KEYS` (keys of `DEFAULT_STATS`); everything else goes to `rrr-soundboard.json`.

### Modifying settings — required checklist

**Any time you add, remove, or rename a settings field**, you must update ALL of the following:

1. **`DEFAULT_GLOBAL_SETTINGS` / `DEFAULT_FOLDER_SETTINGS` / `DEFAULT_STATS`** in `electron/main.js` — add/remove the key with its default value. This also controls routing: global keys go in `rrr-settings.json`, stats keys go in `rrr-stats.json`, everything else goes in `rrr-soundboard.json`.

2. **`src/types.ts`** — update `GlobalSettings`, `FolderSettings`, or the inline stats type to match.

3. **`src/composables/useSettings.ts`** — update the initial `settings` ref value to include the new key with its default.

4. **Write a migration** if renaming or removing a field that exists in user save files:
   - Add a migration function (`_migrateGlobalV0toV1`, etc.) to `electron/main.js`
   - Append it to the relevant `_*_MIGRATIONS` array (index 0 = v1→v2, index 1 = v2→v3, etc.)
   - Increment the relevant `GLOBAL_VERSION` / `FOLDER_VERSION` / `STATS_VERSION` constant
   - Simply adding a new key with a default does NOT require a migration (defaults handle it)

5. **Update this file** if the change is significant enough to affect the architecture docs above.

### Reactive Proxy and IPC
`useSettings.saveSettings` wraps its payload in `toRaw()` before sending over IPC, so top-level reactive objects are safe to pass directly. However, `toRaw()` is shallow — nested reactive objects (e.g. a Proxy inside a Proxy) are not unwrapped. When constructing a value that contains a nested object from `settings.value`, always spread it into a new plain object first:

```typescript
// Safe — toRaw handles the top-level ref
saveSettings({ theme: settings.value.theme })

// Still required — nested object must be spread to avoid a nested Proxy
const newCounts = { ...settings.value.playCounts, [key]: value }
settings.value.playCounts = newCounts
saveSettings({ playCounts: newCounts })
```

This applies to: `playCounts`, `soundVolumes`, `soundOrder`, `devices`, `categoryStreamDeckImages`, `streamDeckDefaultImages`, and any other nested object in settings.

---

## Audio System

### Dual output:
- Two AudioContext instances, one per output device
- Each has a GainNode chain: normalize gain → clip volume offset → master volume → device volume

### Gain calculation order:
1. Normalize gain (if enabled)
2. **+ clip dB offset** (`soundVolumes[key]`, additive, -20 to +20 dB)
3. × master volume
4. × device volume

```typescript
export const CLIP_VOLUME_MAX_DB = 20  // in useAudioPlayer.ts
```

### Live volume updates:
`setClipVolumeOffset(soundKey, dbOffset)` — exported from `useAudioPlayer.ts`; updates gain on all currently active AudioBufferSourceNodes matching that key. Called while the volume slider in the context menu is being dragged so changes are heard in real time.

### Preview playback:
- `previewSound(sound)` — plays the sound on the **primary device only**, does NOT affect `playingPaths` (so it doesn't light up the button or block Stop All)
- `stopPreview()` — stops in-flight preview
- `previewingPath: Ref<string | null>` — tracks which sound is previewing
- Generation counter prevents stale async loads from completing after cancellation
- SoundButton shows a headphones icon on hover (bottom-right); preview stops on mouse-leave

### Supported audio formats:
`.wav`, `.flac`, `.ogg`, `.mp3`, `.webm`, `.aac`, `.m4a`

### Local file loading:
Audio and image files are loaded via `window.api.readSoundFile(path)` (IPC → `fs.readFile`), wrapped in a Blob, and served as `URL.createObjectURL(...)`. This is the correct pattern for local files — do not use `file://` URLs or custom protocols.

---

## Custom Titlebar

The window is **frameless** (`frame: false`). TitleBar.vue renders a 40px bar with:
- Left: full brandmark SVG (`src/assets/images/wordmark.svg`, 34px tall, auto width) — replaces the old icon + text combo
- Bar height increased from 40px to 48px (`h-12`) to accommodate the brandmark
- Center: master volume slider (max-width 280px)
- Right-A: Stop All (red, visible only when sounds are playing), Help (circle-question icon), Settings gear — all `.wc-btn` style
- Divider: 1px vertical
- Right-B: Minimize, Maximize/Restore, Close (hover red)

All buttons use `.wc-btn`: 32×40px, transparent bg, hover `rgba(255,255,255,0.08)`.
Titlebar has `-webkit-app-region: drag`, interactive elements have `-webkit-app-region: no-drag`.

---

## Module-Level State Singletons

These files hold reactive state at module scope (not inside composables), so they are shared across all component instances without prop-drilling:

| File | Export(s) | Purpose |
|---|---|---|
| `filterState.ts` | `filterQuery: Ref<string>` | Search box value; shared between FolderBar and SoundGrid |
| `dragState.ts` | `draggingSound: Ref<DraggingSound \| null>`, `draggingSection: Ref<DraggingSection \| null>` | Active DnD state; read by AccordionSection/SoundGrid |
| `toastState.ts` | `toast: Ref<Toast \| null>`, `showToast(msg, type?)` | 4-second auto-dismiss toast; shown by Toast.vue |
| `modalState.ts` | `settingsModalOpen: Ref<boolean>`, `helpModalOpen: Ref<boolean>`, `helpModalInitialTab: Ref<string \| null>` | Controls modal visibility; set `helpModalInitialTab` before opening HelpModal to land on a specific tab |
| `dropdownState.ts` | `activeDropdownId: Ref<string \| null>` | Ensures only one SoundButton context menu is open at a time |

---

## Drag and Drop

Sound buttons and category headers are both draggable.

### Sound reorder (same-section):
- Dragging a SoundButton within its section and dropping onto another slot reorders sounds in that section
- `reorderSoundsInSection(sectionId, orderedKeys)` in `useSoundManagement` persists the new order to `soundOrder`
- `dragOverSoundIndex` in AccordionSection tracks hover position; outline highlights the target slot

### Sound move (cross-section):
- Dropping a SoundButton onto a different AccordionSection calls `moveSound(key, targetSectionId)`
- Drop target shows accent outline; section header itself is a valid drop target (fallback)

### Category reorder:
- Dragging a category header (`.group/hdr` div) sets `draggingSection`
- Dropping onto a different category's wrapper div in SoundGrid calls `reorderCategories(newOrder)`
- Dragged section dims to 50%; drop target gets accent outline

### DnD is disabled when a search filter is active.

---

## Modal System

**BaseModal.vue** — reusable wrapper:
- Props: `title: string`, `width: string`
- Emits: `close`
- Escape key closes; enter animation scales 0.95→1 + translateY; leave 0.15s

**ModalTabs.vue** — shared left-sidebar tab nav:
- Props: `tabs: Array<{ id, label, badge? }>`, `modelValue: string`
- Emits: `update:modelValue`
- Fully inline Tailwind; optional `badge` prop shows warning icon on the tab

**SettingsModal.vue** — four side-tabs:
- **App**: Theme, Stop All hotkey, Close to tray, Start with Windows, Launch minimized, Show category sidebar
- **Playback**: Playback mode, Normalize volumes
- **Devices**: N-device output list (enable toggle, device picker, volume slider, add/remove); description links to VB-Cable help tab
- **Stream Deck**: Grid mode, Install/Update plugin, Default Button Icons (idle/playing/stop via StreamDeckImagePicker)

**HelpModal.vue** — two side-tabs:
- **Patch Notes** (first tab): Reads `CHANGELOG.md` via `get-changelog` IPC, parses and renders with version heading in TavernloreBB, date below it, App/Stream Deck subsections
- **VB-Cable**: Setup guide with screenshots

**CategorySettingsModal.vue** — two side-tabs, opened via cog icon on category headers:
- **General**: Category rename (drives live modal title), hide/show toggle, Restore Defaults button
- **Stream Deck**: StreamDeckImagePicker for per-category idle/playing images
- Modal stays open when hide is toggled; hidden categories remain mounted while modal is open
- Restore Defaults resets name and hide state without closing modal

All settings auto-save on change (no Save button).

---

## Category Quick-Nav Sidebar

- Rendered inside `SoundGrid.vue` to the left of the scroll container as a fixed flex sibling
- Always visible (controlled by `showCategorySidebar` setting); hidden during search/filter
- Shows full category display names, truncated with ellipsis if too long
- Clicking a category smoothly scrolls the sound grid to that category header
- Active category highlighted with `--color-accent`; tracks scroll position
- Hidden categories omitted unless "show hidden" toggle is on
- `ACTIVE_HIGHLIGHT_ENABLED` constant at top of `SoundGrid.vue` (not in settings) controls highlight behavior
- Click-lock: after clicking, highlight stays on the clicked category until scroll has been idle for 300ms, using `manualActiveSection` ref as a veto against scroll-based tracking overriding it prematurely

---

## StreamDeckImagePicker Component

Reusable component (`StreamDeckImagePicker.vue`) used in both CategorySettingsModal and SettingsModal.

**Props:**
- `idlePath`, `playingPath`, `stopPath` — current override paths (nullable); stop slot only renders when prop is explicitly passed
- `defaultIdlePath`, `defaultPlayingPath`, `defaultStopPath` — fallback preview images

**Behavior:**
- Each slot shows override image if set, otherwise fallback preview
- Playing slot disabled until idle is set; stop slot is fully independent
- Clearing idle also clears playing
- Image as button: clicking preview opens file picker; × button in top-right clears override
- Load errors tracked per slot: shows red-tinted placeholder + "File not found: filename" below slot
- Emits `errors` count whenever broken image count changes
- Uses blob URLs via `readSoundFile` IPC; revokes old URLs on change and unmount

---

## Stream Deck Integration

### WebSocket server (port 57432):
- Binds to `127.0.0.1` only
- Broadcasts: `sounds-list`, `sounds-updated`, `playing-status`, `folder-status`
- All broadcasts include: `sounds`, `folderSelected`, `buttonMode`, `categoryStreamDeckImages`, `streamDeckDefaultImages`
- On new client connect: immediately sends full `sounds-list` payload to that client
- `get-sounds` message from plugin: responds with fresh `sounds-list` to requesting client only
- `save-settings` with `streamDeckDefaultImages` triggers broadcast

### WebSocket message types (plugin → app):
| Type | Payload | Effect |
|---|---|---|
| `get-sounds` | — | App responds with `sounds-list` to that client only |
| `play-sound` | `{ key: string }` | App forwards to renderer via `ws-play-sound` IPC event |
| `stop-all` | — | App forwards to renderer via `ws-stop-all` IPC event |

### WS sound list item shape:
```typescript
{ key: string, displayName: string, category: string, categoryId: string }
```

### Plugin connection lifecycle:
1. Plugin connects → sends `get-sounds`
2. App responds with `sounds-list` (full payload)
3. Plugin updates module-level state, calls `applyKeyImage` + `setTitle` on all active actions
4. `onWillAppear`: if `currentSounds` already populated, use fresh name/category from list (handles race condition)

### Play Sound action — image priority:
1. Category override (`categoryStreamDeckImages[categoryId]`) — wins if `useCategoryImage !== false`
2. Global default (`streamDeckDefaultImages`)
3. Built-in `key.png` / `playing.png`

`useCategoryImage` defaults to on (`undefined` treated as `true`); user can explicitly set to `false` to opt out. Toggle only appears in PI when category has images defined.

### Title formatting:
- `showCategoryInTitle` prepends category display name on line 1
- Sound name word-wrapped across remaining lines
- `soundCategory` is persisted in button settings and back-filled from live sounds list if missing

### Stop All action:
- Applies `streamDeckDefaultImages.stop` if set, falls back to built-in image
- Updates immediately on `sounds-list`/`sounds-updated`

### Stream Deck dev workflow:
```bash
pnpm streamdeck:dev   # build + restart Stream Deck
# symlink (run once):
pnpm streamdeck:link  # runs: streamdeck link packages/rrr-streamdeck/com.pdog1.rum-runner-rhapsody.sdPlugin
```

---

## Stream Deck Image Error Reporting

**`useStreamDeckImageErrors.ts`** — module-level singleton:
- `brokenCount: Ref<number>` — total broken image paths
- `brokenSources: Ref<string[]>` — labels of affected sources ("Default" for global, category display name for per-category)
- `scanAll(settings)` — scans all paths in `streamDeckDefaultImages` + `categoryStreamDeckImages` in parallel via `readSoundFile`; called on mount and after library refresh

**StatusBar.vue:**
- Left side: `statusText` from `useAudioPlayer` (e.g. "Playing: Name", "Ready", "Stopped")
- Right side: total sound count + hotkey reminder
- Shows "⚠ N Stream Deck image(s) missing (Source1, Source2, ...)" in `--color-danger` when broken images exist; only shown when status is "Ready" or "Stopped"
- Max 3 source names shown, truncated with "..." if more
- Disappears when `brokenCount === 0`

**Tab error badges:**
- Both `SettingsModal.vue` and `CategorySettingsModal.vue` show a small error icon on the Stream Deck tab when images in that scope are broken
- Driven by `errors` event from `StreamDeckImagePicker` + lookup into `brokenSources`

---

## Changelog / Versioning

- `CHANGELOG.md` in project root, keepachangelog format
- Each version block split into **App** and **Stream Deck** subsections
- Current version: **0.8.0** (app) / **0.8.0.0** (Stream Deck plugin, 4-part)
- To update: use `scripts/update-changelog.md` prompt with Claude Code
- `CHANGELOG.md` included in `extraResources` so it's readable at runtime from `process.resourcesPath`

---

## Windows Integration

### Autostart:
- `app.setLoginItemSettings()` with `path: process.env.PORTABLE_EXECUTABLE_FILE`
- `--autostarted` argv flag detects login launch
- `launchMinimized` only hides window if `--autostarted` is present
- Skipped in dev (no `PORTABLE_EXECUTABLE_FILE`)

### Close to tray:
- `mainWindow.hide()` on close if `closeToTray` is true
- Tray icon from `process.resourcesPath/app-icon.png` (packaged) or project root (dev)
- `isQuitting` flag set in `before-quit` so tray quit bypasses close handler
- Tray context menu: **Open** (show + focus), **Quit** (app.quit)

### Port cleanup on startup:
On `app.whenReady`, main.js uses `netstat` + `taskkill` to free port 57432 before starting the WebSocket server. A 2-second timeout ensures startup proceeds even if netstat/taskkill hangs (common at Windows login time).

---

## Build System

```bash
pnpm build
# = pnpm --filter @rrr/streamdeck build && vue-tsc --noEmit && vite build && cross-env CSC_IDENTITY_AUTO_DISCOVERY=false electron-builder --win portable
```

- Output: `release/Rum-Runner-Rhapsody.exe` (portable)
- NSIS installer: `release/RRR-Setup.exe` (via `pnpm build:installer`)
- `asar: true`, `compression: maximum`
- `extraResources`: Stream Deck plugin, `app-icon.png`, `CHANGELOG.md`
- No code signing currently (`CSC_IDENTITY_AUTO_DISCOVERY=false`)

### Startup performance flags:
```javascript
app.commandLine.appendSwitch('disable-gpu-cache')
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=256')
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion')
```

---

## Debug Logging

```javascript
const DEBUG_LOGGING = false  // top of electron/main.js
```

Writes timestamped lines to `rrr-debug.log` next to the exe. Always `false` for production.

Several test override flags also live at the top of `main.js` (all `false` for production):
```javascript
const TEST_SD_STREAM_DECK_NOT_FOUND = false
const TEST_SD_INSTALL_FAIL         = false
const TEST_SD_NOT_INSTALLED        = false
const TEST_SD_UPDATE_AVAILABLE     = false
```

---

## CSS Variables Reference

All design tokens are defined via Tailwind v4's `@theme` in `src/assets/css/style.css`. They are available both as Tailwind utilities and as CSS custom properties. **Always use these — never hardcode hex values.**

### Dark mode (default):
```css
/* Backgrounds (darkest → lightest) — pure neutral grays, R=G=B, no color tint */
--color-bg-deepest        /* #000000 — titlebar, status bar */
--color-bg-base           /* #0C0C0C — main app background */
--color-bg-raised         /* #161616 — card/panel surfaces (sound buttons, section headers) */
--color-bg-surface        /* #202020 — inputs, selects, dropdowns */
--color-bg-surface-hover  /* #2A2A2A — hover state for surfaces */
--color-bg-surface-active /* #333333 — active/pressed surface */

/* Accent (brand gold) */
--color-accent            /* #F9B71D — buttons, active states, badges, category headers */
--color-accent-dim        /* #D49A00 — hover state for accent elements */
--color-accent-glow       /* rgba(249,183,29,0.18) — box-shadow glow on sliders */

/* Text */
--color-text-primary      /* #F0EBE0 — main text */
--color-text-secondary    /* #9A9080 — muted/description text */
--color-text-dim          /* #5A5550 — very muted text (labels, placeholders) */
--color-text-on-accent    /* #000000 — text on gold accent background */

/* Semantic */
--color-danger            /* #FF5040 — destructive actions, error states */
--color-danger-glow       /* rgba(255,80,64,0.15) */
--color-warning           /* #FFE566 — warnings */

/* Borders */
--color-border            /* #1E1E1E — dividers, section borders */
--color-border-light      /* #282828 — input borders, card outlines */

/* Radii */
--radius-sm               /* 6px */
--radius-md               /* 10px */
--radius-lg               /* 14px */

/* Fonts */
--font-sans               /* 'Outfit', -apple-system, sans-serif */
--font-mono               /* monospace */
--font-display            /* 'TavernloreBB', 'Outfit', serif — branding/headers */
```

### Light mode overrides (`html.light`):
Light mode is toggled by adding the `light` class to `<html>`. All background, text, border, accent, and danger tokens are overridden. Accent shifts from gold (#F9B71D) to a darker brown-gold (#BF7200).

### Global button classes (in `style.css`):
- `.btn` — base button style
- `.btn-accent` — amber filled button (Browse, confirm actions)
- `.btn-danger` — red tinted button (destructive actions)

### Global utilities (in `style.css`):
- `app-region-drag` / `app-region-no-drag` — `-webkit-app-region` for Electron drag regions (`@utility`)
- `animate-fade-in` — `fadeIn 0.25s ease forwards`; keyframe defined in `@theme` as `--animate-fade-in`
- `animate-playing-bar` — `playing-bar 0.8s ease-in-out infinite alternate`; keyframe defined in `@theme`
- `guide-bullet` — accent-bullet list item for `<li>` in guides (14px indent, `•` in accent color)

### Global base styles (`@layer base` in `style.css`):
- `body` — font, background, overflow, user-select, app-region reset
- `input[type="range"]` — shared slider track + `::webkit-slider-thumb` thumb styles; applies to all range inputs

### Global component classes (`@layer components` in `style.css`):
- `.btn`, `.btn-accent`, `.btn-danger` — button variants used across the app

### Fonts:
- Body: **Outfit**
- Headers/branding: **TavernloreBB** (used for version headings in patch notes, titlebar app name, category section headers)

---

## Context Menu (SoundButton.vue)

```
┌──────────────────────────────────┐
│ Played X times       [× reset]   │  ← muted label + circle × to reset count (if count > 0)
├──────────────────────────────────┤
│ Hide / Restore                   │
│ Rename                           │
│ Move to…                         │
├──────────────────────────────────┤  ← only when isMoved
│ Reset                            │
├──────────────────────────────────┤
│ Volume Offset                    │
│ [VolumeSlider -20 to +20 dB]     │
│ Reset          [button]          │  ← only when offset !== 0
└──────────────────────────────────┘
```

- "Move to…" expands inline (not a submenu popup) showing all available categories
- Context menu is teleported to `<body>` to avoid scroll-container clipping
- Menu flips upward if it would overflow the viewport bottom
- Only one menu open at a time via `activeDropdownId` singleton

### SoundButton hover overlays:
- Top-right: `ToggleCircleButton` with `ellipsis-solid` icon → opens context menu
- Bottom-right: `ToggleCircleButton` with `headphones-simple-solid` icon → toggle preview playback

---

## Icon System

Custom Vite plugin (`scripts/vite-plugin-icons.ts`) scans `src/assets/icons/` for SVG files and generates:
- `src/assets/css/icon-data.css` — CSS custom properties with SVG data-URIs + `.i-name-folder` mask/background classes
- `src/types/icons.ts` — `IconName` union type + `IconsFolder` array

**Usage in components:**
```vue
<Icon name="gear-solid" />
<!-- name format: <icon-name>-<folder> (e.g. "gear-solid", "eye-slash", "chevron-down-light") -->
<!-- duotone folder icons omit the folder suffix (e.g. "gear" not "gear-duotone") -->
```

In production builds, `getIconsInUse()` logs unused icons. The tree-shaking fix (filtering `getSvgFiles()` by `getIconsInUse()` in `buildStart`) is listed as a deferred item.

---

## Known Deferred Items

- **Icon tree shaking** — all icons still included in `icon-data.css`; fix is to filter `getSvgFiles()` by `getIconsInUse()` in `buildStart` hook
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
| Stream Deck logs | `%APPDATA%\Elgato\StreamDeck\logs\` |
| Tray icon (packaged) | `process.resourcesPath/app-icon.png` |
| Tray icon (dev) | Project root `app-icon.png` |
