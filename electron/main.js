const { app, BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage, shell, globalShortcut } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { exec } = require("child_process");
const { WebSocketServer } = require("ws");
// ---------------------------------------------------------------------------
// Schema migrations
// ---------------------------------------------------------------------------
// Each settings file tracks its own version independently.
// Files without a settingsVersion field are treated as v0 (pre-migration).
// To add a migration: append a function to the relevant array and increment
// the corresponding VERSION constant. The runner chains v0→v1→v2→... automatically.

const GLOBAL_VERSION = 2;
const FOLDER_VERSION = 1;
const STATS_VERSION  = 1;

// v0 → v1: remove devices[].id (opaque browser hash; label is used for matching)
function _migrateGlobalV0toV1(s) {
  return { ...s, settingsVersion: 1, devices: (s.devices || []).map(({ id, ...rest }) => rest) };
}
// v1 → v2: populate savedFolders from soundFolder for existing single-folder users
function _migrateGlobalV1toV2(s) {
  const saved = s.savedFolders ?? [];
  const extra = s.soundFolder && !saved.includes(s.soundFolder) ? [s.soundFolder] : [];
  return { ...s, settingsVersion: 2, savedFolders: [...saved, ...extra] };
}
const _GLOBAL_MIGRATIONS = [_migrateGlobalV0toV1, _migrateGlobalV1toV2];

function migrateGlobalSettings(settings) {
  let s = { ...settings };
  const start = s.settingsVersion ?? 0;
  for (let v = start; v < GLOBAL_VERSION; v++) s = _GLOBAL_MIGRATIONS[v](s);
  return s;
}

// v0 → v1:
//   soundCategories  → movedSounds
//   categoryNames    → sectionRenames (folder sections only; custom cat names move onto the object)
//   customCategories: { id, sounds[] } → { id, name }
//   playCounts       → extracted to rrr-stats.json (returned separately)
function _migrateFolderV0toV1(s) {
  const customCatIds = new Set((s.customCategories || []).map(c => c.id));
  const sectionRenames = {};
  for (const [k, v] of Object.entries(s.categoryNames || {})) {
    if (!customCatIds.has(k)) sectionRenames[k] = v;
  }
  const customCategories = (s.customCategories || []).map(c => ({
    id: c.id,
    name: (s.categoryNames || {})[c.id] ?? c.id,
  }));
  return {
    settingsVersion: 1,
    hiddenSounds:             s.hiddenSounds             ?? [],
    hiddenCategories:         s.hiddenCategories         ?? [],
    sectionRenames,
    customCategories,
    movedSounds:              s.soundCategories          ?? {},
    collapsedCategories:      s.collapsedCategories      ?? [],
    soundNames:               s.soundNames               ?? {},
    soundOrder:               s.soundOrder               ?? {},
    categoryOrder:            s.categoryOrder            ?? [],
    soundVolumes:             s.soundVolumes             ?? {},
    categoryStreamDeckImages: s.categoryStreamDeckImages ?? {},
  };
}
// v0→v1 is special-cased in migrateFolderSettings (it also extracts playCounts).
// Future migrations go here: _FOLDER_MIGRATIONS[0] = v1→v2, [1] = v2→v3, etc.
const _FOLDER_MIGRATIONS = [];

// Returns { folder: migratedSettings, extractedStats: { playCounts } | null }
function migrateFolderSettings(settings) {
  let s = { ...settings };
  let extractedStats = null;
  const start = s.settingsVersion ?? 0;
  if (start < 1) {
    extractedStats = { playCounts: s.playCounts ?? {} };
    s = _migrateFolderV0toV1(s);
  }
  // _FOLDER_MIGRATIONS[0] = v1→v2, so array index = version - 1
  for (let v = Math.max(start, 1); v < FOLDER_VERSION; v++) s = _FOLDER_MIGRATIONS[v - 1](s);
  return { folder: s, extractedStats };
}

// rrr-stats.json starts at v1. _STATS_MIGRATIONS[0] = v1→v2, [1] = v2→v3, etc.
const _STATS_MIGRATIONS = [];

function migrateStats(settings) {
  let s = { ...settings };
  const start = s.settingsVersion ?? 1;
  for (let v = start; v < STATS_VERSION; v++) s = _STATS_MIGRATIONS[v - 1](s);
  return s;
}

function getStatsFilePath(folderPath) {
  return path.join(folderPath, "rrr-stats.json");
}
// ---------------------------------------------------------------------------

// ─── STREAMDECK TEST OVERRIDES (set to false for production) ────────────────
const TEST_SD_STREAM_DECK_NOT_FOUND = false;  // simulates StreamDeck.exe not found (install succeeds, no auto-restart)
const TEST_SD_INSTALL_FAIL         = false;  // simulates copy failing with an error
const TEST_SD_NOT_INSTALLED        = false;  // simulates plugin not installed
const TEST_SD_UPDATE_AVAILABLE     = false;  // simulates installed version being outdated
const DEBUG_LOGGING                = false;  // set to true to enable rrr-debug.log output
// ────────────────────────────────────────────────────────────────────────────

