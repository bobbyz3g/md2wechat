import { app, BrowserWindow } from 'electron'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { ConfigStore } from './configStore'
import { registerIpcHandlers } from './ipc'
import { buildApplicationMenu } from './menu'
import { IPC_CHANNELS, type CloseResolution } from '../shared/types'

let mainWindow: BrowserWindow | null = null
let removeIpcHandlers: (() => void) | null = null
let allowClose = false
const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const isSquirrelStartup = require('electron-squirrel-startup') as boolean

async function createWindow(configStore: ConfigStore) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 680,
    webPreferences: {
      preload: path.join(currentDirectory, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  })

  const rendererFilePath = path.join(
    currentDirectory,
    `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`,
  )
  const rendererUrl =
    MAIN_WINDOW_VITE_DEV_SERVER_URL ?? pathToFileURL(rendererFilePath).toString()

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', (event, targetUrl) => {
    if (!isAllowedNavigation(targetUrl, rendererUrl)) {
      event.preventDefault()
    }
  })
  mainWindow.webContents.session.setPermissionRequestHandler(
    (_webContents, _permission, callback) => callback(false),
  )

  mainWindow.on('close', (event) => {
    if (allowClose) {
      return
    }
    event.preventDefault()
    mainWindow?.webContents.send(IPC_CHANNELS.appBeforeClose)
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  const rebuildMenu = () => {
    buildApplicationMenu({
      getWindow: () => mainWindow,
      recentRoots: configStore.getState().recentRoots,
    })
  }

  removeIpcHandlers = registerIpcHandlers({
    configStore,
    getWindow: () => mainWindow,
    onLibraryChanged: rebuildMenu,
    onResolveClose: resolveClose,
  })
  rebuildMenu()

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
  } else {
    await mainWindow.loadFile(rendererFilePath)
  }
}

function resolveClose(resolution: CloseResolution) {
  if (resolution === 'continue-editing') {
    return
  }
  allowClose = true
  mainWindow?.close()
}

function isAllowedNavigation(targetUrl: string, rendererUrl: string) {
  try {
    const target = new URL(targetUrl)
    const renderer = new URL(rendererUrl)
    return (
      target.protocol === renderer.protocol &&
      target.host === renderer.host &&
      target.pathname === renderer.pathname &&
      target.search === renderer.search
    )
  } catch {
    return false
  }
}

async function initialize() {
  const configStore = new ConfigStore(app.getPath('userData'))
  await configStore.load()
  await createWindow(configStore)
}

const hasSingleInstanceLock =
  !isSquirrelStartup && app.requestSingleInstanceLock()

if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) {
      return
    }
    if (mainWindow.isMinimized()) {
      mainWindow.restore()
    }
    mainWindow.show()
    mainWindow.focus()
  })

  void app.whenReady().then(initialize).catch((error: unknown) => {
    console.error('应用启动失败', error)
    app.quit()
  })
}

app.on('will-quit', () => {
  removeIpcHandlers?.()
  removeIpcHandlers = null
})

app.on('window-all-closed', () => {
  app.quit()
})
