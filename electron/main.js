const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { WebSocketServer } = require("ws");

// ---------------------------------------------------------------------------
// Settings management — global + per-folder
// ---------------------------------------------------------------------------

// Global settings file — next to the exe (packaged) or project root (dev)
const GLOBAL_SETTINGS_FILE = path.join(
  app.isPackaged
    ? path.dirname(process.execPath)
    : path.join(__dirname, ".."),
  "rrr-settings.json"
);

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
      ws.send(JSON.stringify({ type: "sounds-list", sounds: buildWsSoundList(), folderSelected: true }));
    } else {
      ws.send(JSON.stringify({ type: "folder-status", folderSelected: false }));
    }

    ws.on("message", (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }

      if (msg.type === "get-sounds") {
        const folder = globalSettings.soundFolder;
        if (folder) {
          ws.send(JSON.stringify({ type: "sounds-list", sounds: buildWsSoundList(), folderSelected: true }));
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
  if (hasFolderKeys) {
    broadcastToClients({ type: "sounds-updated", sounds: buildWsSoundList(), folderSelected: true });
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
  broadcastToClients({ type: "sounds-updated", sounds: buildWsSoundList(), folderSelected: true });

  return { folder: newFolder, folderSettings: { ...folderSettings } };
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
