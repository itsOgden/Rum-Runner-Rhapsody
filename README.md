# Soundboard — Dual-Output Soundboard for Windows 10/11

A portable desktop soundboard that plays audio clips to **two output devices simultaneously** — your headphones (so you can hear what you're playing) and a virtual audio cable (so others hear it through your "microphone" in Discord, Zoom, Teams, etc.).

Built with Electron. Distributes as a single portable `.exe` — no installation required for end users.

---

## Table of Contents

1. [For Users — Just Want to Use the Soundboard](#for-users)
2. [Installing VB-Cable](#installing-vb-cable)
3. [Configuring Windows Audio](#configuring-windows-audio)
4. [Using the Soundboard App](#using-the-soundboard-app)
5. [App-Specific Microphone Setup](#app-specific-microphone-setup)
6. [For Developers — Building from Source](#for-developers)
7. [Project Structure](#project-structure)
8. [Settings Reference](#settings-reference)
9. [Troubleshooting](#troubleshooting)

---

## For Users

### What You Need

1. **The Soundboard app** (a single `.exe` file — no install needed)
2. **VB-Cable** (a free virtual audio driver — one-time install, see below)
3. **A folder of sound files** (WAV, MP3, OGG, FLAC, etc.)

That's it. No Python, no Node.js, no command line. Just double-click and go.

---

## Installing VB-Cable

VB-Cable is a free virtual audio cable driver. It creates a virtual speaker ("CABLE Input") linked to a virtual microphone ("CABLE Output"). Audio sent to the virtual speaker automatically comes out of the virtual mic.

### Step 1: Download

Go to **https://vb-audio.com/Cable/** and click **Download** for Windows.

### Step 2: Extract

Unzip the downloaded file to any folder.

### Step 3: Install (Administrator Required)

1. Right-click **`VBCABLE_Setup_x64.exe`** (use the x64 version)
2. Select **"Run as administrator"**
3. Click **Install Driver**
4. **Restart your computer** — this is required

### Step 4: Verify

After restart:
1. Right-click the **speaker icon** in your system tray → **Sound settings**
2. Under **All sound devices** (or via "More sound settings"):
   - **Playback** tab should show **"CABLE Input (VB-Audio Virtual Cable)"**
   - **Recording** tab should show **"CABLE Output (VB-Audio Virtual Cable)"**

If both appear, you're good to go.

> **Note:** VB-Cable is donationware — free to use, but donations are appreciated by the developer.

---

## Configuring Windows Audio

### Fix Your Default Devices

VB-Cable installation sometimes changes your defaults. Check these:

1. Open **Settings → System → Sound**
2. **Output** should be your real headphones/speakers (NOT "CABLE Input")
3. **Input** should be your real microphone (NOT "CABLE Output")

### How the Audio Flows

```
┌──────────────┐         ┌──────────────────────┐
│  Soundboard  │────────▶│  Your Headphones     │  You hear it
│  App         │         └──────────────────────┘
│              │         ┌──────────────────────┐         ┌────────────────┐
│              │────────▶│  CABLE Input         │────────▶│  CABLE Output  │
└──────────────┘         │  (virtual speaker)   │         │  (virtual mic) │
                         └──────────────────────┘         └───────┬────────┘
                                                                  │
                                                          ┌───────▼────────┐
                                                          │  Discord/Zoom  │
                                                          │  hears it too  │
                                                          └────────────────┘
```

The soundboard plays each sound to two devices at once. Your headphones get the audio directly, and the VB-Cable routes it to what appears as a microphone to other apps.

---

## Using the Soundboard App

### First Launch

1. Double-click **Soundboard.exe** (or `Soundboard-Portable.exe`)
2. The app will ask for microphone permission — **click Allow** (this is needed so the app can see the names of your audio devices)
3. You'll see the main interface with device selectors at the top

### Configure Devices

1. **Primary Output (Headphones):** Select your headphones or speakers — this is what YOU hear
2. **Secondary Output (VB-Cable):** Select **"CABLE Input (VB-Audio Virtual Cable)"** — this feeds into the virtual mic
3. Use the **volume sliders** to set levels independently
4. Use the **toggle switches** to enable/disable either output

### Load Your Sounds

1. Click **Browse...** in the folder bar
2. Select a folder containing your audio files
3. Sound buttons appear in a grid — click any button to play!

### Controls

| Action | How |
|--------|-----|
| Play a sound | Click its button |
| Stop all sounds | Click **Stop All** or press **Escape** |
| Adjust volume | Drag the volume sliders |
| Disable an output | Toggle the switch next to the device |
| Change grid layout | Click **Settings** → change column count |
| Reload sounds | Click **Refresh** (if you added new files to the folder) |

### Settings

Click **Settings** in the top bar to adjust:
- **Grid Columns** — how many buttons per row (1–10)
- **Stop-All Hotkey** — which key stops playback (default: Escape)

All settings are saved automatically to `soundboard_settings.json` next to the app.

---

## App-Specific Microphone Setup

Tell your communication app to use VB-Cable's output as its microphone.

### Discord
1. **User Settings** → **Voice & Video**
2. **Input Device** → **"CABLE Output (VB-Audio Virtual Cable)"**
3. Disable "Automatically determine input sensitivity" and set the slider low
4. You may prefer **Push to Talk** mode to avoid silence issues

### Zoom
1. **Settings → Audio**
2. **Microphone** → **"CABLE Output (VB-Audio Virtual Cable)"**
3. Uncheck "Automatically adjust microphone volume"

### Microsoft Teams
1. Profile icon → **Settings → Devices**
2. **Microphone** → **"CABLE Output (VB-Audio Virtual Cable)"**

### Google Meet
1. Three dots → **Settings → Audio**
2. **Microphone** → **"CABLE Output (VB-Audio Virtual Cable)"**

### OBS Studio
1. **Settings → Audio**
2. **Mic/Auxiliary Audio** → **"CABLE Output (VB-Audio Virtual Cable)"**

> **Remember:** Switch your mic back to your real microphone when you're done using the soundboard, or people won't hear your voice!

### Want Both Your Voice AND the Soundboard?

The setup above replaces your real mic with the soundboard output. To get both simultaneously, use **VoiceMeeter Banana** (free, from the same developer as VB-Cable) — it can mix your real mic and VB-Cable together into a single virtual output.

---

## For Developers

### Prerequisites

- **Node.js 18+** — https://nodejs.org
- **pnpm** — https://pnpm.io (`npm install -g pnpm`)
- A code editor — **WebStorm** is ideal for this project (Electron/Node.js), but VS Code works too

### Setup

```bash
git clone <your-repo-url>
cd rum-runner-rhapsody
pnpm install
```

### Development

```bash
pnpm start
```

This launches Electron in dev mode. Changes to `renderer/index.html` take effect on reload (`Ctrl+R` in the app window). Changes to `main.js` or `preload.js` require restarting.

### Building for Distribution

#### Portable EXE (no install needed — recommended)
```bash
pnpm build
```
Output: `dist/Rum-Runner-Rhapsody.exe`

This is a single self-contained `.exe`. The user just drops it in any folder and runs it. Settings file is auto-created next to it.

#### Installer EXE (traditional setup wizard)
```bash
pnpm build:installer
```
Output: `dist/RRR-Setup.exe`

### What to Distribute

**For the portable build**, give your users:
```
Soundboard-Portable.exe       ← the app (single file)
README.md                      ← optional, for VB-Cable setup instructions
```

That's it. The settings file is created automatically on first run.

---

## Project Structure

```
soundboard/
├── main.js                  # Electron main process (window, IPC, file I/O)
├── preload.js               # Secure bridge between main and renderer
├── renderer/
│   └── index.html           # UI (HTML + CSS + JS, single file)
├── package.json             # Dependencies and build config
├── soundboard_settings.json # Auto-generated user settings
└── README.md                # This file
```

| File | Purpose |
|------|---------|
| `main.js` | Creates the window, handles file system access (reading sounds, picking folders), manages settings persistence |
| `preload.js` | Exposes a safe `window.api` object to the renderer via `contextBridge` |
| `renderer/index.html` | The entire UI — device selection, sound grid, audio playback via Web Audio API + `setSinkId()` |
| `package.json` | Electron + electron-builder config, build scripts |

### Key Technical Details

**Dual audio output** uses `AudioContext.setSinkId()` — a Web API that lets you route audio to a specific output device by its device ID. The app creates a separate `AudioContext` for each output device and plays the decoded audio through both simultaneously.

**Settings** are stored as a JSON file next to the executable. The main process handles read/write; the renderer communicates via IPC (`ipcRenderer.invoke` / `ipcMain.handle`).

**Security**: `contextIsolation: true` and `nodeIntegration: false` are set. The renderer cannot access Node.js directly — everything goes through the `preload.js` bridge.

---

## Settings Reference

`soundboard_settings.json` — auto-created and auto-saved.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `soundFolder` | string | `""` | Path to folder with sound files |
| `primaryDevice` | string | `""` | Primary output device name |
| `secondaryDevice` | string | `""` | Secondary output device name |
| `primaryVolume` | float | `1.0` | Primary volume (0.0 – 1.0) |
| `secondaryVolume` | float | `1.0` | Secondary volume (0.0 – 1.0) |
| `primaryEnabled` | bool | `true` | Primary output active |
| `secondaryEnabled` | bool | `true` | Secondary output active |
| `columns` | int | `4` | Sound grid columns |
| `stopHotkey` | string | `"Escape"` | Key to stop all playback |
| `windowWidth` | int | `960` | Window width (px) |
| `windowHeight` | int | `680` | Window height (px) |

---

## Troubleshooting

### "No audio devices show up" / devices show as "Default" only
The app needs microphone permission to read device labels. On first launch, click **Allow** when prompted. If you dismissed it, restart the app.

### "Others can't hear the soundboard"
- Secondary device must be **"CABLE Input (VB-Audio Virtual Cable)"**
- Your communication app's mic must be **"CABLE Output (VB-Audio Virtual Cable)"**
- Disable automatic input sensitivity in your app
- Test: play a sound and watch the input level meter in Discord/Zoom

### "VB-Cable devices don't appear"
- Restart your computer after installing VB-Cable
- Re-run the installer as administrator
- Check Device Manager → Sound controllers for "VB-Audio Virtual Cable"

### "Sound plays but is distorted or choppy"
- Try WAV files instead of compressed formats
- Close other audio-heavy apps
- Check that sample rates match (44100 Hz or 48000 Hz work best)

### "I hear an echo"
- Your default Windows output might be set to "CABLE Input" — change it back to your headphones
- Make sure only the soundboard sends to VB-Cable, not all system audio

### "The app won't start"
- Make sure you're running Windows 10 or 11 (64-bit)
- Try right-clicking → "Run as administrator"
- If Windows SmartScreen blocks it, click "More info" → "Run anyway"

### Reset Settings
Delete `soundboard_settings.json` next to the app. It will be recreated with defaults on next launch.

---

## Supported Audio Formats

| Format | Extension | Notes |
|--------|-----------|-------|
| WAV | `.wav` | Best — lowest latency |
| MP3 | `.mp3` | Widely supported |
| OGG | `.ogg` | Good quality, small size |
| FLAC | `.flac` | Lossless, larger files |
| WebM | `.webm` | Web-native format |
| AAC/M4A | `.aac`, `.m4a` | Common on macOS/iOS |

> **Tip:** WAV files at 44100 Hz or 48000 Hz give the best playback experience.
