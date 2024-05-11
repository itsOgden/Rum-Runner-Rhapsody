import { platform } from 'node:process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BrowserWindow, app } from 'electron'

// https://github.com/electron/forge/issues/3502#issuecomment-2059567859
const __dirname = fileURLToPath(new URL('.', import.meta.url))

// TODO: Window Customization
// https://www.electronjs.org/docs/latest/tutorial/window-customization
function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
    },
  })

  win.loadURL('http://localhost:3000').then()
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0)
      createWindow()
  })
})

app.on('window-all-closed', () => {
  if (platform !== 'darwin')
    app.quit()
})