// ---------------------------------------------------------------------------
// Settings management — global + per-folder
// ---------------------------------------------------------------------------

// Global settings file — next to the portable exe (packaged) or project root (dev).
// PORTABLE_EXECUTABLE_DIR is set by electron-builder's portable wrapper to the directory
// containing the .exe the user actually launched. process.execPath points to the electron
// binary inside the temp extraction dir, so we prefer PORTABLE_EXECUTABLE_DIR.
const settingsDir = app.isPackaged
  ? (process.env.PORTABLE_EXECUTABLE_DIR ?? path.dirname(process.execPath))
  : path.resolve(__dirname, "..");

const GLOBAL_SETTINGS_FILE = path.join(settingsDir, "rrr-settings.json");

// ─── DEBUG LOG ───────────────────────────────────────────────────────────────
const DEBUG_LOG_FILE = path.join(settingsDir, "rrr-debug.log");
function debugLog(...args) {
  if (!DEBUG_LOGGING) return;
  const line = `[${new Date().toISOString()}] ${args.join(" ")}\n`;
  try { fs.appendFileSync(DEBUG_LOG_FILE, line); } catch {}
  console.log(...args);
}
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_GLOBAL_SETTINGS = {
  soundFolder: "",
  savedFolders: [],
  folderDisplayNames: {},
  windowWidth: 960,
  windowHeight: 680,
  theme: "dark",
  masterVolume: 1.0,
  density: "loose",
  devices: [
    { label: "", volume: 1.0, enabled: true },
    { label: "", volume: 1.0, enabled: true },
  ],
  hotkeys: { stop: "Escape", search: "Space" },
  playbackMode: "stop",
  normalize: false,
  streamDeckButtonMode: true,
  streamDeckDefaultImages: {},
  showCategorySidebar: true,
  viewMode: "accordion",
  closeToTray: false,
  autoStart: false,
  launchMinimized: false,
  accentColor: "",
};

// Per-folder settings file — stored inside each sound folder
const FOLDER_SETTINGS_FILENAME = "rrr-soundboard.json";

const DEFAULT_FOLDER_SETTINGS = {
  hiddenSounds: [],
  hiddenCategories: [],
  sectionRenames: {},             // display-name overrides for folder sections
  customCategories: [],           // Array<{ id: string, name: string }>
  movedSounds: {},                // soundKey → categoryId for sounds moved from their default section
  collapsedCategories: [],
  soundNames: {},
  soundOrder: {},
  categoryOrder: [],
  soundVolumes: {},
  categoryStreamDeckImages: {},
  categoryColors: {},             // categoryId → hex color string
  soundHotkeys: {},               // soundKey → Electron accelerator string
};

// Stats are stored in rrr-stats.json alongside rrr-soundboard.json.
// They are merged into the settings object returned to the renderer so
// the renderer sees playCounts as a normal settings field.
const DEFAULT_STATS = {
  playCounts: {},
};

const GLOBAL_KEYS = new Set(Object.keys(DEFAULT_GLOBAL_SETTINGS));
const STATS_KEYS  = new Set(Object.keys(DEFAULT_STATS));

// ── Per-sound global hotkeys ──────────────────────────────────────────────────
const registeredSoundShortcuts = new Set();

function registerSoundHotkeys(soundHotkeys) {
  for (const combo of registeredSoundShortcuts) {
    try { globalShortcut.unregister(combo); } catch {}
  }
  registeredSoundShortcuts.clear();
  for (const [soundKey, combo] of Object.entries(soundHotkeys || {})) {
    if (!combo) continue;
    try {
      const ok = globalShortcut.register(combo, () => {
        mainWindow?.webContents.send("global-play-sound", { key: soundKey });
      });
      if (ok) registeredSoundShortcuts.add(combo);
    } catch {}
  }
}

function applyAutoStart(enabled) {
  // PORTABLE_EXECUTABLE_FILE is set by electron-builder's portable NSIS wrapper
  // to the full path of the portable exe the user actually launched.
  // PORTABLE_EXECUTABLE_DIR is only the directory — combining it with a hardcoded
  // filename is fragile and breaks when the artifact name differs from the string.
  const exePath = process.env.PORTABLE_EXECUTABLE_FILE ?? process.execPath;
  debugLog("applyAutoStart path: " + exePath + ", enabled: " + enabled);
  app.setLoginItemSettings({
    openAtLogin: enabled,
    name: "Rum-Runner Rhapsody",
    path: exePath,
    args: enabled ? ["--autostarted"] : [],
  });
}

