import {
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

type CopyState = 'idle' | 'copied' | 'failed'
type SaveState = 'loading' | 'saved' | 'dirty' | 'saving' | 'failed'
type PreviewMode = 'desktop' | 'mobile'

type ArticleNode = {
  type: 'article'
  name: string
  path: string
  updatedAt: string
}

type DirectoryNode = {
  type: 'directory'
  name: string
  path: string
  depth: number
  children: TreeNode[]
}

type TreeNode = ArticleNode | DirectoryNode

type ArticleTree = {
  type: 'root'
  name: string
  path: ''
  children: TreeNode[]
}

type CreateTarget =
  | {
      type: 'directory'
      parentPath: string
    }
  | {
      type: 'article'
      directoryPath: string
    }

type ArticleContentResponse = {
  path: string
  content: string
}

type ArticleSaveResponse = {
  path: string
  updatedAt: string
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

type DirectoryRenameResponse = {
  oldPath: string
  path: string
  name: string
}

type ArticleRenameResponse = DirectoryRenameResponse & {
  updatedAt: string
}

type DeleteResponse = {
  path: string
}

const maxDirectoryDepth = 2
const lastArticlePathStorageKey = 'md2wechat:lastArticlePath'
const readingUnitsPerMinute = 300

export function App() {
  const [tree, setTree] = useState<ArticleTree | null>(null)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [markdown, setMarkdown] = useState('')
  const [lastSavedMarkdown, setLastSavedMarkdown] = useState('')
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('loading')
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const [previewMode, setPreviewMode] = useState<PreviewMode>('desktop')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [creating, setCreating] = useState<CreateTarget | null>(null)
  const [createName, setCreateName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [switchingPath, setSwitchingPath] = useState<string | null>(null)
  const [openMenu, setOpenMenu] = useState<MenuTarget | null>(null)
  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null)
  const [renameName, setRenameName] = useState('')
  const [isRenaming, setIsRenaming] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(
    null,
  )
  const [isDeleting, setIsDeleting] = useState(false)
  const [expandedDirectories, setExpandedDirectories] = useState<Set<string>>(
    () => new Set(),
  )

  const selectedPathRef = useRef<string | null>(null)
  const markdownRef = useRef('')
  const lastSavedMarkdownRef = useRef('')
  const editorScrollRef = useRef<HTMLTextAreaElement | null>(null)
  const previewScrollRef = useRef<HTMLElement | null>(null)
  const syncScrollLockRef = useRef(false)

  const rendered = useMemo(() => renderMarkdown(markdown), [markdown])
  const currentArticle = useMemo(
    () => (tree && selectedPath ? findArticle(tree, selectedPath) : null),
    [selectedPath, tree],
  )
  const articleStats = useMemo(() => getArticleStats(markdown), [markdown])
  const displayedSavedAt = selectedPath
    ? (lastSavedAt ?? currentArticle?.updatedAt ?? null)
    : null
  const previewFrameClassName = `preview-frame is-${previewMode}`

  const loadArticle = useCallback(
    async (articlePath: string, articleUpdatedAt?: string) => {
      setSaveState('loading')
      const article = await requestJson<ArticleContentResponse>(
        `/api/articles/content?path=${encodeURIComponent(articlePath)}`,
      )

      selectedPathRef.current = articlePath
      markdownRef.current = article.content
      lastSavedMarkdownRef.current = article.content

      writeLastArticlePath(articlePath)
      setSelectedPath(articlePath)
      setMarkdown(article.content)
      setLastSavedMarkdown(article.content)
      setLastSavedAt(articleUpdatedAt ?? null)
      setCopyState('idle')
      setErrorMessage(null)
      setSaveState('saved')
    },
    [],
  )

  const refreshTree = useCallback(async () => {
    const nextTree = await requestJson<ArticleTree>('/api/articles/tree')

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
      const result = await requestJson<ArticleSaveResponse>(
        '/api/articles/content',
        {
          method: 'PUT',
          body: JSON.stringify({
            path: articlePath,
            content: currentMarkdown,
          }),
        },
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
      lastSavedMarkdownRef.current = currentMarkdown
      setLastSavedMarkdown(currentMarkdown)
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
        const nextTree = await requestJson<ArticleTree>('/api/articles/tree')

        if (ignore) {
          return
        }

        setTree(nextTree)

        const lastArticlePath = readLastArticlePath()
        const lastArticle = lastArticlePath
          ? findArticle(nextTree, lastArticlePath)
          : null
        const initialArticle = lastArticle ?? findFirstArticle(nextTree)

        if (initialArticle) {
          setExpandedDirectories(
            new Set(getParentDirectoryPaths(initialArticle.path)),
          )
          await loadArticle(initialArticle.path, initialArticle.updatedAt)
        } else {
          clearLastArticlePath()
          setExpandedDirectories(new Set())
          setLastSavedAt(null)
          setSaveState('saved')
        }
      } catch (error) {
        if (!ignore) {
          setSaveState('failed')
          setErrorMessage(getErrorMessage(error))
        }
      }
    }

    void boot()

    return () => {
      ignore = true
    }
  }, [loadArticle])

  useEffect(() => {
    if (!selectedPath || markdown === lastSavedMarkdown) {
      return
    }

    const timer = window.setTimeout(() => {
      void saveCurrentArticle()
    }, 900)

    return () => {
      window.clearTimeout(timer)
    }
  }, [lastSavedMarkdown, markdown, saveCurrentArticle, selectedPath])

  useEffect(() => {
    if (!openMenu) {
      return
    }

    function handleDocumentClick() {
      setOpenMenu(null)
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpenMenu(null)
      }
    }

    window.addEventListener('click', handleDocumentClick)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('click', handleDocumentClick)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [openMenu])

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
      setErrorMessage(getErrorMessage(error))
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

  function startCreateDirectory(parentPath: string) {
    setOpenMenu(null)
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
    setCreating(null)
    setDeleteTarget(null)
    setRenameTarget(target)
    setRenameName(target.name)
    setErrorMessage(null)
  }

  function startDelete(target: DeleteTarget) {
    setOpenMenu(null)
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
        const result = await requestJson<DirectoryRenameResponse>(
          '/api/articles/directories',
          {
            method: 'PATCH',
            body: JSON.stringify({
              path: renameTarget.path,
              name,
            }),
          },
        )

        syncSelectedPathAfterRename('directory', result.oldPath, result.path)
        syncExpandedDirectoriesAfterDirectoryRename(result.oldPath, result.path)
      } else {
        const result = await requestJson<ArticleRenameResponse>('/api/articles', {
          method: 'PATCH',
          body: JSON.stringify({
            path: renameTarget.path,
            name,
          }),
        })

        syncSelectedPathAfterRename('article', result.oldPath, result.path)
        if (selectedPathRef.current === result.path) {
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
      writeLastArticlePath(nextPath)
      setSelectedPath(nextPath)
      return
    }

    if (
      targetType === 'directory' &&
      (currentPath === oldPath || currentPath.startsWith(`${oldPath}/`))
    ) {
      const renamedPath = `${nextPath}${currentPath.slice(oldPath.length)}`

      selectedPathRef.current = renamedPath
      writeLastArticlePath(renamedPath)
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

  function clearCurrentArticle() {
    selectedPathRef.current = null
    markdownRef.current = ''
    lastSavedMarkdownRef.current = ''

    clearLastArticlePath()
    setSelectedPath(null)
    setMarkdown('')
    setLastSavedMarkdown('')
    setLastSavedAt(null)
    setCopyState('idle')
    setSaveState('saved')
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

      const pathParameter = encodeURIComponent(deleteTarget.path)
      const result =
        deleteTarget.type === 'directory'
          ? await requestJson<DeleteResponse>(
              `/api/articles/directories?path=${pathParameter}`,
              {
                method: 'DELETE',
              },
            )
          : await requestJson<DeleteResponse>(
              `/api/articles?path=${pathParameter}`,
              {
                method: 'DELETE',
              },
            )

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
        await requestJson('/api/articles/directories', {
          method: 'POST',
          body: JSON.stringify({
            parentPath: creating.parentPath,
            name,
          }),
        })
        await refreshTree()
      } else {
        const saved = await saveCurrentArticle()

        if (!saved) {
          return
        }

        expandDirectory(creating.directoryPath)
        const article = await requestJson<ArticleNode>('/api/articles', {
          method: 'POST',
          body: JSON.stringify({
            directoryPath: creating.directoryPath,
            name,
          }),
        })

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

  function renderActionMenu(target: RenameTarget, canCreateDirectory = false) {
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
              disabled={!canCreateDirectory}
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

    const canCreateDirectory = node.depth < maxDirectoryDepth
    const isExpanded = expandedDirectories.has(node.path)
    const isMenuOpen =
      openMenu?.type === 'directory' && openMenu.path === node.path

    return (
      <li className={`tree-item depth-${node.depth}`} key={node.path}>
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
            {renderActionMenu(
              {
                type: 'directory',
                path: node.path,
                name: node.name,
              },
              canCreateDirectory,
            )}
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

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="topbar-left">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              文
            </span>
            <div>
              <h1>md2wechat</h1>
              <p>Markdown 排版工作台</p>
            </div>
          </div>
          <div className="current-article" aria-live="polite">
            <span className="current-article-label">当前文章</span>
            <span className="current-article-name">
              {currentArticle?.name ?? '未选择文章'}
            </span>
            <span className="current-article-path">
              {selectedPath ?? '从左侧文章库选择或创建文章'}
            </span>
          </div>
        </div>
        <div className="topbar-actions">
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
                : '复制富文本'}
          </button>
        </div>
      </header>

      <section className="workspace" aria-label="Markdown 编辑和预览">
        <aside className="pane library-pane" aria-label="文章管理">
          <div className="pane-title library-title">
            <span>文章库</span>
            <button
              className="small-button primary"
              type="button"
              onClick={() => startCreateDirectory('')}
            >
              新目录
            </button>
          </div>
          <div className="library-scroll">
            {renderCreateForm(
              creating?.type === 'directory' && creating.parentPath === '',
            )}
            {tree ? (
              tree.children.length > 0 ? (
                <ul className="tree-list root-list">
                  {tree.children.map(renderTreeNode)}
                </ul>
              ) : (
                <div className="library-empty">先创建一个目录</div>
              )
            ) : (
              <div className="library-empty">正在读取文章库</div>
            )}
          </div>
        </aside>

        <label className="pane editor-pane">
          <span className="pane-title editor-title">
            <span>Markdown</span>
            <span>{currentArticle?.name ?? '未选择文章'}</span>
          </span>
          <textarea
            ref={editorScrollRef}
            value={markdown}
            disabled={!selectedPath || saveState === 'loading'}
            onChange={(event) => {
              handleMarkdownChange(event.target.value)
            }}
            onScroll={handleEditorScroll}
            placeholder="选择左侧文章后开始编辑"
            spellCheck={false}
          />
        </label>

        <section className="pane preview-pane" aria-labelledby="preview-title">
          <div className="pane-title preview-toolbar">
            <span id="preview-title">微信公众号预览</span>
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
        <span className={`status-item status-save ${saveState}`}>
          {getSaveStateText(saveState)}
        </span>
        <span className="status-divider" aria-hidden="true" />
        <span className="status-item">
          字数：
          <span className="status-value">{articleStats.characterCount}</span>
        </span>
        <span className="status-item">
          阅读：
          <span className="status-value">
            {formatReadTime(articleStats.readTimeMinutes)}
          </span>
        </span>
        <span className="status-item">
          最后保存：
          <span className="status-value">{formatSavedAt(displayedSavedAt)}</span>
        </span>
      </footer>

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
    </main>
  )
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })

  if (!response.ok) {
    let message = '请求失败'

    try {
      const body = (await response.json()) as { message?: string }

      if (body.message) {
        message = body.message
      }
    } catch {
      message = response.statusText || message
    }

    throw new Error(message)
  }

  return response.json() as Promise<T>
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

function findFirstArticle(tree: ArticleTree | DirectoryNode): ArticleNode | null {
  for (const child of tree.children) {
    if (child.type === 'article') {
      return child
    }

    const article = findFirstArticle(child)

    if (article) {
      return article
    }
  }

  return null
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

function readLastArticlePath() {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage.getItem(lastArticlePathStorageKey)
  } catch {
    return null
  }
}

function writeLastArticlePath(articlePath: string) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(lastArticlePathStorageKey, articlePath)
  } catch {
    return
  }
}

function clearLastArticlePath() {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.removeItem(lastArticlePathStorageKey)
  } catch {
    return
  }
}

function getParentDirectoryPaths(articlePath: string) {
  const segments = articlePath.split('/').slice(0, -1)

  return segments.map((_, index) => segments.slice(0, index + 1).join('/'))
}
