const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  getSettings: () => ipcRenderer.invoke("get-settings"),
  saveSettings: (s) => ipcRenderer.invoke("save-settings", s),
  getSounds: () => ipcRenderer.invoke("get-sounds"),
  pickFolder: () => ipcRenderer.invoke("pick-folder"),
  readSoundFile: (filePath) => ipcRenderer.invoke("read-sound-file", filePath),
  onWsPlaySound: (callback) => ipcRenderer.on("ws-play-sound", (_event, data) => callback(data)),
  onWsStopAll: (callback) => ipcRenderer.on("ws-stop-all", () => callback()),
  updatePlayingStatus: (keys) => ipcRenderer.send("ws-playing-status", keys),
  installStreamDeckPlugin: () => ipcRenderer.invoke("install-streamdeck-plugin"),
});