function loadGlobalSettings() {
  try {
    if (fs.existsSync(GLOBAL_SETTINGS_FILE)) {
      const raw = fs.readFileSync(GLOBAL_SETTINGS_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      const migrated = migrateGlobalSettings(parsed);
      if ((parsed.settingsVersion ?? 0) < GLOBAL_VERSION) {
        saveGlobalSettings(migrated);
        debugLog("Migrated global settings to v" + GLOBAL_VERSION);
      }
      const merged = { ...DEFAULT_GLOBAL_SETTINGS, ...migrated };
      // Deep-merge nested objects so new sub-keys added to defaults in a future
      // version are not silently dropped when loading settings from an older save.
      merged.hotkeys = { ...DEFAULT_GLOBAL_SETTINGS.hotkeys, ...(migrated.hotkeys || {}) };
      merged.streamDeckDefaultImages = { ...DEFAULT_GLOBAL_SETTINGS.streamDeckDefaultImages, ...(migrated.streamDeckDefaultImages || {}) };
      // Normalize device entries so any fields missing from older saves get correct defaults.
      if (Array.isArray(merged.devices)) {
        merged.devices = merged.devices.map(d => ({
          label: d.label ?? "",
          volume: d.volume ?? 1.0,
          enabled: d.enabled ?? true,
        }));
      }
      return merged;
    }
  } catch (e) {
    console.warn("Could not load global settings:", e.message);
  }
  return { ...DEFAULT_GLOBAL_SETTINGS };
}

function saveGlobalSettings(gs) {
  try {
    const toSave = {};
    for (const k of GLOBAL_KEYS) toSave[k] = gs[k];
    toSave.settingsVersion = GLOBAL_VERSION;
    fs.writeFileSync(GLOBAL_SETTINGS_FILE, JSON.stringify(toSave, null, 2), "utf-8");
  } catch (e) {
    console.warn("Could not save global settings:", e.message);
  }
}

function getFolderSettingsPath(folder) {
  return path.join(folder, FOLDER_SETTINGS_FILENAME);
}

function loadFolderSettings(folder) {
  if (!folder) return { ...DEFAULT_FOLDER_SETTINGS };
  try {
    const filePath = getFolderSettingsPath(folder);
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      const { folder: migrated, extractedStats } = migrateFolderSettings(parsed);
      if ((parsed.settingsVersion ?? 0) < FOLDER_VERSION) {
        saveFolderSettings(folder, migrated);
        debugLog("Migrated folder settings to v" + FOLDER_VERSION);
      }
      // If migration extracted playCounts, write them to rrr-stats.json
      if (extractedStats) {
        const statsPath = getStatsFilePath(folder);
        if (!fs.existsSync(statsPath)) {
          const toSave = { ...extractedStats, settingsVersion: STATS_VERSION };
          fs.writeFileSync(statsPath, JSON.stringify(toSave, null, 2), "utf-8");
          debugLog("Created rrr-stats.json from migrated playCounts");
        }
      }
      const folderOnly = {};
      for (const k of Object.keys(DEFAULT_FOLDER_SETTINGS)) {
        if (k in migrated) folderOnly[k] = migrated[k];
      }
      return { ...DEFAULT_FOLDER_SETTINGS, ...folderOnly };
    }
  } catch (e) {
    console.warn("Could not load folder settings:", e.message);
  }
  return { ...DEFAULT_FOLDER_SETTINGS };
}

function saveFolderSettings(folder, fs_settings) {
  if (!folder) return;
  try {
    const filePath = getFolderSettingsPath(folder);
    const toSave = {};
    for (const k of Object.keys(DEFAULT_FOLDER_SETTINGS)) {
      toSave[k] = fs_settings[k];
    }
    toSave.settingsVersion = FOLDER_VERSION;
    fs.writeFileSync(filePath, JSON.stringify(toSave, null, 2), "utf-8");
  } catch (e) {
    console.warn("Could not save folder settings:", e.message);
  }
}

function loadStats(folder) {
  if (!folder) return { ...DEFAULT_STATS };
  try {
    const statsPath = getStatsFilePath(folder);
    if (fs.existsSync(statsPath)) {
      const raw = fs.readFileSync(statsPath, "utf-8");
      const parsed = JSON.parse(raw);
      const migrated = migrateStats(parsed);
      return { ...DEFAULT_STATS, ...migrated };
    }
  } catch (e) {
    console.warn("Could not load stats:", e.message);
  }
  return { ...DEFAULT_STATS };
}

function saveStats(folder, statsObj) {
  if (!folder) return;
  try {
    const statsPath = getStatsFilePath(folder);
    const toSave = {};
    for (const k of Object.keys(DEFAULT_STATS)) toSave[k] = statsObj[k];
    toSave.settingsVersion = STATS_VERSION;
    fs.writeFileSync(statsPath, JSON.stringify(toSave, null, 2), "utf-8");
  } catch (e) {
    console.warn("Could not save stats:", e.message);
  }
}

// ---------------------------------------------------------------------------
// Sound file discovery — grouped by folder
// ---------------------------------------------------------------------------
const SUPPORTED_EXTENSIONS = new Set([".wav", ".flac", ".ogg", ".mp3", ".webm", ".aac", ".m4a"]);

