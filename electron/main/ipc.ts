import { dialog, ipcMain } from 'electron'

import type { BrowserWindow, IpcMainInvokeEvent } from 'electron'

import { AppError, ArticleStore } from './articleStore'
import type { ConfigStore } from './configStore'
import {
  IPC_CHANNELS,
  type BootstrapState,
  type CloseResolution,
  type DesktopError,
  type DesktopResult,
  type LibraryOpenResult,
} from '../shared/types'

type RegisterIpcHandlersOptions = {
  configStore: ConfigStore
  getWindow: () => BrowserWindow | null
  onLibraryChanged: () => void
  onResolveClose: (resolution: CloseResolution) => void
}

export function registerIpcHandlers({
  configStore,
  getWindow,
  onLibraryChanged,
  onResolveClose,
}: RegisterIpcHandlersOptions) {
  let articleStore: ArticleStore | null = null
  const registeredChannels: string[] = []

  const registerHandler = <T>(
    channel: string,
    operation: (...args: unknown[]) => Promise<T> | T,
  ) => {
    ipcMain.handle(
      channel,
      async (
        event: IpcMainInvokeEvent,
        ...args: unknown[]
      ): Promise<DesktopResult<T>> =>
        toResult(async () => {
          if (event.sender !== getWindow()?.webContents) {
            throw new AppError('PERMISSION_DENIED', '不允许的桌面请求')
          }
          return operation(...args)
        }),
    )
    registeredChannels.push(channel)
  }

  const getArticleStore = () => {
    if (!articleStore) {
      throw new AppError('NOT_FOUND', '请先打开文章库')
    }
    return articleStore
  }

  const openLibrary = async (rootPath: string): Promise<LibraryOpenResult> => {
    const nextStore = await ArticleStore.open(rootPath)
    const tree = await nextStore.getTree()
    await configStore.setActiveRoot(nextStore.rootPath)
    articleStore = nextStore
    onLibraryChanged()
    return {
      rootPath: nextStore.rootPath,
      recentRoots: configStore.getState().recentRoots,
      tree,
    }
  }

  registerHandler<BootstrapState>(IPC_CHANNELS.appGetBootstrapState, async () => {
    const state = configStore.getState()
    if (!state.lastRoot) {
      return {
        rootPath: null,
        recentRoots: state.recentRoots,
        tree: null,
        error: null,
      }
    }

    try {
      const openedLibrary = await openLibrary(state.lastRoot)
      return {
        ...openedLibrary,
        error: null,
      }
    } catch (error) {
      await removeInvalidRecentRoot(
        configStore,
        state.lastRoot,
        onLibraryChanged,
      )
      return {
        rootPath: null,
        recentRoots: configStore.getState().recentRoots,
        tree: null,
        error: toDesktopError(error),
      }
    }
  })

  registerHandler<void>(IPC_CHANNELS.appResolveClose, (resolution) => {
    onResolveClose(requireCloseResolution(resolution))
  })

  registerHandler<LibraryOpenResult | null>(
    IPC_CHANNELS.libraryChoose,
    async () => {
      const window = getWindow()
      if (!window) {
        throw new AppError('IO_ERROR', '应用窗口不可用')
      }

      const result = await dialog.showOpenDialog(window, {
        properties: ['openDirectory'],
      })
      if (result.canceled || result.filePaths.length === 0) {
        return null
      }
      return openLibrary(result.filePaths[0])
    },
  )

  registerHandler<LibraryOpenResult>(
    IPC_CHANNELS.libraryOpen,
    async (rootPath) => {
      const safeRootPath = requireString(rootPath, '目录路径不合法')
      if (!configStore.getState().recentRoots.includes(safeRootPath)) {
        throw new AppError('INVALID_PATH', '目录路径不合法')
      }

      try {
        return await openLibrary(safeRootPath)
      } catch (error) {
        if (isInvalidRecentRootError(error)) {
          await removeInvalidRecentRoot(
            configStore,
            safeRootPath,
            onLibraryChanged,
          )
        }
        throw error
      }
    },
  )

  registerHandler(IPC_CHANNELS.libraryGetTree, () =>
    getArticleStore().getTree(),
  )

  registerHandler(IPC_CHANNELS.directoriesCreate, (parentPath, name) =>
    getArticleStore().createDirectory(
      requireString(parentPath, '目录路径不合法'),
      requireString(name, '目录名必须是字符串'),
    ),
  )
  registerHandler(IPC_CHANNELS.directoriesRename, (directoryPath, name) =>
    getArticleStore().renameDirectory(
      requireString(directoryPath, '目录路径不合法'),
      requireString(name, '目录名必须是字符串'),
    ),
  )
  registerHandler(IPC_CHANNELS.directoriesDelete, (directoryPath) =>
    getArticleStore().deleteDirectory(
      requireString(directoryPath, '目录路径不合法'),
    ),
  )

  registerHandler(
    IPC_CHANNELS.articlesCreate,
    (directoryPath, name, initialContent) =>
      getArticleStore().createArticle(
        requireString(directoryPath, '目录路径不合法'),
        requireString(name, '文章名必须是字符串'),
        requireString(initialContent, '文章内容必须是字符串'),
      ),
  )
  registerHandler(IPC_CHANNELS.articlesRead, (articlePath) =>
    getArticleStore().readArticle(
      requireString(articlePath, '文章路径不合法'),
    ),
  )
  registerHandler(IPC_CHANNELS.articlesGetStatus, (articlePath) =>
    getArticleStore().getArticleStatus(
      requireString(articlePath, '文章路径不合法'),
    ),
  )
  registerHandler(IPC_CHANNELS.articlesSave, (articlePath, content) =>
    getArticleStore().saveArticle(
      requireString(articlePath, '文章路径不合法'),
      requireString(content, '文章内容必须是字符串'),
    ),
  )
  registerHandler(IPC_CHANNELS.articlesRename, (articlePath, name) =>
    getArticleStore().renameArticle(
      requireString(articlePath, '文章路径不合法'),
      requireString(name, '文章名必须是字符串'),
    ),
  )
  registerHandler(IPC_CHANNELS.articlesDelete, (articlePath) =>
    getArticleStore().deleteArticle(
      requireString(articlePath, '文章路径不合法'),
    ),
  )

  return () => {
    for (const channel of registeredChannels) {
      ipcMain.removeHandler(channel)
    }
  }
}

