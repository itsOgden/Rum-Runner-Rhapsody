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
│   │   ├── TitleBar.vue         — Custom frameless titlebar (40px)
│   │   ├── FolderBar.vue        — Sound library bar: left = soundboard switcher trigger (full gold/accent background, TavernloreBB text) with pencil icon inside left of chevron (opacity-0, group-hover/sb reveals it) + accent-colored Refresh button; center search (Space shortcut focuses it globally); right text density toggle (Loose · Compact) + Show Hidden toggle. Clicking pencil or right-clicking trigger opens SoundboardModal. Dropdown (teleported) shows all savedFolders with display names, no remove buttons (management is in SoundboardModal). "Add folder…" at dropdown bottom.
│   │   ├── SoundboardModal.vue  — Opened by pencil icon or right-clicking the soundboard trigger in FolderBar; General tab: name input (modal title updates live as you type; saves to folderDisplayNames on close), read-only location path. Footer: "Remove soundboard" danger button with inline confirmation (files not deleted warning + Cancel/Remove). Remove auto-switches to first remaining folder or clears if none left.
│   │   ├── SoundGrid.vue        — Main grid: category quick-nav sidebar, accordion sections, drag-and-drop, empty states
│   │   ├── AccordionSection.vue — Category header (collapsible, draggable, right-click opens settings) + sound button grid + DnD
│   │   ├── SoundButton.vue      — Individual sound button + context menu + preview; playing styles transition in instantly (~0.04s) but fade out slowly (~0.4–0.55s) via CSS cascade trick; halo glow is a real `<div>` with Vue `<Transition name="halo">` (not `::after`) so enter/leave work cleanly alongside the `btn-ambient-pulse` animation
│   │   ├── BaseModal.vue        — Reusable modal wrapper with animations; optional `label` prop renders a small gold uppercase rubric above the title to identify modal type (e.g. "Category", "Soundboard"); scoped `.type-rubric` CSS: 9px, 0.16em tracking, accent color
│   │   ├── ModalTabs.vue        — Shared left-sidebar tab nav used by all modals (v-model activeTab, badge support); active/hover state uses a 2px accent `::before` scaleY bar (0→1, 0.12s) matching the context menu design language; active state reveals bar instantly (transition: none)
│   │   ├── SettingsModal.vue    — Settings (side-tab: App / Keybinds / Appearance / Playback / Audio Devices / Stream Deck)
│   │   ├── HelpModal.vue        — Help (side-tab: Patch Notes / VB-Cable guide)
│   │   ├── CategorySettingsModal.vue — Per-category settings (General / Stream Deck tabs)
│   │   ├── StreamDeckImagePicker.vue — Reusable image picker for SD button images
│   │   ├── StatusBar.vue        — Audio status text, SD image error warnings, sound count + hotkey reminder
│   │   ├── VolumeSlider.vue     — Reusable range slider (v-model, min/max/step/unit)
│   │   ├── Icon.vue             — SVG icon component (wraps generated icon CSS classes)
│   │   ├── SquareButton.vue     — 36×36px icon button; props: icon, title, active, disabled, variant ('default'|'danger')
│   │   ├── CircleButton.vue     — 20×20px circle icon button; prop: noColors to skip accent styling
│   │   ├── ToggleCircleButton.vue — Circle button with enabled state (accent bg when enabled, hover-reveal when not)
│   │   ├── ToggleSwitch.vue     — Reusable boolean toggle switch (v-model); used in all settings modals; checked state shows accent glow ring (`box-shadow: 0 0 0 3px var(--color-accent-glow)`)
│   │   ├── SettingRow.vue       — Label + control + optional description row; used in all settings modals (props: label, description)
│   │   ├── AppSelect.vue        — Custom styled dropdown replacing native <select>; props: modelValue, options[{value,label}]; emits: update:modelValue; keyboard nav on trigger (arrow/enter/escape); teleported + animated; trigger shows accent border when open; items use same `::before` scaleY bar design language as ModalTabs
│   │   ├── ColorPalette.vue     — Reusable 17-swatch color grid; props: modelValue (selected hex or ''), defaultValue (hex to highlight when modelValue is ''); emits: update:modelValue; used in Appearance tab and category color picker
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
│   ├── colorPalette.ts          — Shared COLOR_PALETTE array (17 presets: Gold, Amber, Ember, Crimson, Rose, Hot Pink, Magenta, Violet, Indigo, Blue, Sky, Teal, Jade, Lime, Bronze, Slate, Gray), DEFAULT_ACCENT constant; imported by ColorPalette.vue and any future color pickers
│   ├── dropdownState.ts         — Module singleton: activeDropdownId (one-at-a-time dropdown coordination)
│   └── types.ts                 — GlobalSettings, FolderSettings, WindowApi, Sound, SoundSection interfaces
├── packages/
│   └── rrr-streamdeck/          — Stream Deck plugin (separate rollup build)
│       ├── src/
│       │   ├── plugin.ts        — SDK v3 entry point
│       │   ├── rrr-client.ts    — WebSocket client (port 57432, exponential backoff)
│       │   ├── svg-compose.ts   — SVG compositing: imports assets, applies accent color, returns base64 data URIs
│       │   ├── svg.d.ts         — Type declaration for *.svg raw string imports
│       │   └── actions/
│       │       ├── play-sound.ts — Play Sound action, button state, title formatting
│       │       └── stop-all.ts   — Stop All action, global default stop image support
│       ├── action_svgs/         — Source SVG assets (bundled into plugin.js at build time)
│       │   ├── background@2x.svg        — Idle button frame (white fills → accent)
│       │   ├── background-active@2x.svg — Active button fill (inverted, white → accent)
│       │   ├── stop@2x.svg              — Stop square icon (white, on active bg)
│       │   ├── playing@2x.svg           — Playing center icon (currently empty)
│       │   ├── clip@2x.svg              — Future: clip mode icon
│       │   └── save@2x.svg              — Future: shadow record icon
│       ├── com.pdog1.rum-runner-rhapsody.sdPlugin/  — Built plugin output
│       │   └── ui/
│       │       ├── play-sound.html  — Property inspector (accent color via CSS vars + global settings)
│       │       └── stop-all.html
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
  soundFolder: string              // currently active folder path (empty string if none)
  savedFolders: string[]           // ordered list of all saved folder paths
  folderDisplayNames: Record<string, string>  // path → custom display name override (falls back to basename)
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
  accentColor: string              // hex color override for --color-accent (empty string = use theme default gold)
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
  categoryColors: Record<string, string>           // categoryId → hex color string
  playCounts: Record<string, number>               // actually stored in rrr-stats.json; merged into FolderSettings on load
}
```

**`rrr-stats.json`** (inside the selected sound folder, separate from soundboard settings):
```typescript
// Kept separate so stats writes don't dirty the soundboard settings file.
{ playCounts: Record<string, number> }
```

**Important**: `GlobalSettings extends FolderSettings` in TypeScript — all folder keys are present in the global type. The main process routes save keys using `GLOBAL_KEYS` (keys of `DEFAULT_GLOBAL_SETTINGS`) and `STATS_KEYS` (keys of `DEFAULT_STATS`); everything else goes to `rrr-soundboard.json`.

### Folder-change IPC result types:

```typescript
// Returned by pick-folder and switch-folder
interface FolderChangeResult {
  folder: string
  folderSettings: Partial<FolderSettings>  // includes stats (playCounts merged in)
  savedFolders?: string[]                  // updated list (always present from pick-folder)
}

