export type ArticleNode = {
  type: 'article'
  name: string
  path: string
  updatedAt: string
}

export type DirectoryNode = {
  type: 'directory'
  name: string
  path: string
  depth: number
  children: TreeNode[]
}

export type TreeNode = ArticleNode | DirectoryNode

export type ArticleTree = {
  type: 'root'
  name: '文章库'
  path: ''
  children: TreeNode[]
}

export type DesktopErrorCode =
  | 'INVALID_PATH'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PERMISSION_DENIED'
  | 'IO_ERROR'

export type DesktopError = {
  code: DesktopErrorCode
  message: string
}

export type DesktopApiError = DesktopError & {
  name: 'DesktopApiError'
}

export type DesktopResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: DesktopError }

export type LibraryOpenResult = {
  rootPath: string
  generation: number
  recentRoots: string[]
  tree: ArticleTree
}

export type LibraryEntryType = 'directory' | 'article'

export type LibraryChange = {
  type: 'created' | 'updated' | 'deleted'
  entryType: LibraryEntryType
  path: string
}

export type LibraryChangeBatch = {
  rootPath: string
  generation: number
  changes: LibraryChange[]
  needsFullRefresh: boolean
}

export type BootstrapState = {
  rootPath: string | null
  generation: number | null
  recentRoots: string[]
  tree: ArticleTree | null
  error: DesktopError | null
}

export type CloseResolution = 'saved' | 'continue-editing' | 'discard'

export type ArticleContent = {
  path: string
  content: string
  updatedAt: string
  revision: string
}

export type ArticleStatus = {
  path: string
  updatedAt: string
  revision: string
}

export type ArticleSaveResult = ArticleStatus

export type ArticleSaveMode = 'normal' | 'overwrite' | 'create'

export type DirectoryRenameResult = {
  oldPath: string
  path: string
  name: string
}

export type ArticleRenameResult = DirectoryRenameResult & {
  updatedAt: string
}

export type DeleteResult = {
  path: string
}

export const IPC_CHANNELS = {
  appGetBootstrapState: 'app:get-bootstrap-state',
  appBeforeClose: 'app:before-close',
  appOpenLibraryRequested: 'app:open-library-requested',
  appResolveClose: 'app:resolve-close',
  libraryChoose: 'library:choose',
  libraryOpen: 'library:open',
  libraryGetTree: 'library:get-tree',
  libraryDidChange: 'library:did-change',
  directoriesCreate: 'directories:create',
  directoriesRename: 'directories:rename',
  directoriesDelete: 'directories:delete',
  articlesCreate: 'articles:create',
  articlesRead: 'articles:read',
  articlesGetStatus: 'articles:get-status',
  articlesSave: 'articles:save',
  articlesRename: 'articles:rename',
  articlesDelete: 'articles:delete',
} as const

export type Md2WechatDesktopApi = {
  app: {
    getBootstrapState(): Promise<BootstrapState>
    onBeforeClose(callback: () => void): () => void
    onOpenLibraryRequested(
      callback: (rootPath: string | null) => void,
    ): () => void
    resolveClose(resolution: CloseResolution): Promise<void>
  }
  library: {
    choose(): Promise<LibraryOpenResult | null>
    open(rootPath: string): Promise<LibraryOpenResult>
    getTree(): Promise<ArticleTree>
    onDidChange(callback: (batch: LibraryChangeBatch) => void): () => void
  }
  directories: {
    create(parentPath: string, name: string): Promise<DirectoryNode>
    rename(path: string, name: string): Promise<DirectoryRenameResult>
    delete(path: string): Promise<DeleteResult>
  }
  articles: {
    create(
      directoryPath: string,
      name: string,
      initialContent: string,
    ): Promise<ArticleNode>
    read(path: string): Promise<ArticleContent>
    getStatus(path: string): Promise<ArticleStatus>
    save(
      path: string,
      content: string,
      expectedRevision: string,
      mode?: ArticleSaveMode,
    ): Promise<ArticleSaveResult>
    rename(path: string, name: string): Promise<ArticleRenameResult>
    delete(path: string): Promise<DeleteResult>
  }
}