async function toResult<T>(
  operation: () => Promise<T>,
): Promise<DesktopResult<T>> {
  try {
    return { ok: true, value: await operation() }
  } catch (error) {
    if (!(error instanceof AppError) || error.code === 'IO_ERROR') {
      console.error('桌面操作失败', error)
    }
    return { ok: false, error: toDesktopError(error) }
  }
}

function toDesktopError(error: unknown): DesktopError {
  if (error instanceof AppError) {
    return { code: error.code, message: error.message }
  }
  return { code: 'IO_ERROR', message: '文件操作失败' }
}

function requireString(value: unknown, message: string) {
  if (typeof value !== 'string') {
    throw new AppError('INVALID_PATH', message)
  }
  return value
}

function requireCloseResolution(value: unknown): CloseResolution {
  if (
    value === 'saved' ||
    value === 'continue-editing' ||
    value === 'discard'
  ) {
    return value
  }
  throw new AppError('INVALID_PATH', '关闭处理方式不合法')
}

function isInvalidRecentRootError(error: unknown) {
  return (
    error instanceof AppError &&
    (error.code === 'NOT_FOUND' || error.code === 'PERMISSION_DENIED')
  )
}

async function removeInvalidRecentRoot(
  configStore: ConfigStore,
  rootPath: string,
  onLibraryChanged: () => void,
) {
  try {
    await configStore.removeRecentRoot(rootPath)
  } catch (error) {
    console.error('移除失效的最近目录失败', error)
  }
  onLibraryChanged()
}
