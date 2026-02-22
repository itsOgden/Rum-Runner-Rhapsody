const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

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
};

// Per-folder settings file — stored inside each sound folder
const FOLDER_SETTINGS_FILENAME = "rrr-settings.json";

const DEFAULT_FOLDER_SETTINGS = {
  primaryDevice: "",
  secondaryDevice: "",
  primaryVolume: 1.0,
  secondaryVolume: 1.0,
  primaryEnabled: true,
  secondaryEnabled: true,
  columns: 4,
  stopHotkey: "Escape",
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
      return { ...DEFAULT_FOLDER_SETTINGS, ...JSON.parse(raw) };
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

app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());

// ---------------------------------------------------------------------------
// IPC handlers
// ---------------------------------------------------------------------------
ipcMain.handle("get-settings", () => {
  return { ...globalSettings, ...folderSettings };
});

ipcMain.handle("save-settings", (_event, newSettings) => {
  for (const [k, v] of Object.entries(newSettings)) {
    if (GLOBAL_KEYS.has(k)) {
      globalSettings[k] = v;
    } else {
      folderSettings[k] = v;
    }
  }
  saveGlobalSettings(globalSettings);
  saveFolderSettings(globalSettings.soundFolder, folderSettings);
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

  // Load per-folder settings from the new folder
  folderSettings = loadFolderSettings(newFolder);

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
