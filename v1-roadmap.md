# Rum-Runner Rhapsody — v1.0.0 Roadmap

> Working document. Items are numbered for reference and grouped into phases by dependency order and risk.
> Original list item numbers are noted in brackets for cross-reference.

---

## Phase 0 — Research & Decisions
*Things you need to decide before you can build. Do these in parallel with Phase 1.*

### R1. Code Signing — Decision: OV via Certum [#13]
**What:** Get a code signing certificate so Windows doesn't show SmartScreen "Unknown Publisher" warnings to users.

**Decision: OV only.** As of August 2024, Microsoft dropped the EV advantage — EV no longer bypasses the SmartScreen reputation queue. There is no reason to pay EV prices. OV is the correct choice.

**SmartScreen reality:** Even with OV signing, first-time users will see a "Windows protected your PC" warning with a "More info → Run anyway" flow until Microsoft builds reputation for the certificate. This is not avoidable at launch and is a known pain point for every indie Windows dev. It resolves as installs accumulate (typically a few hundred). Your trial model actually helps here — more people running the app = faster reputation. Set expectations accordingly.

**Where to buy:** Certum OV via a reseller (sslmentor.com, sslcertshop.com). Certum's "SimplySign" option provides cloud-based signing — no USB hardware token, works directly with signtool.exe. Estimated ~$120–170/year through a reseller. Note: as of February 2026, max certificate lifespan changed to ~459 days, so all certs are now effectively annual.

**What to avoid:** SignPath Foundation requires open-source projects. EV is not worth the cost.

**Blocks:** Phase 5 distribution setup. Sign the builds before hosting them.

---

### R2. Licensing Model — Decision: One-Time Purchase via LemonSqueezy [#3]
**What:** Decide how you'll sell the app and how you'll enforce it.

**Decisions made:**
1. **One-time purchase.** No subscription. "Pay once, own it forever." Launch with a discounted early-access price, raise to full price after. Sales and time-limited offers handled via LemonSqueezy discount codes (percentage or fixed, with optional expiry date and usage caps — all built in, no extra work).
2. **Trial:** 14 days, no feature limits. Blocking modal on expiry with "Buy Now" and "Enter License Key" options.
3. **Platform: LemonSqueezy.**
   - Handles payment, license key generation, EU VAT/GST in 100+ countries, customer portal, and webhooks.
   - Has hosted product pages — you link/redirect to LS checkout from your own website, or embed their checkout widget. You keep your brand throughout.
   - Better API and lower fees (~3.5% + $0.30) vs Gumroad (flat 10%). Gumroad's marketplace discovery advantage doesn't apply to desktop software where you drive your own traffic.
   - Built specifically for software/SaaS; Gumroad is better for digital art/ebooks.
   - Requires account approval (~1 week wait time — apply early).
4. **Validation approach:**
   - Validate license key against LemonSqueezy API on first activation.
   - Cache result locally via Electron's `safeStorage` (OS keychain — encrypted).
   - Re-validate periodically (once a week) when online.
   - Never require internet on every launch.

**Piracy resistance:** Reasonable license check + offline grace period is enough. Streamers value reputation. Don't spend weeks on DRM.

**Distribution channels:**
- **Primary:** Own website → LemonSqueezy checkout. All paid transactions here.
- **itch.io:** List the trial as a free download for discovery. When trial expires, app points users to the website to buy. Do NOT also sell on itch — bridging two separate license key systems requires a custom backend and isn't worth it at this stage. Itch = top-of-funnel only.
- **Microsoft Store, Steam:** Post-v1 consideration only. Both have technical and financial overhead not worth taking on at launch.
- **Product Hunt:** Plan a single launch-day post for awareness. Not a storefront, just a spike driver.

