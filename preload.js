const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  getSettings: () => ipcRenderer.invoke("get-settings"),
  saveSettings: (s) => ipcRenderer.invoke("save-settings", s),
  getSounds: () => ipcRenderer.invoke("get-sounds"),
  pickFolder: () => ipcRenderer.invoke("pick-folder"),
  readSoundFile: (filePath) => ipcRenderer.invoke("read-sound-file", filePath),
});
