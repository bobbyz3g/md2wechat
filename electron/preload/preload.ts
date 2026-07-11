import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

import {
  IPC_CHANNELS,
  type DesktopResult,
  type Md2WechatDesktopApi,
} from '../shared/types'

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const result = (await ipcRenderer.invoke(
    channel,
    ...args,
  )) as DesktopResult<T>
  if (!result.ok) {
    throw new Error(result.error.message)
  }
  return result.value
}

const desktopApi: Md2WechatDesktopApi = {
  app: {
    getBootstrapState: () => invoke(IPC_CHANNELS.appGetBootstrapState),
    onBeforeClose(callback) {
      const listener = () => callback()
      ipcRenderer.on(IPC_CHANNELS.appBeforeClose, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.appBeforeClose, listener)
    },
    onOpenLibraryRequested(callback) {
      const listener = (_event: IpcRendererEvent, rootPath: string | null) =>
        callback(rootPath)
      ipcRenderer.on(IPC_CHANNELS.appOpenLibraryRequested, listener)
      return () =>
        ipcRenderer.removeListener(
          IPC_CHANNELS.appOpenLibraryRequested,
          listener,
        )
    },
    resolveClose: (resolution) =>
      invoke(IPC_CHANNELS.appResolveClose, resolution),
  },
  library: {
    choose: () => invoke(IPC_CHANNELS.libraryChoose),
    open: (rootPath) => invoke(IPC_CHANNELS.libraryOpen, rootPath),
    getTree: () => invoke(IPC_CHANNELS.libraryGetTree),
  },
  directories: {
    create: (parentPath, name) =>
      invoke(IPC_CHANNELS.directoriesCreate, parentPath, name),
    rename: (directoryPath, name) =>
      invoke(IPC_CHANNELS.directoriesRename, directoryPath, name),
    delete: (directoryPath) =>
      invoke(IPC_CHANNELS.directoriesDelete, directoryPath),
  },
  articles: {
    create: (directoryPath, name, initialContent) =>
      invoke(
        IPC_CHANNELS.articlesCreate,
        directoryPath,
        name,
        initialContent,
      ),
    read: (articlePath) => invoke(IPC_CHANNELS.articlesRead, articlePath),
    getStatus: (articlePath) =>
      invoke(IPC_CHANNELS.articlesGetStatus, articlePath),
    save: (articlePath, content) =>
      invoke(IPC_CHANNELS.articlesSave, articlePath, content),
    rename: (articlePath, name) =>
      invoke(IPC_CHANNELS.articlesRename, articlePath, name),
    delete: (articlePath) =>
      invoke(IPC_CHANNELS.articlesDelete, articlePath),
  },
}

contextBridge.exposeInMainWorld('md2wechat', desktopApi)