**Blocks:** Phase 5 licensing system build [#17].

---

### R3. Per-Sound Keyboard Shortcuts — Decision: Build It [#19]
**What:** Can keyboard shortcuts trigger sounds even when the app is in the background?

**Decision: Yes, build it.** Electron's `globalShortcut` module registers OS-level hotkeys that fire regardless of app focus or minimized state — same as the existing Stop All hotkey. Competitors (Voicemod, Resanance, EXP Soundboard, Soundpad) all support this. Proceed to Phase 3.6 implementation.

**Implementation notes for Phase 3.6:**
- Store shortcuts in `FolderSettings` (`soundHotkeys: Record<string, string>`) so they travel with the library.
- Assign via context menu: "Set Shortcut" → key-capture input.
- Show hotkey badge on the button face.
- Settings → Shortcuts tab: list all assigned shortcuts, allow bulk management and clearing.
- Conflict detection: warn if a combo is already assigned to another sound or to the Stop All hotkey. Warn on known system shortcuts (`F1`, `Ctrl+C`, `Alt+F4`, `Win+*`) — no API exists to query all OS-registered shortcuts, so best-effort warning is fine.
- Unregister/re-register all shortcuts on settings change.

---

### R4. View Modes — Decision: Build Flat Grid Mode [#12]
**What:** Add an alternate view mode alongside the current accordion layout.

**Decision: Build flat grid mode as a toggleable view option.** The current accordion view remains the default. A view toggle in FolderBar switches between modes.

**Flat grid mode behavior:**
- All buttons rendered in one continuous grid, no category section headers, no accordions.
- Sidebar gets "All" at the top — shows every button.
- Clicking a sidebar category filters to just that category's buttons (no headers, just buttons).
- Drag-and-drop disabled in flat mode (meaningless without section context).
- Category colors (Phase 3.2) still apply to button tinting.

**Tabs and permanent-replacement flat views:** Not building these. The toggle approach is cleaner.

**May be hidden/disabled before v1.0 release** if it feels unpolished — that's acceptable, build it and evaluate.

---

## Phase 1 — Structural Foundations
*Do these before adding any new features. They prevent technical debt from compounding.*

### 1.1 Data Storage Review [#16]
**Status: Audited 2026-05-13.**

**What:** Audit `rrr-settings.json` and `rrr-soundboard.json` for structural issues before going to production.

**Findings:**
- ✅ All keys have sane defaults; migration handles missing keys via object spread with defaults.
- ✅ Global/folder/stats split is correct. `GLOBAL_KEYS` is auto-derived from `DEFAULT_GLOBAL_SETTINGS`, so it can never drift.
- ✅ Devices matched by label (not ID) — v0→v1 migration strips the opaque browser `id`. Correct and intentional.
- ✅ `GLOBAL_KEYS`/`STATS_KEYS` routing in `save-settings` is complete and covers all current fields.
- ✅ **Stale entry accumulation:** `playCounts`, `soundVolumes`, `movedSounds`, `soundOrder`, and `categoryOrder` retain entries for sounds/categories that no longer exist on disk. This is intentional — if a user temporarily moves a file away and moves it back, their volume offsets, play counts, and ordering are all preserved. No cleanup needed.
- ✅ **Proxy serialization:** Fixed — `useSettings.saveSettings` now wraps the payload in `toRaw()` before IPC, so callers no longer need to manually spread reactive objects. The nested-object spread pattern in CLAUDE.md still applies when *constructing* the value passed to `saveSettings`.

**New settings to plan for (from this roadmap) — not yet added:**
- Shadow record: output folder, duration, device, auto-open trim sidebar
- Clip trimming: delete after export (bool), clips folder path
- Multiple sound folders: list of paths, active folder index
- Per-sound keyboard shortcuts: `soundHotkeys: Record<string, string>` in `FolderSettings`
- Category colors: `categoryColors: Record<string, string>` in `FolderSettings`
- User accent color: `accentColor?: string` in `GlobalSettings`
- Trial start date / license key: separate from audio settings in `GlobalSettings` (e.g. `trialStartDate`, `licenseKey`)

---

### 1.2 Stream Deck Update Flow Review [#15]
**Status: Audited 2026-05-13 — all clear.**

**What:** Verify that Stream Deck plugin updates are seamless — no manual steps for the user.

**Findings:**
- ✅ Version detection reads both bundled and installed `manifest.json` files and compares with `compareVersions`.
- ✅ `compareVersions` handles 4-part semver correctly (pads shorter versions with 0).
- ✅ SD running: `taskkill /F /IM StreamDeck.exe` kills it, then relaunches after a 1.5s delay if the exe path is found.
- ✅ SD stopped or not running: `taskkill` fails silently, copy still succeeds, `restartingStreamDeck: false` returned to UI.
- ✅ SD not installed: `pluginsDir` existence check returns a clear user-facing error message before attempting copy.
- ✅ All four `TEST_` flags (`TEST_SD_NOT_INSTALLED`, `TEST_SD_UPDATE_AVAILABLE`, `TEST_SD_INSTALL_FAIL`, `TEST_SD_STREAM_DECK_NOT_FOUND`) are wired up and cover all major error states.
- ✅ If installed manifest can't be parsed, `needsUpdate` conservatively returns `false` rather than forcing an update.

---

### 1.3 Audio Device Settings Overhaul [#6]
**Status: Done.**

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
**Status: Done 2026-05-14.**

### 2.1 New Logo, Colors & Typography [#1]
**Status: Done.**

- ✅ New logo/wordmark (wordmark.svg), app icon, color tokens in `@theme`, light mode overrides
- ✅ TavernloreBB display font, Outfit body font
- ✅ User-customizable accent color: 16-color `ColorPalette.vue` component in Settings → Appearance tab; `accentColor` stored in GlobalSettings; `--color-accent` + `--color-accent-dim` overridden at runtime in App.vue via `darkenHex()`; `--color-accent-glow` auto-derives via CSS relative color syntax
- ✅ Light mode overhauled to neutral grays (no warm tint, works with any accent); grain disabled in light mode
- ✅ CSS cleanup: removed unused `--radius-md`, stale `--color-warning`/`--color-danger-glow` (were already gone); `colorPalette.ts` centralizes 16 palette colors for reuse in Phase 3.2 category colors
- ✅ Settings → Appearance tab (Theme + Accent Color) split out from App tab

---

### 2.2 Dropdown & Context Menu Overhaul [#8]
**Status: Done.**

- ✅ `AppSelect.vue` — custom styled dropdown replacing all native `<select>` elements (theme picker, device pickers); keyboard nav (arrow/enter/escape) on trigger; teleported + animated; integrates with `activeDropdownId` singleton
- ✅ SoundButton context menu — scale-in/fade enter animation via `<Transition name="sound-menu">`; keyboard navigation (ArrowDown/ArrowUp cycle through buttons, Escape closes)
- ✅ Menu positioning already flipped up/down based on viewport

---

## Phase 3 — Core UX Feature Additions
*High-value features that improve daily usability. No major external dependencies.*

### 3.1 Multiple Soundboard Folders [#10]
**Status: Done 2026-05-15.**

- ✅ `savedFolders: string[]` added to `GlobalSettings`; `GLOBAL_VERSION` bumped to 2 with migration (populates from existing `soundFolder`)
- ✅ `pick-folder` adds new folder to `savedFolders`; new `switch-folder` and `remove-folder` IPC handlers
- ✅ FolderBar: Browse button replaced with folder-switcher dropdown (active highlighted, click to switch, × to remove); "+" icon button to add; all same animation/design-language as AppSelect
- ✅ Remove active folder → auto-switches to first remaining, or clears if none left
- ✅ Each folder still has its own `rrr-soundboard.json` and `rrr-stats.json`

---

### 3.2 Category Color Coding [#7]
**Status: Done 2026-05-15.**

**Design principle:** category colors are organizational labels, not action signals. Gold is the app's interactive language (playing state, active indicators). Category color only touches identity/labeling elements and never competes with gold.

- ✅ `categoryColors: Record<string, string>` added to `FolderSettings` and `DEFAULT_FOLDER_SETTINGS`
- ✅ `color?: string` added to `SoundSection`; populated in `buildSections()` from `categoryColors`
- ✅ `setCategoryColor()` added to `useSoundManagement`
- ✅ CategorySettingsModal → General tab: 17-swatch `ColorPalette` + inline "Remove" link when a color is active; Restore Defaults also clears the color
- ✅ AccordionSection header: 6px colored dot (`w-1.5 h-1.5 rounded-full`) between chevron and title; hidden during search filter; section title text, separator line, and all button styles are completely unchanged
- ✅ SoundGrid sidebar: same 6px dot always rendered (transparent placeholder when no color, preserving alignment); hover/active/selected text color, active background tint, and `::before` bar use the category color via `--nav-hover-color` and `--nav-active-bg` CSS custom properties with gold fallbacks
- ✅ Sound buttons: untouched — no tinting, no border changes, no shadow changes; all playing states (comet, halo, bottom glow) remain gold

---

### 3.3 View Mode: Flat Grid [#12]
**Status: Done 2026-05-15.**

- ✅ `viewMode: 'accordion' | 'flat'` added to `GlobalSettings` (default `'accordion'`)
- ✅ FolderBar: "Sections · Flat" text toggle in the right controls (before density toggle)
- ✅ Flat mode sidebar: prepends "All" item; clicking a category sets `flatActiveCategoryId` to filter the grid; resets to 'all' on folder switch
- ✅ Flat mode grid: single continuous `SoundButton` grid, no AccordionSection, no DnD (naturally absent — sound buttons aren't wrapped in section DnD containers)
- ✅ Accordion mode: fully unchanged; sidebar still uses scroll-to-section behavior

---

### 3.4 Delete Sound File from UI [#9]
**Status: Done.**

- ✅ `trash-sound-file` IPC handler added to main.js using `shell.trashItem(filePath)` — sends to OS Recycle Bin, not permanent delete
- ✅ `trashSoundFile` exposed via preload.js and typed in `WindowApi`
- ✅ "Move to Recycle Bin…" danger item at bottom of SoundButton context menu (scrollable section, top-border separator)
- ✅ Inline confirmation: shows filename + Cancel / Delete buttons; resets on menu close or outside click
- ✅ After deletion: calls `loadSounds()` to refresh the grid

---

### 3.5 Keyboard Shortcut for Search [#11]
**Status: Done.** Uses `Space` to focus search (existing behavior preserved). Configurable key capture not needed — Space is the right call for a soundboard app.

**Implementation:** Register a local keyboard listener in the app (not `globalShortcut` — this only needs to work when the app is focused). On keydown, focus `FolderBar`'s search input and select any existing text.

---

### 3.6 Per-Sound Keyboard Shortcuts [#19]
**What:** Allow users to assign a keyboard shortcut to any sound that triggers it globally (even when the app is backgrounded).

**Implementation:**
- Storage: `soundHotkeys: Record<string, string>` in `FolderSettings` (maps sound key → shortcut string like `"F5"` or `"Ctrl+1"`).
- Context menu: "Set Shortcut" option → small inline key-capture input (must **listen** for keystrokes, not require typing — same pattern as the existing Stop All hotkey capture in Settings → Keybinds).
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
- Certum SimplySign works as a virtual smart card — no hardware token needed during build.

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

### 5.5 Legal Documents
**What:** Required before public launch. Not optional.

**Privacy Policy — legally required.**
The app phones home for license validation and auto-update checks, which means you're processing personal data (email addresses, IP addresses). GDPR applies to EU users; CCPA applies to California users. Generate using [Termly](https://termly.io) or [iubenda](https://www.iubenda.com) — boilerplate from a generator is fine for launch. Publish on the website and link to it from the app's Settings → License tab.

Key things it must cover:
- What data is collected (email for licensing, IP incidental to server calls)
- That LemonSqueezy processes payments (they have their own privacy policy as MoR)
- That auto-update checks ping your server
- No analytics collected (Cloudflare aggregate stats only — no user-level tracking)

**EULA (End User License Agreement) — strongly recommended.**
Establishes: they're buying a license, not ownership. They cannot redistribute, resell, or reverse engineer the app. Limitation of liability. Embed in the NSIS installer as the "I agree" checkbox (electron-builder supports this natively). Also publish on the website above the purchase button. Use a software EULA template and adapt it — no lawyer needed at launch.

**Refund Policy — 30 days.**
Decision: 30-day full refund, no questions asked. Generous given the free trial, but friendly and chargeback-resistant. Specify in LemonSqueezy store settings and on the website.

**Cookie/analytics policy — not needed.** No user-level analytics. Cloudflare aggregate stats don't require disclosure.

---

### 5.6 Support Infrastructure
**What:** Set up support channels before public launch so users have somewhere to go.

**Discord server:**
- Create a server for Rum-Runner Rhapsody.
- Channels to start: `#announcements` (post-only), `#support`, `#bug-reports`, `#feedback`, `#general`.
- Link from the app (Help modal or Settings) and from the website.
- This is your primary support channel — streamers already live here.

**Support email:**
- Address: `support@rumrunner.app`
- Forward to your personal Gmail so you're not managing a separate inbox.
- Used for: license issues, refunds, users who won't use Discord.
- See domain/email note below for where to set this up.

**In-app support links:**
- Help modal: link to Discord + support email.
- Trial expired modal: include a support link so confused users don't just bounce.
- License activation failure: "Having trouble? Contact support" link.

**Domain & email setup (do this when registering the website domain):**
- **Domain: `rumrunner.app`** — registered via Cloudflare Registrar ($14.20/year). `.app` requires HTTPS by default. Do not use GoDaddy for anything.
- For email: use **Zoho Mail free tier**. Supports custom domains, up to 5 mailboxes, 5GB each. Set MX records to point to Zoho, create `support@` address, forward to personal Gmail. Free, professional, no ongoing cost.
- Hover is fine if you prefer to keep things consolidated there, but Cloudflare + Zoho is cheaper and the setup is a one-time 20 minutes.
- Do NOT use a `@gmail.com` address for support — it looks unprofessional for a paid product.

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

---

## Post-v1 Backlog — Deferred Until User Demand Warrants

### Mac Build
- **Decision: Defer.** Available Mac hardware is 8-10 years old and may not support Electron 33 (requires macOS 10.15+). The right solution when demand arrives is **GitHub Actions macOS runners** — CI builds and notarizes automatically on push, no manual hardware steps. Also requires: Apple Developer Program ($99/year), notarization setup in electron-builder, and a Mac-specific VB-Cable tutorial (equivalent: BlackHole, free). Add when users request it.

### Linux Build
- **Decision: Defer.** No Linux test environment currently available. electron-builder supports `.AppImage` and `.deb` with minimal extra config, and no signing is required. The blocker is testing, not building. Once CI is set up for Mac (or separately), adding Linux as an additional target is low effort. Add when users request it.

### Microsoft Store
- **Decision: Defer.** Free registration as of 2026, 15% cut. Requires MSIX packaging and moving settings storage from next to the exe to `%APPDATA%` (sandbox requirement). Non-trivial code change. Worth revisiting if organic growth plateaus.

### Steam
- **Decision: Defer.** $100 listing fee, 30% cut. Meaningful discovery for the streamer market but not worth the overhead at launch.
