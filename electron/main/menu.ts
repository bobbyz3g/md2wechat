import { Menu, type BrowserWindow, type MenuItemConstructorOptions } from 'electron'

import { IPC_CHANNELS } from '../shared/types'

type BuildApplicationMenuOptions = {
  getWindow: () => BrowserWindow | null
  recentRoots: string[]
}

export function buildApplicationMenu({
  getWindow,
  recentRoots,
}: BuildApplicationMenuOptions) {
  const sendOpenRequest = (rootPath: string | null) => {
    const window = getWindow()
    if (window && !window.isDestroyed()) {
      window.webContents.send(
        IPC_CHANNELS.appOpenLibraryRequested,
        rootPath,
      )
    }
  }

  const recentItems: MenuItemConstructorOptions[] = recentRoots.map(
    (rootPath) => ({
      label: rootPath,
      click: () => sendOpenRequest(rootPath),
    }),
  )

  const template: MenuItemConstructorOptions[] = [
    {
      label: '文件',
      submenu: [
        {
          label: '打开文件夹…',
          accelerator: 'CmdOrCtrl+O',
          click: () => sendOpenRequest(null),
        },
        {
          label: '打开最近使用的目录',
          enabled: recentItems.length > 0,
          submenu: recentItems,
        },
        { type: 'separator' },
        {
          label: '退出',
          click: () => getWindow()?.close(),
        },
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
