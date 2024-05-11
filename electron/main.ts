import process from 'node:process'
import { BrowserWindow, app } from 'electron'

app.whenReady().then(() => {
  new BrowserWindow().loadURL(process.env.VITE_DEV_SERVER_URL || '').then()
})