function readAudioFiles(dir) {
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => {
        try {
          return SUPPORTED_EXTENSIONS.has(path.extname(f).toLowerCase()) &&
            fs.statSync(path.join(dir, f)).isFile();
        } catch { return false; }
      })
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
      .map((f) => ({
        name: path.parse(f).name,
        filename: f,
        path: path.join(dir, f),
      }));
  } catch (e) {
    console.warn("Could not read directory:", dir, e.message);
    return [];
  }
}

function discoverSounds(folder) {
  if (!folder || !fs.existsSync(folder)) return [];

  const groups = [];

  try {
    const entries = fs.readdirSync(folder, { withFileTypes: true });

    // Root-level sounds
    const rootSounds = readAudioFiles(folder);
    if (rootSounds.length > 0) {
      groups.push({
        folderName: path.basename(folder),
        folderPath: folder,
        sounds: rootSounds,
      });
    }

    // Immediate subdirectories (one level deep)
    const subdirs = entries
      .filter((e) => e.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

    for (const subdir of subdirs) {
      const subdirPath = path.join(folder, subdir.name);
      const subdirSounds = readAudioFiles(subdirPath);
      if (subdirSounds.length > 0) {
        groups.push({
          folderName: subdir.name,
          folderPath: subdirPath,
          sounds: subdirSounds,
        });
      }
    }
  } catch (e) {
    console.warn("Could not scan sound folder:", e.message);
  }

  return groups;
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
let mainWindow;
let tray = null;
let isQuitting = false;
let globalSettings = loadGlobalSettings();
let folderSettings = loadFolderSettings(globalSettings.soundFolder);
let stats = loadStats(globalSettings.soundFolder);
let wss = null;

// ---------------------------------------------------------------------------
// WebSocket server
// ---------------------------------------------------------------------------
function buildWsSoundList() {
  const folder = globalSettings.soundFolder;
  if (!folder) return [];

  const groups = discoverSounds(folder);
  const sc = folderSettings.movedSounds || {};
  const hiddenSet = new Set(folderSettings.hiddenSounds || []);
  const hiddenCategoriesSet = new Set(folderSettings.hiddenCategories || []);
  const customCats = folderSettings.customCategories || [];
  const sectionRenames = folderSettings.sectionRenames || {};
  const soundNames = folderSettings.soundNames || {};
  const soundOrder = folderSettings.soundOrder || {};
  const categoryOrder = folderSettings.categoryOrder || [];

  // Build a key -> { name, path } map for all sounds (needed for moved sounds)
  const soundMap = {};
  for (const group of groups) {
    const relFolder = path.relative(folder, group.folderPath).replace(/\\/g, "/");
    for (const sound of group.sounds) {
      const key = relFolder ? relFolder + "/" + sound.filename : sound.filename;
      soundMap[key] = { key, name: sound.name, originalFolder: group.folderName };
    }
  }

  function applySoundOrder(sounds, sectionId) {
    const order = soundOrder[sectionId] || [];
    if (order.length > 0) {
      const indexMap = new Map(order.map((k, i) => [k, i]));
      sounds.sort((a, b) => {
        const ia = indexMap.has(a.key) ? indexMap.get(a.key) : Infinity;
        const ib = indexMap.has(b.key) ? indexMap.get(b.key) : Infinity;
        if (ia !== ib) return ia - ib;
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      });
    } else {
      sounds.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    }
  }

  const sections = [];

  // Folder sections
  for (const group of groups) {
    if (hiddenCategoriesSet.has(group.folderName)) continue;

    const relFolder = path.relative(folder, group.folderPath).replace(/\\/g, "/");
    const nativeKeys = new Set();
    for (const sound of group.sounds) {
      const key = relFolder ? relFolder + "/" + sound.filename : sound.filename;
      nativeKeys.add(key);
    }

    // Native sounds not moved away
    const nativeSounds = group.sounds
      .map(s => {
        const key = relFolder ? relFolder + "/" + s.filename : s.filename;
        const movedTo = sc[key];
        if (movedTo && movedTo !== group.folderName) return null;
        if (hiddenSet.has(key)) return null;
        return { key, name: soundNames[key] ?? s.name };
      })
      .filter(Boolean);

    // Sounds from other groups moved into this folder section
    const movedIn = Object.entries(sc)
      .filter(([key, catId]) => catId === group.folderName && !nativeKeys.has(key))
      .map(([key]) => soundMap[key])
      .filter(s => s && !hiddenSet.has(s.key))
      .map(s => ({ key: s.key, name: soundNames[s.key] ?? s.name }));

    const sounds = [...nativeSounds, ...movedIn];
    applySoundOrder(sounds, group.folderName);

    sections.push({
      id: group.folderName,
      displayName: sectionRenames[group.folderName] ?? group.folderName,
      sounds,
    });
  }

  // Custom category sections
  for (const cat of customCats) {
    if (hiddenCategoriesSet.has(cat.id)) continue;

    const sounds = Object.entries(sc)
      .filter(([, catId]) => catId === cat.id)
      .map(([key]) => soundMap[key])
      .filter(s => s && !hiddenSet.has(s.key))
      .map(s => ({ key: s.key, name: soundNames[s.key] ?? s.name }));

    applySoundOrder(sounds, cat.id);

    sections.push({
      id: cat.id,
      displayName: cat.name,
      sounds,
    });
  }

  // Apply manual category order
  if (categoryOrder.length > 0) {
    const indexMap = new Map(categoryOrder.map((id, i) => [id, i]));
    sections.sort((a, b) => {
      const ia = indexMap.has(a.id) ? indexMap.get(a.id) : Infinity;
      const ib = indexMap.has(b.id) ? indexMap.get(b.id) : Infinity;
      return ia - ib;
    });
  }

  // Flatten to the { key, displayName, category, categoryId } shape expected by the PI
  const result = [];
  for (const section of sections) {
    for (const sound of section.sounds) {
      result.push({
        key: sound.key,
        displayName: sound.name,
        category: section.displayName,
        categoryId: section.id,
      });
    }
  }
  return result;
}

function broadcastToClients(payload) {
  if (!wss) return;
  const msg = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client.readyState === 1 /* OPEN */) client.send(msg);
  }
}