// Returned by remove-folder
interface FolderRemoveResult {
  savedFolders: string[]
  switched: FolderChangeResult | null  // null if no folders remain
}
```

`useSettings.onFolderChanged(result)` handles both: sets `soundFolder`, merges `savedFolders` if present, `Object.assign`s `folderSettings`, then calls `loadSounds()`.

### Multi-folder IPC handlers (added for Phase 3.1):
- **`switch-folder(path)`** — saves current folder settings, loads new folder settings + stats, broadcasts to Stream Deck, returns `FolderChangeResult`
- **`remove-folder(path)`** — removes from `savedFolders`, auto-switches to first remaining or clears, returns `FolderRemoveResult`
- **`check-file-exists(path)`** — synchronous `fs.existsSync`; used by renderer to find which saved folder contains a given sound key for Stream Deck play routing

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

The window is **frameless** (`frame: false`). TitleBar.vue uses a `grid grid-cols-3` layout so all three columns share equal width — this aligns the center master volume slider with FolderBar's center search input.

- **Left (1/3)**: brandmark SVG (`src/assets/images/wordmark.svg`, 34px tall) — `-webkit-app-region: drag` on the bar, `no-drag` on interactive elements
- **Center (1/3)**: master volume slider in a `w-[260px] mx-auto` wrapper — matches FolderBar search width
- **Right (1/3)**: Stop All (danger, visible when playing) + Help + Settings gear, then a 1px divider, then Minimize / Maximize / Close

App control buttons (Stop All, Help, Settings) use `.wc-btn` scoped style: 32×40px, transparent, `rgba(255,255,255,0.08)` on hover. Window control buttons (Minimize, Maximize, Close) share the same class; Close additionally turns red on hover.

Bar height: `h-12` (48px). Titlebar has `-webkit-app-region: drag`; all buttons have `-webkit-app-region: no-drag`.

---

## Module-Level State Singletons

These files hold reactive state at module scope (not inside composables), so they are shared across all component instances without prop-drilling:

| File | Export(s) | Purpose |
|---|---|---|
| `filterState.ts` | `filterQuery: Ref<string>` | Search box value; shared between FolderBar and SoundGrid |
| `dragState.ts` | `draggingSound: Ref<DraggingSound \| null>`, `draggingSection: Ref<DraggingSection \| null>` | Active DnD state; read by AccordionSection/SoundGrid |
| `toastState.ts` | `toast: Ref<Toast \| null>`, `showToast(msg, type?)` | 4-second auto-dismiss toast; shown by Toast.vue; positioned `bottom-9` (36px) to clear the StatusBar |
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
- Props: `title: string`, `label?: string` (optional type rubric shown above title), `size`, `open`
- Emits: `close`
- Escape key closes; enter animation scales 0.95→1 + translateY; leave 0.15s
- Container has `border border-border-light` (no border-radius — matches 0px radius design system)

**ModalTabs.vue** — shared left-sidebar tab nav:
- Props: `tabs: Array<{ id, label, badge? }>`, `modelValue: string`
- Emits: `update:modelValue`
- Fully inline Tailwind; optional `badge` prop shows warning icon on the tab
- Sidebar uses `bg-bg-base` (#0C0C0C) so it recedes behind the `bg-bg-raised` (#161616) content area — not `bg-bg-surface`

**SettingsModal.vue** — six side-tabs:
- **App**: Close to tray, Start with Windows, Launch minimized, Show category sidebar
- **Keybinds**: Stop All (editable global hotkey input) + Focus Search (fixed display: Space)
- **Appearance**: Theme (dark/light AppSelect) + Accent color (ColorPalette with 17 swatches, Reset to default button)
- **Playback**: Playback mode, Normalize volumes
- **Audio Devices**: N-device output list (enable toggle, AppSelect device picker, volume slider, add/remove); description links to VB-Cable help tab
- **Stream Deck**: Grid mode, Install/Update plugin, Default Button Icons (idle/playing/stop via StreamDeckImagePicker)

**HelpModal.vue** — two side-tabs:
- **Patch Notes** (first tab): Reads `CHANGELOG.md` via `get-changelog` IPC, parses and renders with version heading in TavernloreBB, date below it, App/Stream Deck subsections
- **VB-Cable**: Setup guide with screenshots

**SoundboardModal.vue** — opened by pencil icon inside soundboard trigger or right-clicking the trigger; uses `label="Soundboard"` rubric:
- **General tab**: Name field (modal title updates live as you type; empty input falls back to folder basename; saves to `folderDisplayNames` on close via `commitRename`), read-only location path
- **Footer**: "Remove soundboard" danger button → inline confirmation row (files-not-deleted notice + Cancel + Remove). Remove calls `window.api.removeFolder`, auto-switches to first remaining saved folder or clears if none left

**CategorySettingsModal.vue** — two side-tabs, opened by right-clicking a category header (no visible gear icon):
- **General**: Category rename (drives live modal title), hide/show toggle, color picker (17-swatch `ColorPalette`; "Remove" link when a color is active; Restore Defaults also clears the color), Restore Defaults button
- **Stream Deck**: StreamDeckImagePicker for per-category idle/playing images
- Modal stays open when hide is toggled; hidden categories remain mounted while modal is open
- Restore Defaults resets name and hide state without closing modal

All settings auto-save on change (no Save button).

---

## Category Quick-Nav Sidebar

- Rendered inside `SoundGrid.vue` to the left of the scroll container as a fixed flex sibling
- Always visible (controlled by `showCategorySidebar` setting); during search, only shows categories that have at least one matching sound (hides entirely if no category matches)
- Each item shows a 6px colored dot (`w-1.5 h-1.5 rounded-full`) before the name; always rendered but `transparent` when no category color is assigned — keeps all items left-aligned regardless of color state
- Shows full category display names, truncated with ellipsis if too long
- Clicking a category smoothly scrolls the sound grid to that category header; each nav item is a flex row (`group/nav-item`) containing a scroll-click `<button>` (flex-1) and a pencil `<button>` (shrink-0) so nested interactivity works without nested `<button>` elements — outer element is a `<div>`
- Active/hover items use the same 2px `::before` scaleY bar design language as ModalTabs and AppSelect items
- **Category color theming** (when `section.color` is set): hover text, active text, active background, and `::before` bar all use the category color. Implemented via CSS custom properties set as inline style on the nav div — `--nav-hover-color` (the color) and `--nav-active-bg` (`color-mix(in srgb, <color> 10%, transparent)`). Scoped rules `.nav-btn:hover` and `.nav-btn--active` read these with fallbacks to `--color-text-primary` / `--color-accent-text` / `--color-accent`, so uncolored items look identical to before.
- Hidden categories omitted unless "show hidden" toggle is on; when shown (because Show Hidden is active), the nav item gets `opacity-40` to match the accordion section dimming
- **Drag/drop reorder**: nav items are `draggable` (disabled during filter). Uses local `draggingNavSectionId` + `dragOverNavId` refs (independent of the main grid's `draggingSection` to avoid cross-area interference). Drop calls `reorderCategories` with the full `sections.value` order. Drop target highlighted with `outline-2 outline-accent`; dragged item gets `opacity-50`.
- **Pencil edit button**: appears on the right of each nav row on hover (`group-hover/nav-item:opacity-100`). Right-clicking a nav item also opens the editor. Both open `CategorySettingsModal` via `openCategoryModal` / `closeNavCategoryModal` in `SoundGrid.vue`, which also manages `pinnedSectionIds` to keep the section mounted while the modal is open.
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
- All broadcasts include: `sounds`, `folderSelected`, `buttonMode`, `categoryStreamDeckImages`, `streamDeckDefaultImages`, `accentColor`
- `accentColor` is resolved before sending: empty string (theme default) → `"#F9B71D"`
- On new client connect: immediately sends full `sounds-list` payload to that client
- `get-sounds` message from plugin: responds with fresh `sounds-list` to requesting client only
- `save-settings` with `streamDeckDefaultImages` or `accentColor` triggers broadcast

### WebSocket message types (plugin → app):
| Type | Payload | Effect |
|---|---|---|
| `get-sounds` | — | App responds with `sounds-list` to that client only |
| `play-sound` | `{ key: string }` | App forwards to renderer via `ws-play-sound` IPC event; renderer searches `savedFolders` in priority order (active first) — plays from the first folder that contains the key, never from multiple |
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
3. Composited SVG from `svg-compose.ts`: `background@2x.svg` (idle) or `background-active@2x.svg` (playing), with white fills replaced by accent color

### Stop All action — image priority:
1. Global default (`streamDeckDefaultImages.stop`)
2. Composited SVG from `svg-compose.ts`: `background@2x.svg` + `stop@2x.svg` icon overlaid, accent color applied

`useCategoryImage` defaults to on (`undefined` treated as `true`); user can explicitly set to `false` to opt out. Toggle only appears in PI when category has images defined.

### Title formatting:
- `showCategoryInTitle` prepends category display name on line 1
- Sound name word-wrapped across remaining lines
- `soundCategory` is persisted in button settings and back-filled from live sounds list if missing

### Stop All action:
- Applies `streamDeckDefaultImages.stop` if set, falls back to composited accent SVG
- Updates immediately on `sounds-list`/`sounds-updated`

### Accent color in the plugin:
- `accentColor` is tracked as module-level state in both `play-sound.ts` and `stop-all.ts` (default `#F9B71D`)
- Updated whenever a WS broadcast arrives; persisted to Stream Deck global plugin settings via `streamDeck.settings.setGlobalSettings({ accentColor })` on change
- Property Inspector UIs request global settings immediately on open (`getGlobalSettings`) so the accent color is applied before the connecting spinner renders, without waiting for the `soundsList` roundtrip

