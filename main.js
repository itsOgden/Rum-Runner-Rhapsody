const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

// ---------------------------------------------------------------------------
// Settings management
// ---------------------------------------------------------------------------
const SETTINGS_FILE = path.join(
  app.isPackaged
    ? path.dirname(process.execPath)
    : __dirname,
  "soundboard_settings.json"
);

const DEFAULT_SETTINGS = {
  soundFolder: "",
  primaryDevice: "",
  secondaryDevice: "",
  primaryVolume: 1.0,
  secondaryVolume: 1.0,
  primaryEnabled: true,
  secondaryEnabled: true,
  columns: 4,
  stopHotkey: "Escape",
  windowWidth: 960,
  windowHeight: 680,
};

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, "utf-8");
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.warn("Could not load settings:", e.message);
  }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(settings) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf-8");
  } catch (e) {
    console.warn("Could not save settings:", e.message);
  }
}

// ---------------------------------------------------------------------------
// Sound file discovery
// ---------------------------------------------------------------------------
const SUPPORTED_EXTENSIONS = new Set([".wav", ".flac", ".ogg", ".mp3", ".webm", ".aac", ".m4a"]);

function discoverSounds(folder) {
  if (!folder || !fs.existsSync(folder)) return [];
  try {
    return fs
      .readdirSync(folder)
      .filter((f) => SUPPORTED_EXTENSIONS.has(path.extname(f).toLowerCase()))
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
      .map((f) => ({
        name: path.parse(f).name,
        filename: f,
        path: path.join(folder, f),
      }));
  } catch (e) {
    console.warn("Could not read sound folder:", e.message);
    return [];
  }
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
let mainWindow;
let settings = loadSettings();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: settings.windowWidth,
    height: settings.windowHeight,
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

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("resize", () => {
    const [w, h] = mainWindow.getSize();
    settings.windowWidth = w;
    settings.windowHeight = h;
  });

  mainWindow.on("closed", () => {
    saveSettings(settings);
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());

// ---------------------------------------------------------------------------
// IPC handlers
// ---------------------------------------------------------------------------
ipcMain.handle("get-settings", () => settings);

ipcMain.handle("save-settings", (_event, newSettings) => {
  settings = { ...settings, ...newSettings };
  saveSettings(settings);
  return settings;
});

ipcMain.handle("get-sounds", () => {
  return discoverSounds(settings.soundFolder);
});

ipcMain.handle("pick-folder", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
    title: "Select Sound Folder",
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const folder = result.filePaths[0];
  settings.soundFolder = folder;
  saveSettings(settings);
  return folder;
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