function startWebSocketServer() {
  wss = new WebSocketServer({ host: "127.0.0.1", port: 57432 });

  wss.on("listening", () => {
    console.log("[WS] WebSocket server listening on port 57432");
  });

  wss.on("error", (err) => {
    console.error("[WS] WebSocket server error: " + err);
  });

  wss.on("connection", (ws) => {
    const folder = globalSettings.soundFolder;
    if (folder) {
      ws.send(JSON.stringify({ type: "sounds-list", sounds: buildWsSoundList(), folderSelected: true, buttonMode: globalSettings.streamDeckButtonMode, categoryStreamDeckImages: folderSettings.categoryStreamDeckImages || {}, streamDeckDefaultImages: globalSettings.streamDeckDefaultImages || {}, accentColor: globalSettings.accentColor || "#F9B71D" }));
    } else {
      ws.send(JSON.stringify({ type: "folder-status", folderSelected: false, streamDeckDefaultImages: globalSettings.streamDeckDefaultImages || {}, accentColor: globalSettings.accentColor || "#F9B71D" }));
    }

    ws.on("message", (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }

      if (msg.type === "get-sounds") {
        const folder = globalSettings.soundFolder;
        if (folder) {
          ws.send(JSON.stringify({ type: "sounds-list", sounds: buildWsSoundList(), folderSelected: true, buttonMode: globalSettings.streamDeckButtonMode, categoryStreamDeckImages: folderSettings.categoryStreamDeckImages || {}, streamDeckDefaultImages: globalSettings.streamDeckDefaultImages || {}, accentColor: globalSettings.accentColor || "#F9B71D" }));
        } else {
          ws.send(JSON.stringify({ type: "folder-status", folderSelected: false, streamDeckDefaultImages: globalSettings.streamDeckDefaultImages || {}, accentColor: globalSettings.accentColor || "#F9B71D" }));
        }
      } else if (msg.type === "play-sound" && msg.key) {
        mainWindow?.webContents.send("ws-play-sound", { key: msg.key });
      } else if (msg.type === "stop-all") {
        mainWindow?.webContents.send("ws-stop-all");
      }
    });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: globalSettings.windowWidth,
    height: globalSettings.windowHeight,
    minWidth: 640,
    minHeight: 480,
    frame: false,
    titleBarStyle: "hidden",
    backgroundColor: "#000000",
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    if (process.env.OPEN_DEVTOOLS !== 'false') mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  if (process.env.VITE_DEV_SERVER_URL) {
    const { globalShortcut } = require("electron");
    globalShortcut.register("F12", () => {
      mainWindow?.webContents.toggleDevTools();
    });
  }

  mainWindow.once("ready-to-show", () => {
    const wasAutoStarted = process.argv.includes("--autostarted");
    if (!(globalSettings.launchMinimized && wasAutoStarted)) {
      mainWindow.show();
    }
  });

  // Fallback: if loading fails the window may be stuck hidden — show it anyway.
  mainWindow.webContents.once("did-fail-load", () => {
    debugLog("Window did-fail-load — forcing show");
    mainWindow?.show();
  });

  mainWindow.on("maximize", () => {
    mainWindow.webContents.send("window-maximized", true);
  });

  mainWindow.on("unmaximize", () => {
    mainWindow.webContents.send("window-maximized", false);
  });

  mainWindow.on("close", (e) => {
    if (!isQuitting && globalSettings.closeToTray) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on("resize", () => {
    const [w, h] = mainWindow.getSize();
    globalSettings.windowWidth = w;
    globalSettings.windowHeight = h;
  });

  mainWindow.on("closed", () => {
    saveGlobalSettings(globalSettings);
    saveFolderSettings(globalSettings.soundFolder, folderSettings);
    saveStats(globalSettings.soundFolder, stats);
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  try {
    debugLog("app.whenReady — starting initialization");

    // Push the JSON setting into the registry on every launch.
    // This keeps the registry in sync with rrr-settings.json and re-registers
    // the correct exe path if the portable exe has been moved.
    applyAutoStart(globalSettings.autoStart);

    createWindow();
    registerSoundHotkeys(folderSettings.soundHotkeys || {});

    // Kill any lingering process occupying port 57432, then start the WS server.
    // At login time netstat/taskkill can hang or fail, so a 2-second timeout
    // ensures we proceed regardless.
    let wsStarted = false;
    function maybeStartWss() {
      if (wsStarted) return;
      wsStarted = true;
      startWebSocketServer();
    }
    const killTimeout = setTimeout(() => {
      debugLog("Port-kill timed out — starting WS server anyway");
      maybeStartWss();
    }, 2000);
    exec("netstat -ano | findstr :57432", (err, stdout) => {
      try {
        const pids = [...new Set(
          (stdout || "").trim().split("\n")
            .map(l => l.trim().split(/\s+/).pop())
            .filter(p => p && /^\d+$/.test(p) && p !== "0")
        )];
        if (pids.length > 0) {
          exec(`taskkill /F ${pids.map(p => `/PID ${p}`).join(" ")}`, () => {
            clearTimeout(killTimeout);
            maybeStartWss();
          });
          return;
        }
      } catch (e) {
        debugLog("Port-kill parse error:", e.message);
      }
      clearTimeout(killTimeout);
      maybeStartWss();
    });

  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, "app-icon.png")
    : path.join(__dirname, "..", "app-icon.png");

  debugLog("Tray icon path: " + iconPath + " exists: " + fs.existsSync(iconPath));
  const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  tray = new Tray(trayIcon);
  tray.setToolTip("Rum-Runner Rhapsody");
  const contextMenu = Menu.buildFromTemplate([
    { label: "Open", click: () => { mainWindow?.show(); mainWindow?.focus(); } },
    { label: "Quit", click: () => app.quit() },
  ]);
  tray.setContextMenu(contextMenu);
  tray.on("click", () => { mainWindow?.show(); mainWindow?.focus(); });
    debugLog("app.whenReady — initialization complete");
  } catch (e) {
    debugLog("FATAL error during app initialization:", e.stack || e.message);
    throw e;
  }
});

app.on("before-quit", () => {
  isQuitting = true;
  wss && wss.close();
  if (mainWindow) {
    saveGlobalSettings(globalSettings);
    saveFolderSettings(globalSettings.soundFolder, folderSettings);
    saveStats(globalSettings.soundFolder, stats);
  }
});

app.on("window-all-closed", () => app.quit());

// ---------------------------------------------------------------------------
// IPC handlers
// ---------------------------------------------------------------------------
ipcMain.handle("get-changelog", () => {
  const changelogPath = app.isPackaged
    ? path.join(process.resourcesPath, "CHANGELOG.md")
    : path.resolve(__dirname, "..", "CHANGELOG.md");
  try {
    return fs.readFileSync(changelogPath, "utf8");
  } catch {
    return null;
  }
});

ipcMain.handle("get-settings", () => {
  debugLog("get-settings: autoStart=" + globalSettings.autoStart + " closeToTray=" + globalSettings.closeToTray + " launchMinimized=" + globalSettings.launchMinimized);
  return { ...globalSettings, ...folderSettings, ...stats };
});

ipcMain.handle("save-settings", (_event, newSettings) => {
  let globalDirty = false, folderDirty = false, statsDirty = false;
  for (const [k, v] of Object.entries(newSettings)) {
    if (GLOBAL_KEYS.has(k)) {
      globalSettings[k] = v;
      globalDirty = true;
    } else if (STATS_KEYS.has(k)) {
      stats[k] = v;
      statsDirty = true;
    } else {
      folderSettings[k] = v;
      folderDirty = true;
    }
  }
  if (globalDirty) saveGlobalSettings(globalSettings);
  if (folderDirty) saveFolderSettings(globalSettings.soundFolder, folderSettings);
  if (statsDirty) saveStats(globalSettings.soundFolder, stats);
  if ("autoStart" in newSettings) {
    applyAutoStart(newSettings.autoStart);
  }
  if ("soundHotkeys" in newSettings) {
    registerSoundHotkeys(folderSettings.soundHotkeys || {});
  }
  if (folderDirty || "streamDeckButtonMode" in newSettings || "streamDeckDefaultImages" in newSettings || "accentColor" in newSettings) {
    broadcastToClients({ type: "sounds-updated", sounds: buildWsSoundList(), folderSelected: !!globalSettings.soundFolder, buttonMode: globalSettings.streamDeckButtonMode, categoryStreamDeckImages: folderSettings.categoryStreamDeckImages || {}, streamDeckDefaultImages: globalSettings.streamDeckDefaultImages || {}, accentColor: globalSettings.accentColor || "#F9B71D" });
  }
  return { ...globalSettings, ...folderSettings, ...stats };
});

ipcMain.handle("get-sounds", () => {
  const groups = discoverSounds(globalSettings.soundFolder);
  broadcastToClients({ type: "sounds-updated", sounds: buildWsSoundList(), folderSelected: !!globalSettings.soundFolder, buttonMode: globalSettings.streamDeckButtonMode, categoryStreamDeckImages: folderSettings.categoryStreamDeckImages || {}, streamDeckDefaultImages: globalSettings.streamDeckDefaultImages || {}, accentColor: globalSettings.accentColor || "#F9B71D" });
  return groups;
});

ipcMain.handle("pick-folder", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
    title: "Select Sound Folder",
  });
  if (result.canceled || result.filePaths.length === 0) return null;

  const newFolder = result.filePaths[0];
  const oldFolder = globalSettings.soundFolder;

  // Save current per-folder settings to the old folder before switching
  if (oldFolder) {
    saveFolderSettings(oldFolder, folderSettings);
  }

  // Update global
  globalSettings.soundFolder = newFolder;
  if (!globalSettings.savedFolders.includes(newFolder)) {
    globalSettings.savedFolders = [...globalSettings.savedFolders, newFolder];
  }
  saveGlobalSettings(globalSettings);

  // Load per-folder soundboard settings and stats from the new folder.
  // Device, hotkey, and playback settings are global and unaffected by folder changes.
  folderSettings = loadFolderSettings(newFolder);
  stats = loadStats(newFolder);
  registerSoundHotkeys(folderSettings.soundHotkeys || {});

  // Notify connected Stream Deck clients that the folder and sounds have changed.
  broadcastToClients({ type: "sounds-updated", sounds: buildWsSoundList(), folderSelected: true, buttonMode: globalSettings.streamDeckButtonMode, categoryStreamDeckImages: folderSettings.categoryStreamDeckImages || {}, streamDeckDefaultImages: globalSettings.streamDeckDefaultImages || {}, accentColor: globalSettings.accentColor || "#F9B71D" });

  return { folder: newFolder, folderSettings: { ...folderSettings, ...stats }, savedFolders: globalSettings.savedFolders };
});

