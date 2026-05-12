# Rum-Runner Rhapsody — v1.0.0 Roadmap

> Working document. Items are numbered for reference and grouped into phases by dependency order and risk.
> Original list item numbers are noted in brackets for cross-reference.

---

## Phase 0 — Research & Decisions
*Things you need to decide before you can build. Do these in parallel with Phase 1.*

### R1. Code Signing — Research & Purchase [#13]
**What:** Get a code signing certificate so Windows doesn't show SmartScreen "Unknown Publisher" warnings to users.

**Key decision — OV vs EV:**
- **OV (Organization Validation):** ~$100–150/year (Certum, Sectigo, DigiCert). Cheaper, no hardware token needed. SmartScreen reputation builds over time with enough downloads.
- **EV (Extended Validation):** ~$300–500/year. Requires a hardware USB token. SmartScreen reputation is **immediate** — no waiting period.

**Recommendation:** For a first commercial release, start with OV from Certum or Sectigo. They're the most affordable reputable CAs for indie devs. If early users complain about SmartScreen warnings, upgrade to EV. EV is the right long-term choice but is a significant yearly cost to absorb before you know your revenue.

**What to avoid:** SignPath Foundation (referenced in CLAUDE.md) requires the project to be open source, which conflicts with selling it.

**Blocks:** Phase 5 distribution setup. Sign the builds before hosting them.

---

### R2. Licensing Model — Strategy Decision [#3]
**What:** Decide how you'll sell the app and how you'll enforce it.

**Key decisions:**
1. **One-time purchase vs. subscription** — One-time is easier to sell to streamers ("pay once, own it forever"). Subscription is better recurring revenue but harder to justify without ongoing content/features. Recommend one-time with optional upgrade pricing for major versions.
2. **Trial structure** — Time-based trial (e.g., 14 days free, no feature limits) is simpler and less frustrating than feature-gated trials. Recommend 14 days.
3. **What platform handles payment + license keys:**
   - **LemonSqueezy** — Best developer experience, has a proper license key API, good for Electron apps. Webhook support for real-time validation.
   - **Gumroad** — Simpler, smaller cut, but worse API/license key support.
   - **Paddle** — More enterprise-y, overkill for starting out.
   - **Recommendation: LemonSqueezy.** It generates license keys you can validate in-app via their API, supports webhooks, and handles EU VAT automatically.
4. **Validation approach:**
   - Validate the license key against LemonSqueezy's API on first activation.
   - Cache the result locally (encrypted) so the app works offline.
   - Re-validate periodically (e.g., once a week) when internet is available.
   - Don't require internet on every launch — that's the #1 complaint about licensed software.

**Piracy resistance:** This doesn't need to be Fort Knox. Your audience is streamers who value reputation. A reasonable license check + offline grace period is enough. Don't spend weeks on DRM.