### SVG compositing system (`src/svg-compose.ts`):
Source SVG assets live in `packages/rrr-streamdeck/action_svgs/`. They are bundled into `plugin.js` at build time via a raw-SVG import plugin in `rollup.config.mjs` (no runtime file I/O, no path issues on install).

**Asset files:**
| File | Purpose |
|---|---|
| `background@2x.svg` | Standard button frame — decorative border path in white (→ accent) on dark bg; used for idle and non-toggle buttons |
| `background-active@2x.svg` | Toggle-active button fill — inverted: entire button filled white (→ accent) except the frame cutout; only used for actively-toggled states (e.g. sound currently playing) |
| `stop@2x.svg` | Stop square icon — white, overlaid on active background |
| `playing@2x.svg` | Playing center icon — currently empty (no icon for playing state) |
| `clip@2x.svg` | Future: clip/open mode button icon |
| `save@2x.svg` | Future: shadow record save button icon |

**How compositing works:**
1. The raw-SVG rollup plugin inlines each `.svg` file as a string constant at build time
2. `extractInner()` strips the XML declaration, DOCTYPE, and outer `<svg>` wrapper from each asset
3. White fills (`fill:#fff`) in the **background layer only** are replaced with the accent color
4. Center icon fills stay white (for contrast on the accent background)
5. Both layers are wrapped in a single `<svg viewBox="0 0 144 144">` with the original style attributes preserved
6. The result is base64-encoded as a `data:image/svg+xml;base64,...` URI passed to `setImage()`