ipcMain.handle("switch-folder", async (_event, newFolder) => {
  if (globalSettings.soundFolder === newFolder) return null;
  const oldFolder = globalSettings.soundFolder;
  if (oldFolder) saveFolderSettings(oldFolder, folderSettings);
  globalSettings.soundFolder = newFolder;
  saveGlobalSettings(globalSettings);
  folderSettings = loadFolderSettings(newFolder);
  stats = loadStats(newFolder);
  registerSoundHotkeys(folderSettings.soundHotkeys || {});
  broadcastToClients({ type: "sounds-updated", sounds: buildWsSoundList(), folderSelected: true, buttonMode: globalSettings.streamDeckButtonMode, categoryStreamDeckImages: folderSettings.categoryStreamDeckImages || {}, streamDeckDefaultImages: globalSettings.streamDeckDefaultImages || {}, accentColor: globalSettings.accentColor || "#F9B71D" });
  return { folder: newFolder, folderSettings: { ...folderSettings, ...stats }, savedFolders: globalSettings.savedFolders };
});

ipcMain.handle("remove-folder", async (_event, targetFolder) => {
  const isActive = globalSettings.soundFolder === targetFolder;
  globalSettings.savedFolders = globalSettings.savedFolders.filter(f => f !== targetFolder);

  let switched = null;
  if (isActive) {
    saveFolderSettings(targetFolder, folderSettings);
    if (globalSettings.savedFolders.length > 0) {
      const nextFolder = globalSettings.savedFolders[0];
      globalSettings.soundFolder = nextFolder;
      folderSettings = loadFolderSettings(nextFolder);
      stats = loadStats(nextFolder);
      registerSoundHotkeys(folderSettings.soundHotkeys || {});
      switched = { folder: nextFolder, folderSettings: { ...folderSettings, ...stats }, savedFolders: globalSettings.savedFolders };
    } else {
      globalSettings.soundFolder = "";
      folderSettings = { ...DEFAULT_FOLDER_SETTINGS };
      stats = { ...DEFAULT_STATS };
      registerSoundHotkeys({});
    }
    broadcastToClients({ type: "sounds-updated", sounds: buildWsSoundList(), folderSelected: !!globalSettings.soundFolder, buttonMode: globalSettings.streamDeckButtonMode, categoryStreamDeckImages: folderSettings.categoryStreamDeckImages || {}, streamDeckDefaultImages: globalSettings.streamDeckDefaultImages || {}, accentColor: globalSettings.accentColor || "#F9B71D" });
  }

  saveGlobalSettings(globalSettings);
  return { savedFolders: globalSettings.savedFolders, switched };
});

