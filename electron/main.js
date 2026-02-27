const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { exec } = require("child_process");
const { WebSocketServer } = require("ws");

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

const DEFAULT_GLOBAL_SETTINGS = {
  soundFolder: "",
  windowWidth: 960,
  windowHeight: 680,
  theme: "dark",
  masterVolume: 1.0,
  density: "loose",
  devices: [
    { id: "", label: "", volume: 1.0, enabled: true },
    { id: "", label: "", volume: 1.0, enabled: true },
  ],
  hotkeys: { stop: "Escape" },
  playbackMode: "stop",
  normalize: false,
  streamDeckButtonMode: true,
};

// Per-folder settings file — stored inside each sound folder
const FOLDER_SETTINGS_FILENAME = "rrr-soundboard.json";

const DEFAULT_FOLDER_SETTINGS = {
  hiddenSounds: [],
  hiddenCategories: [],
  categoryNames: {},
  customCategories: [],
  soundCategories: {},
  collapsedCategories: [],
  soundNames: {},
  soundOrder: {},
  categoryOrder: [],
  playCounts: {},
};

const GLOBAL_KEYS = new Set(Object.keys(DEFAULT_GLOBAL_SETTINGS));

function loadGlobalSettings() {
  try {
    if (fs.existsSync(GLOBAL_SETTINGS_FILE)) {
      const raw = fs.readFileSync(GLOBAL_SETTINGS_FILE, "utf-8");
      return { ...DEFAULT_GLOBAL_SETTINGS, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.warn("Could not load global settings:", e.message);
  }
  return { ...DEFAULT_GLOBAL_SETTINGS };
}

function saveGlobalSettings(gs) {
  try {
    // Only write the global keys
    const toSave = {};
    for (const k of GLOBAL_KEYS) toSave[k] = gs[k];
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
      // Only keep folder-specific keys — ignores any stray global fields.
      const folderOnly = {};
      for (const k of Object.keys(DEFAULT_FOLDER_SETTINGS)) {
        if (k in parsed) folderOnly[k] = parsed[k];
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
    // Only write the folder keys
    const toSave = {};
    for (const k of Object.keys(DEFAULT_FOLDER_SETTINGS)) {
      toSave[k] = fs_settings[k];
    }
    fs.writeFileSync(filePath, JSON.stringify(toSave, null, 2), "utf-8");
  } catch (e) {
    console.warn("Could not save folder settings:", e.message);
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
let globalSettings = loadGlobalSettings();
let folderSettings = loadFolderSettings(globalSettings.soundFolder);
let wss = null;

// ---------------------------------------------------------------------------
// WebSocket server
// ---------------------------------------------------------------------------
function buildWsSoundList() {
  const folder = globalSettings.soundFolder;
  if (!folder) return [];

  const groups = discoverSounds(folder);
  const sc = folderSettings.soundCategories || {};
  const hiddenSet = new Set(folderSettings.hiddenSounds || []);
  const hiddenCategoriesSet = new Set(folderSettings.hiddenCategories || []);
  const customCats = folderSettings.customCategories || [];
  const catNames = folderSettings.categoryNames || {};
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
      displayName: catNames[group.folderName] ?? group.folderName,
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
      displayName: catNames[cat.id] ?? cat.id,
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

  // Flatten to the { key, displayName, category } shape expected by the PI
  const result = [];
  for (const section of sections) {
    for (const sound of section.sounds) {
      result.push({
        key: sound.key,
        displayName: sound.name,
        category: section.displayName,
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
  wss = new WebSocketServer({ host: "0.0.0.0", port: 57432 });

  wss.on("listening", () => {
    console.log("[WS] WebSocket server listening on port 57432");
  });

  wss.on("error", (err) => {
    console.error("[WS] WebSocket server error: " + err);
  });

  wss.on("connection", (ws) => {
    const folder = globalSettings.soundFolder;
    if (folder) {
      ws.send(JSON.stringify({ type: "sounds-list", sounds: buildWsSoundList(), folderSelected: true, buttonMode: globalSettings.streamDeckButtonMode }));
    } else {
      ws.send(JSON.stringify({ type: "folder-status", folderSelected: false }));
    }

    ws.on("message", (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }

      if (msg.type === "get-sounds") {
        const folder = globalSettings.soundFolder;
        if (folder) {
          ws.send(JSON.stringify({ type: "sounds-list", sounds: buildWsSoundList(), folderSelected: true, buttonMode: globalSettings.streamDeckButtonMode }));
        } else {
          ws.send(JSON.stringify({ type: "folder-status", folderSelected: false }));
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
    backgroundColor: "#0f1117",
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
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("resize", () => {
    const [w, h] = mainWindow.getSize();
    globalSettings.windowWidth = w;
    globalSettings.windowHeight = h;
  });

  mainWindow.on("closed", () => {
    saveGlobalSettings(globalSettings);
    saveFolderSettings(globalSettings.soundFolder, folderSettings);
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  startWebSocketServer();
});
app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => wss && wss.close());

// ---------------------------------------------------------------------------
// IPC handlers
// ---------------------------------------------------------------------------
ipcMain.handle("get-settings", () => {
  return { ...globalSettings, ...folderSettings };
});

ipcMain.handle("save-settings", (_event, newSettings) => {
  let hasFolderKeys = false;
  for (const [k, v] of Object.entries(newSettings)) {
    if (GLOBAL_KEYS.has(k)) {
      globalSettings[k] = v;
    } else {
      folderSettings[k] = v;
      hasFolderKeys = true;
    }
  }
  saveGlobalSettings(globalSettings);
  saveFolderSettings(globalSettings.soundFolder, folderSettings);
  if (hasFolderKeys || "streamDeckButtonMode" in newSettings) {
    broadcastToClients({ type: "sounds-updated", sounds: buildWsSoundList(), folderSelected: !!globalSettings.soundFolder, buttonMode: globalSettings.streamDeckButtonMode });
  }
  return { ...globalSettings, ...folderSettings };
});

ipcMain.handle("get-sounds", () => {
  return discoverSounds(globalSettings.soundFolder);
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
  saveGlobalSettings(globalSettings);

  // Load per-folder soundboard settings from the new folder (or defaults if none saved yet).
  // Device, hotkey, and playback settings are global and unaffected by folder changes.
  folderSettings = loadFolderSettings(newFolder);

  // Notify connected Stream Deck clients that the folder and sounds have changed.
  broadcastToClients({ type: "sounds-updated", sounds: buildWsSoundList(), folderSelected: true, buttonMode: globalSettings.streamDeckButtonMode });

  return { folder: newFolder, folderSettings: { ...folderSettings } };
});

ipcMain.on("ws-playing-status", (_event, playingKeys) => {
  broadcastToClients({ type: "playing-status", playingKeys });
});

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