**To add a new action with a custom button image:**
1. Add the center icon SVG to `action_svgs/` (white fills, 144×144 viewBox)
2. Import it in `svg-compose.ts` and export a new `build*Image(accent)` function — use `bgIdleSvg` for standard buttons, `bgActiveSvg` only for toggle-active states
3. Import and call it from the new action file

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

/* Accent — user-customizable; default gold #F9B71D */
--color-accent            /* #F9B71D — buttons, active states, badges */
--color-accent-dim        /* #D49A00 — hover state for accent elements */
--color-accent-glow       /* rgb(from var(--color-accent) r g b / 0.18) — auto-derives from accent */

/* Text */
--color-text-primary      /* #EAE8E6 — main text */
--color-text-secondary    /* #B8B5B3 — muted/description text */
--color-text-dim          /* #5A5857 — very muted text (labels, placeholders) */
--color-text-on-accent    /* #000000 — text on gold accent background */

/* Semantic */
--color-danger            /* #FF5040 — destructive actions, error states */

/* Borders */
--color-border            /* #1E1E1E — used in SoundButton context menu separators */
--color-border-light      /* #282828 — all visible UI borders: inputs, cards, modals, dividers */

/* Radii */
--radius-sm               /* 0px — sharp; matches logo angular geometry */
--radius-lg               /* 8px — modals and large floating elements only */