**Blocks:** Phase 5 licensing UI build [#17].

---

### R3. Per-Sound Keyboard Shortcuts — Feasibility & Market Research [#19]
**What:** Can keyboard shortcuts trigger sounds even when the app is in the background?

**Feasibility:** Yes. Electron's `globalShortcut` module registers OS-level hotkeys that fire regardless of app focus or minimized state. This is already how your Stop All hotkey works. Per-sound shortcuts are architecturally the same — just more of them.

**Concerns to research:**
- Conflict management: Users assigning `F1` would break browser help. You need a conflict-warning system.
- How many shortcuts can realistically be registered? (Practically unlimited, but UX gets unwieldy past ~20.)
- What do competitors do? Research: Voicemod, Resanance, EXP Soundboard, Soundpad. All support global hotkeys. Most use the same `globalShortcut` pattern. Some let you assign per-button, some use a dedicated hotkey manager screen.

**Recommendation after research:** Assign shortcuts per-sound button via the existing context menu. Show a hotkey badge on the button. Include a "Hotkeys" section in settings that lists all assigned shortcuts and allows bulk management.

---

### R4. View Modes — Design Exploration [#12]
**What:** Should users be able to "solo" a category so it fills the whole grid without accordion chrome?

**Options to consider:**
1. **Current:** Accordion sections, sidebar scrolls to category.
2. **Solo mode:** Click sidebar → that category fills the grid, no accordion, just title + buttons. Sidebar gets "All" at top to return to full view.
3. **Tab mode:** Category names as tabs across the top (works for small numbers of categories, breaks with many).
4. **Flat grid:** No categories visible, all buttons in one grid, sidebar filters to category (hides all others).

**Recommendation:** Solo mode (option 2) is the most useful addition. It's great for live use — when you're mid-stream and want fast access to one category. All mode keeps the accordion experience. Implement as a toggle per sidebar click: first click scrolls (current behavior), second click solos. Or make it a view toggle button.

This one is worth prototyping before committing to the full build.

---

## Phase 1 — Structural Foundations
*Do these before adding any new features. They prevent technical debt from compounding.*

### 1.1 Data Storage Review [#16]
**What:** Audit `rrr-settings.json` and `rrr-soundboard.json` for structural issues before going to production.

**Things to verify:**
- All keys have sane defaults and migration handles missing keys gracefully.
- No settings that should be per-folder are currently global (or vice versa).
- The `GLOBAL_KEYS` split in main.js is complete and correct.
- No Proxy objects are being serialized through IPC (the known bug pattern is documented in CLAUDE.md — audit for any new cases added since).
- Device IDs are stored alongside labels for cross-session matching — verify this is robust.
- `playCounts` and `soundVolumes` don't accumulate stale entries for deleted sounds indefinitely.
- Verify `categoryOrder` and `soundOrder` handle category/sound deletion cleanly.

**New settings to plan for (from this roadmap):**
- Shadow record: output folder, duration, device, auto-open trim sidebar
- Clip trimming: delete after export (bool), clips folder path
- Multiple sound folders: list of paths, active folder
- Per-sound keyboard shortcuts: stored in folder settings
- Category colors: stored in folder settings
- User accent color: stored in global settings
- Trial start date / license key: stored in global settings (separately, not mixed with audio settings)

Plan the schema additions now even if you implement them later.

---

### 1.2 Stream Deck Update Flow Review [#15]
**What:** Verify that Stream Deck plugin updates are seamless — no manual steps for the user.

**Things to check:**
- Does the app correctly detect when a newer plugin version is bundled vs. what's installed?
- Is the version comparison correct (4-part semver)?
- Does the update flow handle the case where Stream Deck is running vs. stopped?
- Does it handle the case where the plugin is installed but the app hasn't been run yet?
- What happens if Stream Deck software isn't installed at all?
- Test the TEST_ flag scenarios in main.js to verify error states are surfaced correctly.

---

### 1.3 Audio Device Settings Overhaul [#6]
**What:** Move device configuration out of the main layout and into Settings. Remove the 2-device cap. Let users add as many output devices as they want.

**Changes:**
- Remove `DevicePanel.vue` and `DeviceCard.vue` from the main app layout.
- Add a "Devices" tab to `SettingsModal.vue`.
- UI: list of configured devices, each with device picker + volume slider + enable toggle + remove button. "Add Device" button at the bottom.
- Default on first launch: 2 devices (system default audio out + system default).
- The devices array in `GlobalSettings` already supports arbitrary length — just remove the 2-slot UI constraint.
- Update VB-Cable tutorial link to point to the new Devices tab location.

**Why Phase 1:** This changes the core layout. Better to do it before other features build UI assumptions on top of the current 2-device layout.

---

## Phase 2 — Branding & Visual Overhaul
*Establish the visual language before building new UI. Changing colors and fonts after the fact is painful.*

### 2.1 New Logo, Colors & Typography [#1]
**What:** Replace all visual design tokens, logo, and potentially fonts to match the new branding package.

**Steps:**
1. Export SVG and PNG assets from the `/design files/` Affinity files in the sizes needed (app icon, tray icon, Stream Deck icons, website use).
2. Identify the exact color values from the new branding (primary accent, background palette, text hierarchy).
3. Update all `@theme` tokens in `style.css` to match. Dark mode first, then light mode overrides.
4. Evaluate fonts — if a new font pairs better with the wordmark, swap it out. TavernloreBB may stay for the app name; body font is worth reconsidering.
5. Update `app-icon.png` in the project root and rebuild icons.
6. **User-customizable accent color:** Add an accent color picker to Settings → App tab. Store the chosen color in `GlobalSettings`. Override the `--color-accent` CSS variable on `<html>` at runtime.
   - For SVG icons: the icon system uses CSS mask with `background-color`, which means they already inherit the CSS variable. If `--color-accent` changes, SVG icons using that color change automatically. Verify this is true for all icon usage paths.
   - For duotone/colored icons: may need secondary variable for the secondary color.
7. Light mode: should look like a polished "light" app, not just inverted dark mode. Neutral warm whites, not grays. This is worth spending time on.

---

### 2.2 Dropdown & Context Menu Overhaul [#8]
**What:** Replace the current clunky dropdown/context menu implementation with something cleaner.

**Do this while the visual system is being rebuilt** — the new design tokens make it much easier to get dropdowns looking right.

**Problems to solve:**
- Menu positioning (flip up/down based on viewport space).
- Animation (quick scale-in, no jank).
- The "Move to…" inline expansion in the sound context menu should be more polished.
- Keyboard navigation (arrow keys, escape, enter) for accessibility.

Consider a shared `<Dropdown>` or `<ContextMenu>` component that all menus use, rather than each component rolling its own.

---

## Phase 3 — Core UX Feature Additions
*High-value features that improve daily usability. No major external dependencies.*

### 3.1 Multiple Soundboard Folders [#10]
**What:** Let users maintain multiple soundboard libraries and switch between them.

**UI:** Replace the single folder path in `FolderBar` with a dropdown of saved folders. A "+" button adds a new one. Active folder is highlighted.

**Data:**
- Global settings stores an array of folder paths + the active folder index.
- Each folder continues to have its own `rrr-soundboard.json`.
- Switching folders triggers a full library reload (same as current Browse flow).

**Why now:** This is a foundational UX change. Better to do it before shadow recording and clip trimming, since those features reference a "clips folder" that should be selectable in the same UI paradigm.

---

### 3.2 Category Color Coding [#7]
**What:** Let users assign a color to each category. That color tints: the sidebar nav item, the category section header, and the sound buttons in that category.

**UI:** Color swatch in `CategorySettingsModal → General` tab. A small palette of preset colors (not a full color picker — keep it fast).

**Storage:** Add `categoryColors: Record<string, string>` to `FolderSettings`.

**Implementation:** CSS custom property on each section's wrapper, inherited by buttons. Use semi-transparent tinting on buttons (not full color fill) so it doesn't clash with active/hover states.

---

### 3.3 View Mode: Solo Category [#12]
**What:** Implement the solo category view mode from the design exploration in Phase 0.

See R4 for design recommendation. Implement after the exploration confirms the approach.

---

### 3.4 Delete Sound File from UI [#9]
**What:** Right-click a sound button → "Delete File" option in context menu. Show a confirmation dialog before actually deleting.

**Implementation:**
- Add `delete-sound-file` IPC handler in main.js that calls `fs.unlink`.
- Add "Delete File" as the last/danger item in the SoundButton context menu.
- Confirmation modal: show the filename, "This cannot be undone." Two buttons: Cancel (default focus) + Delete (danger red).
- After deletion: remove the sound from the current library view, re-scan folder.

**Note:** This permanently deletes from disk. The confirmation UX is critical.

---

### 3.5 Keyboard Shortcut for Search [#11]
**What:** Press a configurable key combo (default: `Ctrl+F` or `/`) to focus the search input.

**Implementation:** Register a local keyboard listener in the app (not `globalShortcut` — this only needs to work when the app is focused). On keydown, focus `FolderBar`'s search input and select any existing text.

This is a 30-minute task. Do it whenever you have a small window.

---

### 3.6 Per-Sound Keyboard Shortcuts [#19]
**What:** Allow users to assign a keyboard shortcut to any sound that triggers it globally (even when the app is backgrounded).

**Implementation:**
- Storage: `soundHotkeys: Record<string, string>` in `FolderSettings` (maps sound key → shortcut string like `"F5"` or `"Ctrl+1"`).
- Context menu: "Set Shortcut" option → small inline key-capture input.
- Main process: on settings load, register all shortcuts via `globalShortcut.register()`. On settings change, unregister/re-register.
- Visual: small badge on the sound button showing the assigned key.
- Conflict detection: warn if a shortcut is already assigned to another sound or to a system action.

**Dependency:** Complete R3 research first.

---

## Phase 4 — Shadow Record & Clip Pipeline
*These are tightly coupled — build them together as a unit.*

### 4.1 Shadow Record Feature [#4]
**What:** Continuously buffer audio from a chosen input device. On trigger (button or hotkey), save the last X seconds to a clips folder as a file.

**Technical approach:**
- Use the Web Audio API to record from a `MediaStream` (via `getUserMedia` or `getDisplayMedia` for system audio).
- Maintain a rolling ring buffer of the last N seconds using `MediaRecorder` or manual `AudioBuffer` chunks.
- On trigger: flush the buffer to a file via IPC → `fs.writeFile`.
- Output format: `.wav` or `.ogg` (prefer `.wav` for no-loss, since these are going to be trimmed anyway).

**Settings to add (in Settings → Shadow Record tab):**
- Input device picker (which audio device to buffer)
- Buffer duration (5 / 10 / 15 / 30 / 60 seconds)
- Output folder (the clips folder)
- Auto-open trim sidebar on save (bool)
- Hotkey for save

**Important:** Windows system audio capture (e.g., your friend's game chat) requires either VB-Cable loopback or the WASAPI loopback API. Clarify this for users — you can only capture what's routable as an audio input device. The VB-Cable tutorial tie-in is important here.

---

### 4.2 Clip Trimming Mode [#5]
**What:** Two UIs for trimming clips from the shadow record folder and exporting them to a soundboard folder.

**Full-tab trim mode:**
- New tab/mode accessible from the main nav.
- Left panel: file list from the clips folder.
- Center: waveform visualization + start/end handle scrubbers.
- Playback controls: play from start handle, play selection, loop.
- Right panel: export settings — destination folder, filename, delete original (setting).
- Stream Deck integration still works while in this mode.

**Sidebar trim mode (quick trim):**
- A collapsible right sidebar that slides in over the sound grid.
- Shows a single clip (the most recently recorded, or user-selected).
- Same trimming controls but compact: waveform, two time inputs, play/export buttons.
- Auto-opens after shadow record if the setting is on.
- Close button collapses it back.

**Waveform rendering:** Use the Web Audio API's `AnalyserNode` or decode the audio and render peaks to a `<canvas>`. No external library needed for a basic waveform, but libraries like `wavesurfer.js` make this significantly easier if you're okay with the dependency.

**Export:** Trim is done in the renderer via `AudioBuffer` slicing → encode to WAV → send to main via IPC → `fs.writeFile` to destination. Then optionally `fs.unlink` the original.

---

### 4.3 Stream Deck: Shadow Record & Clip Edit Buttons [#21]
**What:** Two new Stream Deck actions:
1. **Save Shadow Recording** — triggers the shadow record save, same as the in-app button/hotkey.
2. **Open Clip Editor** — switches the app to clip trim mode (full-tab view).

**Implementation:**
- Add two new action types to the Stream Deck plugin (`packages/rrr-streamdeck/src/actions/`).
- Add corresponding WebSocket message types: `save-shadow-recording` and `open-clip-editor`.
- Handle in main.js → forward to renderer via IPC.
- Button images should follow the new branding style (from Phase 2).

---

## Phase 5 — Business Infrastructure
*Must be done before public launch. Has external dependencies (certificate purchase, service accounts).*

### 5.1 Code Signing Setup [#13]
**What:** Sign builds with the purchased certificate (from R1) so Windows trusts the installer.

**Implementation:**
- Add the certificate to the electron-builder config in `package.json`.
- Test the signing flow locally first.
- Verify SmartScreen no longer shows "Unknown Publisher."
- EV: requires the hardware token to be present during build — document this in the build process.

**Sign both:** the portable `.exe` and the NSIS installer `.exe`.

---

### 5.2 Licensing System — Backend + In-App [#3 + #17]
**What:** Implement trial tracking, license key activation, and the UI states that go with it.

**Trial logic (main process):**
- On first launch: record `trialStartDate` in global settings.
- On each launch: check `Date.now() - trialStartDate` against trial duration (e.g., 14 days).
- Trial state: `'trial' | 'expired' | 'licensed'`.
- Expose trial state to renderer via IPC.

**License activation:**
- Settings → License tab (or a dedicated modal): text input for license key + "Activate" button.
- On activate: call LemonSqueezy's license validation API with the key.
- If valid: store the license key + activation response locally (encrypted — use `safeStorage` from Electron, which uses the OS keychain).
- If invalid: show error.

**UI states needed [#17]:**
- **Trial active:** Subtle badge in the titlebar or statusbar ("Trial — X days left"). Non-intrusive.
- **Trial expired:** A blocking modal (can't dismiss) with "Your trial has ended" + "Buy Now" button (opens website) + "Enter License Key" button. No nag — just clear and actionable.
- **Licensed:** A small "Licensed" or checkmark indicator in Settings → License tab. No badge in the main UI — don't annoy paying customers.

**Enforcement:** Don't disable shadow record, shortcuts, etc. during trial — let them use everything. The goal is conversion, not punishment. The blocking expired modal is sufficient.

---

### 5.3 Distribution — Dokploy Build + Auto-Updater [#2]
**What:** Set up CI/CD to build signed releases and serve them for download + auto-update.

**Components:**
1. **Build pipeline on Dokploy:**
   - On push to `main` (or a `release` tag): build both portable and installer.
   - Upload both to a file host (can be Dokploy's own static hosting, S3, or Cloudflare R2).
   - Generate a `latest.yml` file that `electron-updater` will read.
2. **Auto-updater in the app:**
   - Add `electron-updater` package.
   - On startup: check the update URL for `latest.yml`.
   - If a newer version is available: show a non-blocking toast or statusbar message ("Update available — click to install").
   - Download in background, install on next launch (don't force-restart mid-session).
3. **Download page:**
   - Give users the option: "Download Installer (recommended)" or "Download Portable".
   - Installer is better for auto-update (can update in place). Portable is for users who want no-install.

**Note:** `electron-updater` works best with the NSIS installer target for auto-update on Windows. The portable `.exe` can still check for updates but requires re-downloading and replacing manually unless you build update logic yourself.

---

### 5.4 VB-Cable Tutorial Overhaul [#14]
**What:** Rewrite the in-app VB-Cable guide to be airtight and crystal clear. Add a YouTube embed.

**Goals:**
- Zero ambiguity. Every step should have a screenshot and one sentence of instruction.
- Add a YouTube tutorial embed in the modal (link to your video once recorded).
- Add a "Need Help?" link in Settings → Devices that opens the Help modal directly to the VB-Cable tab.
- Consider a first-run wizard: if no VB-Cable device is detected and it's the first launch, proactively surface the guide.

**Tie-in with shadow recording:** The VB-Cable guide should also mention that VB-Cable is needed for shadow recording other people's audio. Connect those dots for the user.

---

## Phase 6 — Stream Deck Visual Refresh

### 6.1 New Stream Deck Button Styles [#22]
**What:** Redesign all Stream Deck button images (Play Sound idle/playing, Stop All, Shadow Record, Clip Editor) to match the new branding from Phase 2.

**Do this after Phase 2 is locked** — you don't want to design these twice.

**Output:** Export as 72×72px PNG (Stream Deck standard). Update references in the plugin source.

---

## Phase 7 — Content & Discoverability

### 7.1 Sound Effects Resources [#18]
**What:** Add a "Get Sounds" or "Find Sound Effects" section somewhere in the app — links to free/paid SFX libraries.

**Candidates:** Freesound.org, Pixabay Sound, Zapsplat, SoundSnap, 99Sounds. Curate a short list.

**Implementation:** A section in the Help modal or a button in FolderBar that opens a small modal with links. Keep it low-friction — this is a discovery aid, not a store.

---

## Phase 8 — Website & Launch

### 8.1 Website, Marketing Copy & Videos [#20]
**What:** Build the marketing website where people can learn about the app, watch a demo, and buy.

**Pages needed:**
- Home — hero, key features, demo video, pricing/CTA
- Download — portal to the Dokploy-hosted builds
- Changelog / Patch Notes
- VB-Cable guide (mirrors the in-app guide, but web-accessible)
- License management (via LemonSqueezy customer portal)

**Copy + design:** This is a full creative effort. You'll need help generating copy, deciding on design direction, and making it cohesive with the app's new branding. Plan this as its own project once the app is feature-complete.

**Videos to produce:**
- 60-second trailer / demo
- VB-Cable setup tutorial
- Feature walkthroughs (shadow record, clip trimming, Stream Deck setup)

---

## Dependency Map (quick reference)

```
R1 (Code Signing Research) ──────────────────────────────────→ 5.1 (Sign Builds)
R2 (Licensing Model Decision) ───────────────────────────────→ 5.2 (Licensing System)
R3 (Hotkey Research) ────────────────────────────────────────→ 3.6 (Per-Sound Shortcuts)
R4 (View Mode Design) ───────────────────────────────────────→ 3.3 (Solo View)

1.1 (Data Review) ──────────┐
1.2 (SD Update Review)      ├──────────────────────────────→ Everything else
1.3 (Device Overhaul)  ─────┘

2.1 (Branding) ──────────────────────────────────────────────→ 6.1 (SD Button Styles)

4.1 (Shadow Record) ─────────────────────────────────────────→ 4.2 (Clip Trimming)
4.1 + 4.2 ───────────────────────────────────────────────────→ 4.3 (SD Buttons)

5.1 (Code Signing) ──────────────────────────────────────────→ 5.3 (Distribution)
5.2 (Licensing) ─────────────────────────────────────────────→ 5.3 (Distribution)
5.3 (Distribution) ──────────────────────────────────────────→ 8.1 (Website)
```

---

## Estimated Effort (rough, for sequencing purposes)

| Item | Effort |
|---|---|
| R1–R4 Research | 1–2 days (async, do while coding) |
| 1.1 Data review | 1 day |
| 1.2 SD update review | 0.5 day |
| 1.3 Device settings overhaul | 1–2 days |
| 2.1 Full branding overhaul | 3–5 days |
| 2.2 Dropdown overhaul | 1–2 days |
| 3.1 Multi-folder | 1–2 days |
| 3.2 Category colors | 1 day |
| 3.3 Solo view mode | 1–2 days |
| 3.4 Delete from UI | 0.5 day |
| 3.5 Search shortcut | 0.5 day |
| 3.6 Per-sound shortcuts | 2 days |
| 4.1 Shadow record | 3–5 days |
| 4.2 Clip trimming | 4–6 days |
| 4.3 SD shadow/clip buttons | 1 day |
| 5.1 Code signing setup | 0.5 day (after cert purchase) |
| 5.2 Licensing system | 3–4 days |
| 5.3 Distribution + auto-update | 2–3 days |
| 5.4 VB-Cable tutorial | 1–2 days |
| 6.1 SD button styles | 1–2 days |
| 7.1 SFX resources | 0.5 day |
| 8.1 Website + copy | 5–10 days (separate project) |

**Rough total (app only, excluding website):** 30–50 days of focused work.