ipcMain.handle("check-file-exists", (_event, filePath) => {
  return fs.existsSync(filePath);
});

ipcMain.handle("trash-sound-file", async (_event, filePath) => {
  await shell.trashItem(filePath);
});

ipcMain.handle("pick-image", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    title: "Select Image",
    filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "svg"] }],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.on("ws-playing-status", (_event, playingKeys) => {
  broadcastToClients({ type: "playing-status", playingKeys });
});

// ---------------------------------------------------------------------------
// Window control IPC
// ---------------------------------------------------------------------------
ipcMain.on("window-minimize", () => mainWindow?.minimize());
ipcMain.on("window-maximize", () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on("window-close", () => mainWindow?.close());
ipcMain.handle("window-is-maximized", () => mainWindow?.isMaximized() ?? false);
ipcMain.on("open-external", (_event, url) => shell.openExternal(url));

ipcMain.handle("read-sound-file", (_event, filePath) => {
  try {
    const buffer = fs.readFileSync(filePath);
    return buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength
    );
  } catch (e) {
    console.error("Could not read file:", e.message);
    return null;
  }
});

// ---------------------------------------------------------------------------
// Stream Deck plugin installer
// ---------------------------------------------------------------------------

function compareVersions(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na < nb) return -1;
    if (na > nb) return 1;
  }
  return 0;
}