/* Fonts */
--font-sans               /* 'Outfit', -apple-system, sans-serif — weight 300 set on body */
--font-mono               /* monospace — used in changelog/code blocks */
--font-display            /* 'TavernloreBB', 'Outfit', serif — branding/headers */
```

### Light mode overrides (`html.light`):
Light mode is toggled by adding the `light` class to `<html>`. Neutral gray palette (no warm tint — works with any accent). Default light accent is darker gold (#C88800). Grain overlay disabled (`--grain-opacity: 0`). User-chosen custom accents override the default via inline style on `<html>` (set in App.vue) which takes precedence over the `html.light` rule.

### Global button classes (in `style.css`):
- `.btn` — base button style
- `.btn-accent` — amber filled button (Browse, confirm actions)
- `.btn-danger` — red tinted button (destructive actions)

### Global utilities (in `style.css`):
- `app-region-drag` / `app-region-no-drag` — `-webkit-app-region` for Electron drag regions (`@utility`)
- `animate-fade-in` — `fadeIn 0.25s ease forwards`; keyframe defined in `@theme` as `--animate-fade-in`
- `animate-playing-bar` — `playing-bar 0.8s ease-in-out infinite alternate`; keyframe defined in `@theme`
- `guide-bullet` — accent-bullet list item for `<li>` in guides (14px indent, `•` in accent color)
- `toolbar-icon-btn` — 32×36px transparent borderless icon button; `text-text-dim` at rest, steps up to `text-text-primary` + `bg-bg-surface` on hover; used for FolderBar utility icons (Refresh, etc.) where no border is wanted

### Global base styles (`@layer base` in `style.css`):
- `body` — font, background, overflow, user-select, app-region reset
- `input[type="range"]` — shared slider track + `::webkit-slider-thumb` thumb styles; applies to all range inputs

### Global component classes (`@layer components` in `style.css`):
- `.btn`, `.btn-accent`, `.btn-danger` — button variants used across the app

### Fonts:
- Body: **Outfit** (variable, 100–900, local woff2 at `src/assets/fonts/Outfit.woff2`) — rendered at weight 300 globally
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
- Menu items use a 2px accent `::before` scaleY bar (0→1, 0.12s) on hover — this is the **unified design language** shared by ModalTabs, category quick-nav, and AppSelect items

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
