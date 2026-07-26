import {
  type CSSProperties,
  type FormEvent,
  type MouseEvent,
  type UIEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { copyWechatHtml } from '../clipboard/copyWechatHtml'
import { renderMarkdown } from '../core/renderMarkdown'
import { isThemeId, themeList, type ThemeId } from '../core/themes'
import { desktopApi } from '../desktop/api'
import { WelcomeScreen } from './WelcomeScreen'
import type {
  ArticleNode,
  ArticleTree,
  DirectoryNode,
  LibraryOpenResult,
  TreeNode,
} from '../../../electron/shared/types'

type CopyState = 'idle' | 'copied' | 'failed'
type SaveState = 'loading' | 'saved' | 'dirty' | 'saving' | 'failed'
type PreviewMode = 'desktop' | 'mobile'

type CreateTarget =
  | {
      type: 'directory'
      parentPath: string
    }
  | {
      type: 'article'
      directoryPath: string
    }

type ArticleStats = {
  characterCount: number
  readTimeMinutes: number
}

type NodeType = 'directory' | 'article'

type MenuTarget = {
  type: NodeType
  path: string
}

type RenameTarget = {
  type: NodeType
  path: string
  name: string
}

type DeleteTarget = RenameTarget

type DiskChangeNotice =
  | {
      type: 'reloaded'
    }
  | {
      type: 'conflict'
      updatedAt: string
    }

const themeIdStorageKey = 'md2wechat:themeId'
const libraryCollapsedStorageKey = 'md2wechat:libraryCollapsed'
const readingUnitsPerMinute = 300
const articleStatusCheckInterval = 2500
const diskReloadNoticeDuration = 3200

export function App() {
  const [rootPath, setRootPath] = useState<string | null>(null)
  const [recentRoots, setRecentRoots] = useState<string[]>([])
  const [bootstrapError, setBootstrapError] = useState<string | null>(null)
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const [isOpeningLibrary, setIsOpeningLibrary] = useState(false)
  const [isCloseDecisionOpen, setIsCloseDecisionOpen] = useState(false)
  const [isResolvingClose, setIsResolvingClose] = useState(false)
  const [tree, setTree] = useState<ArticleTree | null>(null)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [markdown, setMarkdown] = useState('')
  const [lastSavedMarkdown, setLastSavedMarkdown] = useState('')
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('loading')
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const [previewMode, setPreviewMode] = useState<PreviewMode>('desktop')
  const [themeId, setThemeId] = useState<ThemeId>(() => readThemeId())
  const [isLibraryCollapsed, setIsLibraryCollapsed] = useState(() =>
    readLibraryCollapsed(),
  )
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [creating, setCreating] = useState<CreateTarget | null>(null)
  const [createName, setCreateName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [switchingPath, setSwitchingPath] = useState<string | null>(null)
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false)
  const [openMenu, setOpenMenu] = useState<MenuTarget | null>(null)
  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null)
  const [renameName, setRenameName] = useState('')
  const [isRenaming, setIsRenaming] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(
    null,
  )
  const [isDeleting, setIsDeleting] = useState(false)
  const [diskChangeNotice, setDiskChangeNotice] =
    useState<DiskChangeNotice | null>(null)
  const [expandedDirectories, setExpandedDirectories] = useState<Set<string>>(
    () => new Set(),
  )

  const selectedPathRef = useRef<string | null>(null)
  const rootPathRef = useRef<string | null>(null)
  const markdownRef = useRef('')
  const lastSavedMarkdownRef = useRef('')
  const lastKnownUpdatedAtRef = useRef<string | null>(null)
  const saveStateRef = useRef<SaveState>('loading')
  const editorScrollRef = useRef<HTMLTextAreaElement | null>(null)
  const previewScrollRef = useRef<HTMLElement | null>(null)
  const syncScrollLockRef = useRef(false)
  const isOpeningLibraryRef = useRef(false)
  const isCloseSaveInProgressRef = useRef(false)
  const isCloseDecisionPendingRef = useRef(false)

  const rendered = useMemo(
    () => renderMarkdown(markdown, { themeId }),
    [markdown, themeId],
  )
  const currentArticle = useMemo(
    () => (tree && selectedPath ? findArticle(tree, selectedPath) : null),
    [selectedPath, tree],
  )
  const articleStats = useMemo(() => getArticleStats(markdown), [markdown])
  const displayedSavedAt = selectedPath
    ? (lastSavedAt ?? currentArticle?.updatedAt ?? null)
    : null
  const previewFrameClassName = `preview-frame is-${previewMode}`
  const appShellClassName = `app-shell${
    isLibraryCollapsed ? ' is-library-collapsed' : ''
  }`
  const libraryPaneClassName = `library-pane${
    isLibraryCollapsed ? ' is-collapsed' : ''
  }`

  const loadArticle = useCallback(
    async (articlePath: string, articleUpdatedAt?: string) => {
      setSaveState('loading')
      const article = await desktopApi.articles.read(articlePath)

      selectedPathRef.current = articlePath
      markdownRef.current = article.content
      lastSavedMarkdownRef.current = article.content
      lastKnownUpdatedAtRef.current = articleUpdatedAt ?? null

      const activeRootPath = rootPathRef.current
      if (activeRootPath) {
        writeLastArticlePath(activeRootPath, articlePath)
      }
      setSelectedPath(articlePath)
      setMarkdown(article.content)
      setLastSavedMarkdown(article.content)
      setLastSavedAt(articleUpdatedAt ?? null)
      setCopyState('idle')
      setErrorMessage(null)
      setDiskChangeNotice(null)
      setSaveState('saved')
    },
    [],
  )

  const refreshTree = useCallback(async () => {
    const nextTree = await desktopApi.library.getTree()

    setTree(nextTree)
    return nextTree
  }, [])

  const saveCurrentArticle = useCallback(async () => {
    const articlePath = selectedPathRef.current
    const currentMarkdown = markdownRef.current
    const savedMarkdown = lastSavedMarkdownRef.current

    if (!articlePath || currentMarkdown === savedMarkdown) {
      if (articlePath) {
        setSaveState('saved')
      }

      return true
    }

    setSaveState('saving')

    try {
      const result = await desktopApi.articles.save(
        articlePath,
        currentMarkdown,
      )

      setTree((currentTree) =>
        currentTree
          ? updateArticleUpdatedAt(
              currentTree,
              result.path,
              result.updatedAt,
            )
          : currentTree,
      )
      setLastSavedAt(result.updatedAt)
      lastKnownUpdatedAtRef.current = result.updatedAt
      lastSavedMarkdownRef.current = currentMarkdown
      setLastSavedMarkdown(currentMarkdown)
      setDiskChangeNotice(null)
      setSaveState(
        markdownRef.current === currentMarkdown ? 'saved' : 'dirty',
      )
      setErrorMessage(null)
      return true
    } catch (error) {
      setSaveState('failed')
      setErrorMessage(getErrorMessage(error))
      return false
    }
  }, [])

  const resetCurrentArticleState = useCallback(() => {
    selectedPathRef.current = null
    markdownRef.current = ''
    lastSavedMarkdownRef.current = ''
    lastKnownUpdatedAtRef.current = null

    setSelectedPath(null)
    setMarkdown('')
    setLastSavedMarkdown('')
    setLastSavedAt(null)
    setCopyState('idle')
    setDiskChangeNotice(null)
    setSaveState('saved')
  }, [])

  const clearCurrentArticle = useCallback(() => {
    const activeRootPath = rootPathRef.current
    if (activeRootPath) {
      clearLastArticlePath(activeRootPath)
    }
    resetCurrentArticleState()
  }, [resetCurrentArticleState])

  const activateLibrary = useCallback(
    async (openedLibrary: LibraryOpenResult) => {
      rootPathRef.current = openedLibrary.rootPath
      resetCurrentArticleState()
      setRootPath(openedLibrary.rootPath)
      setRecentRoots(openedLibrary.recentRoots)
      setBootstrapError(null)
      setTree(openedLibrary.tree)
      setExpandedDirectories(new Set())
      setCreating(null)
      setCreateName('')
      setOpenMenu(null)
      setIsCreateMenuOpen(false)
      setRenameTarget(null)
      setRenameName('')
      setDeleteTarget(null)
      setDeleteErrorMessage(null)
      setErrorMessage(null)

      const lastArticlePath = readLastArticlePath(openedLibrary.rootPath)
      const lastArticle = lastArticlePath
        ? findArticle(openedLibrary.tree, lastArticlePath)
        : null

      if (!lastArticle) {
        clearLastArticlePath(openedLibrary.rootPath)
        return
      }

      setExpandedDirectories(
        new Set(getParentDirectoryPaths(lastArticle.path)),
      )
      await loadArticle(lastArticle.path, lastArticle.updatedAt)
    },
    [loadArticle, resetCurrentArticleState],
  )

  const openLibrary = useCallback(
    async (
      request:
        | { type: 'choose' }
        | { type: 'recent'; rootPath: string },
    ) => {
      if (isOpeningLibraryRef.current) {
        return
      }

      isOpeningLibraryRef.current = true
      setIsOpeningLibrary(true)

      try {
        const saved = await saveCurrentArticle()
        if (!saved) {
          return
        }

        const openedLibrary =
          request.type === 'choose'
            ? await desktopApi.library.choose()
            : await desktopApi.library.open(request.rootPath)

        if (!openedLibrary) {
          return
        }

        await activateLibrary(openedLibrary)
      } catch (error) {
        const message = getErrorMessage(error)
        if (request.type === 'recent') {
          setRecentRoots((currentRoots) =>
            currentRoots.filter((rootPath) => rootPath !== request.rootPath),
          )
        }
        if (rootPathRef.current) {
          setErrorMessage(message)
        } else {
          setBootstrapError(message)
        }
      } finally {
        isOpeningLibraryRef.current = false
        setIsOpeningLibrary(false)
      }
    },
    [activateLibrary, saveCurrentArticle],
  )

  const refreshAfterMissingArticle = useCallback(
    async (articlePath: string) => {
      const nextTree = await refreshTree()
      if (
        selectedPathRef.current === articlePath &&
        !findArticle(nextTree, articlePath)
      ) {
        clearCurrentArticle()
      }
      setErrorMessage('文章不存在')
    },
    [clearCurrentArticle, refreshTree],
  )

  const resetPaneScrollPositions = useCallback(() => {
    syncScrollLockRef.current = false

    if (editorScrollRef.current) {
      editorScrollRef.current.scrollTop = 0
    }

    if (previewScrollRef.current) {
      previewScrollRef.current.scrollTop = 0
    }
  }, [])

  const syncScroll = useCallback((source: HTMLElement, target: HTMLElement) => {
    if (syncScrollLockRef.current) {
      return
    }

    syncScrollLockRef.current = true

    const sourceScrollRange = source.scrollHeight - source.clientHeight
    const targetScrollRange = target.scrollHeight - target.clientHeight
    const scrollRatio =
      sourceScrollRange > 0 ? source.scrollTop / sourceScrollRange : 0

    target.scrollTop = targetScrollRange > 0 ? scrollRatio * targetScrollRange : 0

    window.requestAnimationFrame(() => {
      syncScrollLockRef.current = false
    })
  }, [])

  useEffect(() => {
    let ignore = false

    async function boot() {
      try {
        const bootstrapState = await desktopApi.app.getBootstrapState()

        if (ignore) {
          return
        }

        rootPathRef.current = bootstrapState.rootPath
        setRootPath(bootstrapState.rootPath)
        setRecentRoots(bootstrapState.recentRoots)
        setBootstrapError(bootstrapState.error?.message ?? null)
        setTree(bootstrapState.tree)

        const lastArticlePath = bootstrapState.rootPath
          ? readLastArticlePath(bootstrapState.rootPath)
          : null
        const lastArticle = lastArticlePath && bootstrapState.tree
          ? findArticle(bootstrapState.tree, lastArticlePath)
          : null

        if (lastArticle) {
          setExpandedDirectories(
            new Set(getParentDirectoryPaths(lastArticle.path)),
          )
          await loadArticle(lastArticle.path, lastArticle.updatedAt)
        } else {
          if (bootstrapState.rootPath) {
            clearLastArticlePath(bootstrapState.rootPath)
          }
          setExpandedDirectories(new Set())
          setLastSavedAt(null)
          setSaveState('saved')
        }
      } catch (error) {
        if (!ignore) {
          setSaveState('failed')
          setBootstrapError(getErrorMessage(error))
        }
      } finally {
        if (!ignore) {
          setIsBootstrapping(false)
        }
      }
    }

    void boot()

    return () => {
      ignore = true
    }
  }, [loadArticle])

  useEffect(
    () =>
      desktopApi.app.onOpenLibraryRequested((requestedRootPath) => {
        void openLibrary(
          requestedRootPath
            ? { type: 'recent', rootPath: requestedRootPath }
            : { type: 'choose' },
        )
      }),
    [openLibrary],
  )

  useEffect(
    () =>
      desktopApi.app.onBeforeClose(() => {
        if (
          isCloseSaveInProgressRef.current ||
          isCloseDecisionPendingRef.current
        ) {
          return
        }

        isCloseSaveInProgressRef.current = true

        void saveCurrentArticle()
          .then(async (saved) => {
            if (saved) {
              await desktopApi.app.resolveClose('saved')
              return
            }

            isCloseDecisionPendingRef.current = true
            setIsCloseDecisionOpen(true)
          })
          .catch((error: unknown) => {
            setErrorMessage(getErrorMessage(error))
          })
          .finally(() => {
            isCloseSaveInProgressRef.current = false
          })
      }),
    [saveCurrentArticle],
  )

  useEffect(() => {
    if (
      !selectedPath ||
      markdown === lastSavedMarkdown ||
      diskChangeNotice?.type === 'conflict'
    ) {
      return
    }

    const timer = window.setTimeout(() => {
      void saveCurrentArticle()
    }, 900)

    return () => {
      window.clearTimeout(timer)
    }
  }, [
    diskChangeNotice,
    lastSavedMarkdown,
    markdown,
    saveCurrentArticle,
    selectedPath,
  ])

  useEffect(() => {
    saveStateRef.current = saveState
  }, [saveState])

  useEffect(() => {
    if (!selectedPath) {
      return
    }

    let ignore = false

    async function checkArticleStatus() {
      const articlePath = selectedPathRef.current

      if (!articlePath) {
        return
      }

      try {
        const status = await desktopApi.articles.getStatus(articlePath)

        if (ignore || selectedPathRef.current !== status.path) {
          return
        }

        const knownUpdatedAt = lastKnownUpdatedAtRef.current

        if (!knownUpdatedAt) {
          lastKnownUpdatedAtRef.current = status.updatedAt
          setLastSavedAt(status.updatedAt)
          return
        }

        if (status.updatedAt === knownUpdatedAt) {
          return
        }

        const hasLocalChanges =
          markdownRef.current !== lastSavedMarkdownRef.current ||
          saveStateRef.current === 'saving'

        if (hasLocalChanges) {
          setDiskChangeNotice({
            type: 'conflict',
            updatedAt: status.updatedAt,
          })
          return
        }

        await loadArticle(status.path, status.updatedAt)

        if (ignore) {
          return
        }

        await refreshTree()

        if (!ignore) {
          setDiskChangeNotice({ type: 'reloaded' })
        }
      } catch (error) {
        if (!ignore) {
          const message = getErrorMessage(error)
          if (message === '文章不存在') {
            await refreshAfterMissingArticle(articlePath)
          } else {
            setErrorMessage(message)
          }
        }
      }
    }

    const timer = window.setInterval(() => {
      void checkArticleStatus()
    }, articleStatusCheckInterval)

    return () => {
      ignore = true
      window.clearInterval(timer)
    }
  }, [
    loadArticle,
    refreshAfterMissingArticle,
    refreshTree,
    selectedPath,
  ])

  useEffect(() => {
    if (diskChangeNotice?.type !== 'reloaded') {
      return
    }

    const timer = window.setTimeout(() => {
      setDiskChangeNotice((currentNotice) =>
        currentNotice?.type === 'reloaded' ? null : currentNotice,
      )
    }, diskReloadNoticeDuration)

    return () => {
      window.clearTimeout(timer)
    }
  }, [diskChangeNotice])

  useEffect(() => {
    if (!openMenu && !isCreateMenuOpen) {
      return
    }

    function handleDocumentClick() {
      setOpenMenu(null)
      setIsCreateMenuOpen(false)
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpenMenu(null)
        setIsCreateMenuOpen(false)
      }
    }

    window.addEventListener('click', handleDocumentClick)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('click', handleDocumentClick)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isCreateMenuOpen, openMenu])

  useEffect(() => {
    if (!renameTarget) {
      return
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isRenaming) {
        setRenameTarget(null)
        setRenameName('')
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isRenaming, renameTarget])

  useEffect(() => {
    if (!deleteTarget) {
      return
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isDeleting) {
        setDeleteTarget(null)
        setDeleteErrorMessage(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [deleteTarget, isDeleting])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      resetPaneScrollPositions()
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [resetPaneScrollPositions, selectedPath])

  async function handleCopy() {
    const saved = await saveCurrentArticle()

    if (!saved) {
      return
    }

    try {
      await copyWechatHtml(rendered)
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
  }

  function handleMarkdownChange(value: string) {
    markdownRef.current = value
    setMarkdown(value)
    setCopyState('idle')

    if (value !== lastSavedMarkdownRef.current) {
      setSaveState('dirty')
    }
  }

  function handleEditorScroll(event: UIEvent<HTMLTextAreaElement>) {
    const preview = previewScrollRef.current

    if (!preview) {
      return
    }

    syncScroll(event.currentTarget, preview)
  }

  function handlePreviewScroll(event: UIEvent<HTMLElement>) {
    const editor = editorScrollRef.current

    if (!editor) {
      return
    }

    syncScroll(event.currentTarget, editor)
  }

  function handleThemeChange(nextThemeId: string) {
    if (!isThemeId(nextThemeId)) {
      return
    }

    writeThemeId(nextThemeId)
    setThemeId(nextThemeId)
    setCopyState('idle')
  }

  async function handleReloadChangedArticle(updatedAt: string) {
    const articlePath = selectedPathRef.current

    if (!articlePath) {
      return
    }

    try {
      await loadArticle(articlePath, updatedAt)
      await refreshTree()
      setDiskChangeNotice({ type: 'reloaded' })
    } catch (error) {
      const message = getErrorMessage(error)
      if (message === '文章不存在') {
        await refreshAfterMissingArticle(articlePath)
      } else {
        setErrorMessage(message)
      }
    }
  }

  function handleKeepCurrentArticle(updatedAt: string) {
    lastKnownUpdatedAtRef.current = updatedAt
    setDiskChangeNotice(null)
  }

  async function handleSelectArticle(articlePath: string) {
    if (articlePath === selectedPath || switchingPath) {
      return
    }

    setSwitchingPath(articlePath)

    const saved = await saveCurrentArticle()

    if (!saved) {
      setSwitchingPath(null)
      return
    }

    try {
      const article = tree ? findArticle(tree, articlePath) : null

      await loadArticle(articlePath, article?.updatedAt)
    } catch (error) {
      setSaveState('failed')
      const message = getErrorMessage(error)
      if (message === '文章不存在') {
        await refreshAfterMissingArticle(articlePath)
      } else {
        setErrorMessage(message)
      }
    } finally {
      setSwitchingPath(null)
    }
  }

  function expandDirectory(directoryPath: string) {
    if (!directoryPath) {
      return
    }

    setExpandedDirectories((currentDirectories) => {
      const nextDirectories = new Set(currentDirectories)

      nextDirectories.add(directoryPath)
      return nextDirectories
    })
  }

  function toggleDirectory(directoryPath: string) {
    setExpandedDirectories((currentDirectories) => {
      const nextDirectories = new Set(currentDirectories)

      if (nextDirectories.has(directoryPath)) {
        nextDirectories.delete(directoryPath)
      } else {
        nextDirectories.add(directoryPath)
      }

      return nextDirectories
    })
  }

  function toggleLibraryCollapsed() {
    setOpenMenu(null)
    setIsCreateMenuOpen(false)

    setIsLibraryCollapsed((currentCollapsed) => {
      const nextCollapsed = !currentCollapsed

      writeLibraryCollapsed(nextCollapsed)

      if (nextCollapsed) {
        setCreating(null)
        setCreateName('')
      }

      return nextCollapsed
    })
  }

  function startCreateDirectory(parentPath: string) {
    setOpenMenu(null)
    setIsCreateMenuOpen(false)
    expandDirectory(parentPath)
    setCreating({
      type: 'directory',
      parentPath,
    })
    setCreateName('')
    setErrorMessage(null)
  }

  function startCreateArticle(directoryPath: string) {
    setOpenMenu(null)
    setIsCreateMenuOpen(false)
    expandDirectory(directoryPath)
    setCreating({
      type: 'article',
      directoryPath,
    })
    setCreateName('')
    setErrorMessage(null)
  }

  function toggleMenu(
    event: MouseEvent<HTMLButtonElement>,
    nextMenu: MenuTarget,
  ) {
    event.stopPropagation()
    setIsCreateMenuOpen(false)
    setCreating(null)
    setErrorMessage(null)
    setOpenMenu((currentMenu) =>
      currentMenu?.type === nextMenu.type && currentMenu.path === nextMenu.path
        ? null
        : nextMenu,
    )
  }

  function startRename(target: RenameTarget) {
    setOpenMenu(null)
    setIsCreateMenuOpen(false)
    setCreating(null)
    setDeleteTarget(null)
    setRenameTarget(target)
    setRenameName(target.name)
    setErrorMessage(null)
  }

  function startDelete(target: DeleteTarget) {
    setOpenMenu(null)
    setIsCreateMenuOpen(false)
    setCreating(null)
    setRenameTarget(null)
    setRenameName('')
    setDeleteTarget(target)
    setDeleteErrorMessage(null)
    setErrorMessage(null)
  }

  async function handleRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!renameTarget || isRenaming) {
      return
    }

    const name = renameName.trim()

    if (!name) {
      setErrorMessage('名称不能为空')
      return
    }

    setIsRenaming(true)

    try {
      const saved = await saveCurrentArticle()

      if (!saved) {
        return
      }

      if (renameTarget.type === 'directory') {
        const result = await desktopApi.directories.rename(
          renameTarget.path,
          name,
        )

        syncSelectedPathAfterRename('directory', result.oldPath, result.path)
        syncExpandedDirectoriesAfterDirectoryRename(result.oldPath, result.path)
      } else {
        const result = await desktopApi.articles.rename(renameTarget.path, name)

        syncSelectedPathAfterRename('article', result.oldPath, result.path)
        if (selectedPathRef.current === result.path) {
          lastKnownUpdatedAtRef.current = result.updatedAt
          setLastSavedAt(result.updatedAt)
        }
      }
      await refreshTree()
      setRenameTarget(null)
      setRenameName('')
      setErrorMessage(null)
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsRenaming(false)
    }
  }

  function syncSelectedPathAfterRename(
    targetType: NodeType,
    oldPath: string,
    nextPath: string,
  ) {
    const currentPath = selectedPathRef.current

    if (!currentPath) {
      return
    }

    if (targetType === 'article' && currentPath === oldPath) {
      selectedPathRef.current = nextPath
      const activeRootPath = rootPathRef.current
      if (activeRootPath) {
        writeLastArticlePath(activeRootPath, nextPath)
      }
      setSelectedPath(nextPath)
      return
    }

    if (
      targetType === 'directory' &&
      (currentPath === oldPath || currentPath.startsWith(`${oldPath}/`))
    ) {
      const renamedPath = `${nextPath}${currentPath.slice(oldPath.length)}`

      selectedPathRef.current = renamedPath
      const activeRootPath = rootPathRef.current
      if (activeRootPath) {
        writeLastArticlePath(activeRootPath, renamedPath)
      }
      setSelectedPath(renamedPath)
    }
  }

  function syncExpandedDirectoriesAfterDirectoryRename(
    oldPath: string,
    nextPath: string,
  ) {
    setExpandedDirectories((currentDirectories) => {
      const nextDirectories = new Set<string>()

      for (const directoryPath of currentDirectories) {
        if (directoryPath === oldPath) {
          nextDirectories.add(nextPath)
        } else if (directoryPath.startsWith(`${oldPath}/`)) {
          nextDirectories.add(
            `${nextPath}${directoryPath.slice(oldPath.length)}`,
          )
        } else {
          nextDirectories.add(directoryPath)
        }
      }

      return nextDirectories
    })
  }

  function syncExpandedDirectoriesAfterDelete(directoryPath: string) {
    setExpandedDirectories((currentDirectories) => {
      const nextDirectories = new Set<string>()

      for (const expandedPath of currentDirectories) {
        if (
          expandedPath !== directoryPath &&
          !expandedPath.startsWith(`${directoryPath}/`)
        ) {
          nextDirectories.add(expandedPath)
        }
      }

      return nextDirectories
    })
  }

  async function handleDelete() {
    if (!deleteTarget || isDeleting) {
      return
    }

    setIsDeleting(true)
    setDeleteErrorMessage(null)

    try {
      const saved = await saveCurrentArticle()

      if (!saved) {
        return
      }

      const result =
        deleteTarget.type === 'directory'
          ? await desktopApi.directories.delete(deleteTarget.path)
          : await desktopApi.articles.delete(deleteTarget.path)

      const currentPath = selectedPathRef.current

      if (
        currentPath &&
        (currentPath === result.path || currentPath.startsWith(`${result.path}/`))
      ) {
        clearCurrentArticle()
      }

      if (deleteTarget.type === 'directory') {
        syncExpandedDirectoriesAfterDelete(result.path)
      }

      await refreshTree()
      setDeleteTarget(null)
      setDeleteErrorMessage(null)
      setErrorMessage(null)
    } catch (error) {
      setDeleteErrorMessage(getErrorMessage(error))
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!creating || isCreating) {
      return
    }

    const name = createName.trim()

    if (!name) {
      setErrorMessage('名称不能为空')
      return
    }

    setIsCreating(true)

    try {
      if (creating.type === 'directory') {
        expandDirectory(creating.parentPath)
        await desktopApi.directories.create(creating.parentPath, name)
        await refreshTree()
      } else {
        const saved = await saveCurrentArticle()

        if (!saved) {
          return
        }

        expandDirectory(creating.directoryPath)
        const article = await desktopApi.articles.create(
          creating.directoryPath,
          name,
          `# ${name}\n\n`,
        )

        await refreshTree()
        await loadArticle(article.path, article.updatedAt)
      }

      setCreating(null)
      setCreateName('')
      setErrorMessage(null)
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsCreating(false)
    }
  }

  function renderCreateForm(targetMatched: boolean) {
    if (!creating || !targetMatched) {
      return null
    }

    return (
      <form className="create-form" onSubmit={handleCreate}>
        <input
          aria-label={creating.type === 'directory' ? '目录名' : '文章名'}
          autoFocus
          placeholder={creating.type === 'directory' ? '目录名' : '文章名'}
          value={createName}
          onChange={(event) => setCreateName(event.target.value)}
        />
        <button className="small-button primary" type="submit">
          {isCreating ? '创建中' : '创建'}
        </button>
        <button
          className="small-button"
          type="button"
          onClick={() => setCreating(null)}
        >
          取消
        </button>
      </form>
    )
  }

  function toggleCreateMenu(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation()
    setOpenMenu(null)
    setCreating(null)
    setErrorMessage(null)
    setIsCreateMenuOpen((currentOpen) => !currentOpen)
  }

  function renderHeaderCreateMenu() {
    if (!isCreateMenuOpen) {
      return null
    }

    return (
      <div
        className="action-menu create-menu"
        role="menu"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          className="menu-item"
          role="menuitem"
          type="button"
          onClick={() => startCreateArticle('')}
        >
          文章
        </button>
        <button
          className="menu-item"
          role="menuitem"
          type="button"
          onClick={() => startCreateDirectory('')}
        >
          目录
        </button>
      </div>
    )
  }

  function renderActionMenu(target: RenameTarget) {
    if (openMenu?.type !== target.type || openMenu.path !== target.path) {
      return null
    }

    return (
      <div
        className="action-menu"
        role="menu"
        onClick={(event) => event.stopPropagation()}
      >
        {target.type === 'directory' ? (
          <>
            <button
              className="menu-item"
              role="menuitem"
              type="button"
              onClick={() => startCreateArticle(target.path)}
            >
              新文章
            </button>
            <button
              className="menu-item"
              role="menuitem"
              type="button"
              onClick={() => startCreateDirectory(target.path)}
            >
              新目录
            </button>
          </>
        ) : null}
        <button
          className="menu-item"
          role="menuitem"
          type="button"
          onClick={() => startRename(target)}
        >
          重命名
        </button>
        <button
          className="menu-item danger"
          role="menuitem"
          type="button"
          onClick={() => startDelete(target)}
        >
          删除
        </button>
      </div>
    )
  }

  function renderTreeNode(node: TreeNode) {
    if (node.type === 'article') {
      const isActive = node.path === selectedPath
      const isSwitching = switchingPath === node.path
      const isMenuOpen =
        openMenu?.type === 'article' && openMenu.path === node.path

      return (
        <li className="tree-item" key={node.path}>
          <div
            className={`article-row${isActive ? ' is-active' : ''}`}
          >
            <button
              className="node-main article-main"
              type="button"
              disabled={saveState === 'loading' || Boolean(switchingPath)}
              onClick={() => void handleSelectArticle(node.path)}
            >
              <span className="article-dot" aria-hidden="true" />
              <span className="tree-name">{node.name}</span>
              {isSwitching ? <span className="row-note">切换中</span> : null}
            </button>
            <div className="row-actions menu-shell">
              <button
                aria-expanded={isMenuOpen}
                aria-haspopup="menu"
                aria-label={`打开文章 ${node.name} 的更多操作`}
                className="more-button"
                type="button"
                onClick={(event) =>
                  toggleMenu(event, {
                    type: 'article',
                    path: node.path,
                  })
                }
              >
                ⋯
              </button>
              {renderActionMenu({
                type: 'article',
                path: node.path,
                name: node.name,
              })}
            </div>
          </div>
        </li>
      )
    }

    const isExpanded = expandedDirectories.has(node.path)
    const isMenuOpen =
      openMenu?.type === 'directory' && openMenu.path === node.path

    return (
      <li
        className="tree-item"
        key={node.path}
        style={{ '--tree-depth': node.depth } as CSSProperties}
      >
        <div className="directory-row">
          <button
            aria-expanded={isExpanded}
            className="node-main directory-main"
            type="button"
            onClick={() => toggleDirectory(node.path)}
          >
            <span className="expand-indicator" aria-hidden="true">
              {isExpanded ? '▾' : '▸'}
            </span>
            <span className="directory-marker" aria-hidden="true" />
            <span className="tree-name">{node.name}</span>
          </button>
          <div className="row-actions menu-shell">
            <button
              aria-expanded={isMenuOpen}
              aria-haspopup="menu"
              aria-label={`打开目录 ${node.name} 的更多操作`}
              className="more-button"
              type="button"
              onClick={(event) =>
                toggleMenu(event, {
                  type: 'directory',
                  path: node.path,
                })
              }
            >
              ⋯
            </button>
            {renderActionMenu({
              type: 'directory',
              path: node.path,
              name: node.name,
            })}
          </div>
        </div>
        {isExpanded ? (
          <>
            {renderCreateForm(
              (creating?.type === 'directory' &&
                creating.parentPath === node.path) ||
                (creating?.type === 'article' &&
                  creating.directoryPath === node.path),
            )}
            {node.children.length > 0 ? (
              <ul className="tree-list child-list">
                {node.children.map(renderTreeNode)}
              </ul>
            ) : (
              <div className="empty-folder">还没有文章</div>
            )}
          </>
        ) : null}
      </li>
    )
  }

  async function handleContinueEditing() {
    if (isResolvingClose) {
      return
    }

    setIsResolvingClose(true)
    try {
      await desktopApi.app.resolveClose('continue-editing')
      isCloseDecisionPendingRef.current = false
      setIsCloseDecisionOpen(false)
      setErrorMessage(null)
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsResolvingClose(false)
    }
  }

  async function handleDiscardAndClose() {
    if (isResolvingClose) {
      return
    }

    setIsResolvingClose(true)
    try {
      await desktopApi.app.resolveClose('discard')
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
      setIsResolvingClose(false)
    }
  }

  if (isBootstrapping) {
    return (
      <main className="boot-screen">
        <span className="brand-mark boot-mark" aria-hidden="true">
          文
        </span>
        <div role="status">正在打开写作空间</div>
      </main>
    )
  }

  if (!rootPath) {
    return (
      <WelcomeScreen
        recentRoots={recentRoots}
        errorMessage={bootstrapError}
        isOpening={isOpeningLibrary}
        onChooseDirectory={() => void openLibrary({ type: 'choose' })}
        onOpenRecent={(recentRootPath) =>
          void openLibrary({ type: 'recent', rootPath: recentRootPath })
        }
      />
    )
  }

  return (
    <main className={appShellClassName}>
      <a className="skip-link" href="#editor-workspace">
        跳到编辑区
      </a>

      <aside className={libraryPaneClassName} aria-label="文章管理">
        <div className="sidebar-top">
          <div className="brand" title="md2wechat">
            <span className="brand-mark" aria-hidden="true">
              文
            </span>
            {isLibraryCollapsed ? null : (
              <div className="brand-copy">
                <h1>md2wechat</h1>
                <p>公众号写作空间</p>
              </div>
            )}
          </div>
          <button
            className="library-collapse-button"
            type="button"
            title={isLibraryCollapsed ? '展开文章库' : '收起文章库'}
            aria-label={isLibraryCollapsed ? '展开文章库' : '收起文章库'}
            aria-expanded={!isLibraryCollapsed}
            onClick={toggleLibraryCollapsed}
          >
            <svg
              className="library-collapse-icon"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M9 4v16" />
              <path
                d={
                  isLibraryCollapsed ? 'M14 9l3 3-3 3' : 'M16 9l-3 3 3 3'
                }
              />
            </svg>
          </button>
        </div>

        {isLibraryCollapsed ? (
          <div className="library-collapsed-rail" aria-hidden="true">
            <span className="library-collapsed-label">文章库</span>
          </div>
        ) : (
          <>
            <div className="library-title">
              <span>我的文章</span>
              <div className="library-title-actions">
                <div className="create-menu-shell">
                  <button
                    aria-expanded={isCreateMenuOpen}
                    aria-haspopup="menu"
                    className="sidebar-create-button"
                    type="button"
                    onClick={toggleCreateMenu}
                  >
                    <span aria-hidden="true">＋</span>
                    新建
                  </button>
                  {renderHeaderCreateMenu()}
                </div>
              </div>
            </div>
            <div className="library-scroll">
              {renderCreateForm(
                (creating?.type === 'directory' &&
                  creating.parentPath === '') ||
                  (creating?.type === 'article' &&
                    creating.directoryPath === ''),
              )}
              {tree ? (
                tree.children.length > 0 ? (
                  <ul className="tree-list root-list">
                    {tree.children.map(renderTreeNode)}
                  </ul>
                ) : (
                  <div className="library-empty">
                    新建文章或目录
                  </div>
                )
              ) : (
                <div className="library-empty">正在读取文章库</div>
              )}
            </div>
            <div className="sidebar-footer" title={rootPath}>
              <span className="sidebar-footer-dot" aria-hidden="true" />
              <span>{rootPath}</span>
            </div>
          </>
        )}
      </aside>

      <section className="app-main">
        <header className="topbar">
          <div className="topbar-document" aria-live="polite">
            <span className="current-article-name">
              {currentArticle?.name ?? '开始一篇文章'}
            </span>
            <span className="current-article-path">
              {selectedPath ?? '从文章库选择或新建文章'}
            </span>
          </div>
          <div className="topbar-actions">
            <span className={`topbar-save-state ${saveState}`}>
              {getSaveStateText(saveState)}
            </span>
            <button
              className="copy-button"
              type="button"
              disabled={!selectedPath || saveState === 'loading'}
              onClick={handleCopy}
            >
              {copyState === 'copied'
                ? '已复制'
                : copyState === 'failed'
                  ? '复制失败'
                  : '复制到公众号'}
            </button>
          </div>
        </header>

        <section
          className="workspace"
          id="editor-workspace"
          aria-label="Markdown 编辑和预览"
        >
          <section
            className="pane editor-pane"
            aria-labelledby="editor-title"
          >
            <span className="pane-title editor-title" id="editor-title">
              <span>Markdown</span>
              <span>{currentArticle?.name ?? '未选择文章'}</span>
            </span>
            {diskChangeNotice?.type === 'reloaded' ? (
              <div className="disk-reload-notice" role="status">
                检测到磁盘变更，已重新载入文章
              </div>
            ) : null}
            {diskChangeNotice?.type === 'conflict' ? (
              <div className="disk-change-banner" role="alert">
                <span>磁盘文件已变化</span>
                <div className="disk-change-actions">
                  <button
                    className="small-button primary"
                    type="button"
                    onClick={() =>
                      void handleReloadChangedArticle(diskChangeNotice.updatedAt)
                    }
                  >
                    重新载入
                  </button>
                  <button
                    className="small-button"
                    type="button"
                    onClick={() =>
                      handleKeepCurrentArticle(diskChangeNotice.updatedAt)
                    }
                  >
                    保留当前
                  </button>
                </div>
              </div>
            ) : null}
            <textarea
              ref={editorScrollRef}
              aria-labelledby="editor-title"
              value={markdown}
              disabled={!selectedPath || saveState === 'loading'}
              onChange={(event) => {
                handleMarkdownChange(event.target.value)
              }}
              onScroll={handleEditorScroll}
              placeholder="选择左侧文章后开始编辑"
              spellCheck={false}
            />
          </section>

          <section className="pane preview-pane" aria-labelledby="preview-title">
            <div className="pane-title preview-toolbar">
              <span id="preview-title">微信公众号预览</span>
              <div className="preview-toolbar-actions">
                <label className="theme-select-label">
                  <span>主题</span>
                  <select
                    className="theme-select"
                    value={themeId}
                    onChange={(event) => {
                      handleThemeChange(event.target.value)
                    }}
                  >
                    {themeList.map((theme) => (
                      <option key={theme.id} value={theme.id}>
                        {theme.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="device-toggle" role="group" aria-label="预览设备">
                  <button
                    className={`device-toggle-button${
                      previewMode === 'desktop' ? ' is-active' : ''
                    }`}
                    type="button"
                    title="桌面预览"
                    aria-label="桌面预览"
                    aria-pressed={previewMode === 'desktop'}
                    onClick={() => {
                      setPreviewMode('desktop')
                    }}
                  >
                    <svg
                      className="device-toggle-icon"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <rect x="3" y="4" width="18" height="13" rx="2" />
                      <path d="M8 21h8" />
                      <path d="M12 17v4" />
                    </svg>
                  </button>
                  <button
                    className={`device-toggle-button${
                      previewMode === 'mobile' ? ' is-active' : ''
                    }`}
                    type="button"
                    title="手机预览"
                    aria-label="手机预览"
                    aria-pressed={previewMode === 'mobile'}
                    onClick={() => {
                      setPreviewMode('mobile')
                    }}
                  >
                    <svg
                      className="device-toggle-icon"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <rect x="7" y="2" width="10" height="20" rx="2" />
                      <path d="M11 18h2" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
            <article
              ref={previewScrollRef}
              className="wechat-preview"
              onScroll={handlePreviewScroll}
            >
              <div
                className={previewFrameClassName}
                dangerouslySetInnerHTML={{ __html: rendered.html }}
              />
            </article>
          </section>
        </section>

        <footer className="status-bar" aria-label="文章状态">
          <span className="status-item">
            <span className="status-value">{articleStats.characterCount}</span>
            字
          </span>
          <span className="status-divider" aria-hidden="true" />
          <span className="status-item">
            约 {formatReadTime(articleStats.readTimeMinutes)}
          </span>
          <span className="status-spacer" />
          <span className="status-item">
            最后保存 {formatSavedAt(displayedSavedAt)}
          </span>
        </footer>
      </section>

      {errorMessage ? (
        <div className="app-message" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {renameTarget ? (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isRenaming) {
              setRenameTarget(null)
              setRenameName('')
            }
          }}
        >
          <section
            aria-labelledby="rename-title"
            aria-modal="true"
            className="rename-dialog"
            role="dialog"
          >
            <form onSubmit={handleRename}>
              <div className="dialog-title" id="rename-title">
                {renameTarget.type === 'directory' ? '重命名目录' : '重命名文章'}
              </div>
              <input
                aria-label={
                  renameTarget.type === 'directory' ? '目录名' : '文章名'
                }
                autoFocus
                value={renameName}
                onChange={(event) => setRenameName(event.target.value)}
              />
              <div className="dialog-actions">
                <button
                  className="small-button"
                  type="button"
                  disabled={isRenaming}
                  onClick={() => {
                    setRenameTarget(null)
                    setRenameName('')
                  }}
                >
                  取消
                </button>
                <button
                  className="small-button primary"
                  type="submit"
                  disabled={isRenaming}
                >
                  {isRenaming ? '保存中' : '保存'}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {deleteTarget ? (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isDeleting) {
              setDeleteTarget(null)
              setDeleteErrorMessage(null)
            }
          }}
        >
          <section
            aria-labelledby="delete-title"
            aria-modal="true"
            className="confirm-dialog"
            role="dialog"
          >
            <div className="dialog-title" id="delete-title">
              {deleteTarget.type === 'directory' ? '删除目录' : '删除文章'}
            </div>
            <p className="dialog-copy">
              确定删除「{deleteTarget.name}」吗？该操作无法撤销。
            </p>
            {deleteErrorMessage ? (
              <div className="dialog-alert" role="alert">
                {deleteErrorMessage}
              </div>
            ) : null}
            <div className="dialog-actions">
              <button
                className="small-button"
                type="button"
                autoFocus
                disabled={isDeleting}
                onClick={() => {
                  setDeleteTarget(null)
                  setDeleteErrorMessage(null)
                }}
              >
                取消
              </button>
              <button
                className="small-button danger"
                type="button"
                disabled={isDeleting}
                onClick={() => void handleDelete()}
              >
                {isDeleting ? '删除中' : '删除'}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {isCloseDecisionOpen ? (
        <div className="modal-backdrop">
          <section
            aria-labelledby="close-failure-title"
            aria-modal="true"
            className="confirm-dialog"
            role="dialog"
          >
            <div className="dialog-title" id="close-failure-title">
              保存失败
            </div>
            <p className="dialog-copy">文章未能保存，请选择如何处理。</p>
            <div className="dialog-actions">
              <button
                className="small-button"
                type="button"
                autoFocus
                disabled={isResolvingClose}
                onClick={() => void handleContinueEditing()}
              >
                继续编辑
              </button>
              <button
                className="small-button danger"
                type="button"
                disabled={isResolvingClose}
                onClick={() => void handleDiscardAndClose()}
              >
                放弃修改并退出
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  )
}

function getSaveStateText(saveState: SaveState) {
  switch (saveState) {
    case 'loading':
      return '读取中'
    case 'saving':
      return '保存中'
    case 'dirty':
      return '待保存'
    case 'failed':
      return '保存失败'
    case 'saved':
      return '已保存'
  }
}

function getArticleStats(markdown: string): ArticleStats {
  const characterCount = markdown.replace(/\s/g, '').length
  const readTimeMinutes =
    characterCount === 0
      ? 0
      : Math.max(1, Math.ceil(characterCount / readingUnitsPerMinute))

  return {
    characterCount,
    readTimeMinutes,
  }
}

function formatReadTime(readTimeMinutes: number) {
  return `${readTimeMinutes} 分钟`
}

function formatSavedAt(savedAt: string | null) {
  if (!savedAt) {
    return '--'
  }

  const date = new Date(savedAt)

  if (Number.isNaN(date.getTime())) {
    return '--'
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return '操作失败'
}

function findArticle(
  tree: ArticleTree | DirectoryNode,
  articlePath: string,
): ArticleNode | null {
  for (const child of tree.children) {
    if (child.type === 'article' && child.path === articlePath) {
      return child
    }

    if (child.type === 'directory') {
      const article = findArticle(child, articlePath)

      if (article) {
        return article
      }
    }
  }

  return null
}

function updateArticleUpdatedAt(
  tree: ArticleTree,
  articlePath: string,
  updatedAt: string,
): ArticleTree {
  const [children, changed] = updateArticleChildrenUpdatedAt(
    tree.children,
    articlePath,
    updatedAt,
  )

  return changed ? { ...tree, children } : tree
}

function updateArticleChildrenUpdatedAt(
  children: TreeNode[],
  articlePath: string,
  updatedAt: string,
): [TreeNode[], boolean] {
  let changed = false
  const nextChildren = children.map((child) => {
    if (child.type === 'article') {
      if (child.path !== articlePath) {
        return child
      }

      changed = true
      return {
        ...child,
        updatedAt,
      }
    }

    const [nextNestedChildren, nestedChanged] = updateArticleChildrenUpdatedAt(
      child.children,
      articlePath,
      updatedAt,
    )

    if (!nestedChanged) {
      return child
    }

    changed = true
    return {
      ...child,
      children: nextNestedChildren,
    }
  })

  return [nextChildren, changed]
}

function getLastArticleStorageKey(rootPath: string) {
  return `md2wechat:lastArticlePath:${encodeURIComponent(rootPath)}`
}

function readLastArticlePath(rootPath: string) {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage.getItem(getLastArticleStorageKey(rootPath))
  } catch {
    return null
  }
}

function writeLastArticlePath(rootPath: string, articlePath: string) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(
      getLastArticleStorageKey(rootPath),
      articlePath,
    )
  } catch {
    return
  }
}

function clearLastArticlePath(rootPath: string) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.removeItem(getLastArticleStorageKey(rootPath))
  } catch {
    return
  }
}

function readLibraryCollapsed() {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    return window.localStorage.getItem(libraryCollapsedStorageKey) === 'true'
  } catch {
    return false
  }
}

function writeLibraryCollapsed(isCollapsed: boolean) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(
      libraryCollapsedStorageKey,
      String(isCollapsed),
    )
  } catch {
    return
  }
}

function readThemeId(): ThemeId {
  if (typeof window === 'undefined') {
    return 'default'
  }

  try {
    const value = window.localStorage.getItem(themeIdStorageKey)

    return isThemeId(value) ? value : 'default'
  } catch {
    return 'default'
  }
}

function writeThemeId(themeId: ThemeId) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(themeIdStorageKey, themeId)
  } catch {
    return
  }
}

function getParentDirectoryPaths(articlePath: string) {
  const segments = articlePath.split('/').slice(0, -1)

  return segments.map((_, index) => segments.slice(0, index + 1).join('/'))
}