function copyDirSync(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirSync(srcPath, destPath);
    else fs.copyFileSync(srcPath, destPath);
  }
}

ipcMain.handle("install-streamdeck-plugin", () => {
  if (TEST_SD_INSTALL_FAIL)
    return { success: false, message: "Test: install failed — simulated error", restartingStreamDeck: false };
  if (TEST_SD_STREAM_DECK_NOT_FOUND)
    return { success: true, message: "Test: installed (StreamDeck.exe not found)", restartingStreamDeck: false };

  try {
    const pluginName = "com.pdog1.rum-runner-rhapsody.sdPlugin";
    const srcPath = app.isPackaged
      ? path.join(process.resourcesPath, "streamdeck-plugin", pluginName)
      : path.join(__dirname, "..", "packages", "rrr-streamdeck", pluginName);

    const pluginsDir = path.join(
      os.homedir(), "AppData", "Roaming", "Elgato", "StreamDeck", "Plugins"
    );

    if (!fs.existsSync(pluginsDir)) {
      return { success: false, message: "Stream Deck plugins folder not found. Is Stream Deck installed?", restartingStreamDeck: false };
    }

    const destPath = path.join(pluginsDir, pluginName);
    copyDirSync(srcPath, destPath);

    const sdPaths = [
      "C:\\Program Files\\Elgato\\StreamDeck\\StreamDeck.exe",
      "C:\\Program Files (x86)\\Elgato\\StreamDeck\\StreamDeck.exe",
    ];
    const sdExe = sdPaths.find((p) => fs.existsSync(p));

    exec("taskkill /F /IM StreamDeck.exe", () => {
      if (sdExe) {
        setTimeout(() => {
          exec(`start "" "${sdExe}"`);
        }, 1500);
      }
    });

    return { success: true, message: "Plugin installed successfully!", restartingStreamDeck: !!sdExe };
  } catch (e) {
    console.error("Failed to install SD plugin:", e.message);
    return { success: false, message: `Install failed: ${e.message}`, restartingStreamDeck: false };
  }
});

ipcMain.handle("get-streamdeck-plugin-status", () => {
  try {
    const pluginName = "com.pdog1.rum-runner-rhapsody.sdPlugin";

    const bundledManifestPath = app.isPackaged
      ? path.join(process.resourcesPath, "streamdeck-plugin", pluginName, "manifest.json")
      : path.join(__dirname, "..", "packages", "rrr-streamdeck", pluginName, "manifest.json");

    let bundledVersion = "0.0.0";
    try {
      const manifest = JSON.parse(fs.readFileSync(bundledManifestPath, "utf-8"));
      bundledVersion = manifest.Version ?? "0.0.0";
    } catch (e) {
      console.warn("Could not read bundled plugin manifest:", e.message);
    }

    if (TEST_SD_NOT_INSTALLED)
      return { bundledVersion, installedVersion: null, needsUpdate: false, isInstalled: false };
    if (TEST_SD_UPDATE_AVAILABLE)
      return { bundledVersion, installedVersion: "0.0.0.0", needsUpdate: true, isInstalled: true };

    const installedManifestPath = path.join(
      os.homedir(), "AppData", "Roaming", "Elgato", "StreamDeck", "Plugins",
      pluginName, "manifest.json"
    );

    let installedVersion = null;
    let isInstalled = false;

    if (fs.existsSync(installedManifestPath)) {
      isInstalled = true;
      try {
        const manifest = JSON.parse(fs.readFileSync(installedManifestPath, "utf-8"));
        installedVersion = manifest.Version ?? null;
      } catch (e) {
        console.warn("Could not read installed plugin manifest:", e.message);
      }
    }

    const needsUpdate = isInstalled && installedVersion !== null
      ? compareVersions(installedVersion, bundledVersion) < 0
      : false;

    return { bundledVersion, installedVersion, needsUpdate, isInstalled };
  } catch (e) {
    console.error("Failed to get plugin status:", e.message);
    return { bundledVersion: "0.0.0", installedVersion: null, needsUpdate: false, isInstalled: false };
  }
});
