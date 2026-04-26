import {
  type FormEvent,
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

const maxDirectoryDepth = 2

export function App() {
  const [tree, setTree] = useState<ArticleTree | null>(null)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [markdown, setMarkdown] = useState('')
  const [lastSavedMarkdown, setLastSavedMarkdown] = useState('')
  const [saveState, setSaveState] = useState<SaveState>('loading')
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [creating, setCreating] = useState<CreateTarget | null>(null)
  const [createName, setCreateName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [switchingPath, setSwitchingPath] = useState<string | null>(null)

  const selectedPathRef = useRef<string | null>(null)
  const markdownRef = useRef('')
  const lastSavedMarkdownRef = useRef('')

  const rendered = useMemo(() => renderMarkdown(markdown), [markdown])
  const currentArticle = useMemo(
    () => (tree && selectedPath ? findArticle(tree, selectedPath) : null),
    [selectedPath, tree],
  )

  const loadArticle = useCallback(async (articlePath: string) => {
    setSaveState('loading')
    const article = await requestJson<ArticleContentResponse>(
      `/api/articles/content?path=${encodeURIComponent(articlePath)}`,
    )

    selectedPathRef.current = articlePath
    markdownRef.current = article.content
    lastSavedMarkdownRef.current = article.content

    setSelectedPath(articlePath)
    setMarkdown(article.content)
    setLastSavedMarkdown(article.content)
    setCopyState('idle')
    setErrorMessage(null)
    setSaveState('saved')
  }, [])

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
      await requestJson('/api/articles/content', {
        method: 'PUT',
        body: JSON.stringify({
          path: articlePath,
          content: currentMarkdown,
        }),
      })

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

  useEffect(() => {
    let ignore = false

    async function boot() {
      try {
        const nextTree = await requestJson<ArticleTree>('/api/articles/tree')

        if (ignore) {
          return
        }

        setTree(nextTree)

        const firstArticle = findFirstArticle(nextTree)

        if (firstArticle) {
          await loadArticle(firstArticle.path)
        } else {
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
      await loadArticle(articlePath)
    } catch (error) {
      setSaveState('failed')
      setErrorMessage(getErrorMessage(error))
    } finally {
      setSwitchingPath(null)
    }
  }

  function startCreateDirectory(parentPath: string) {
    setCreating({
      type: 'directory',
      parentPath,
    })
    setCreateName('')
    setErrorMessage(null)
  }

  function startCreateArticle(directoryPath: string) {
    setCreating({
      type: 'article',
      directoryPath,
    })
    setCreateName('')
    setErrorMessage(null)
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

        const article = await requestJson<ArticleNode>('/api/articles', {
          method: 'POST',
          body: JSON.stringify({
            directoryPath: creating.directoryPath,
            name,
          }),
        })

        await refreshTree()
        await loadArticle(article.path)
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

  function renderTreeNode(node: TreeNode) {
    if (node.type === 'article') {
      const isActive = node.path === selectedPath
      const isSwitching = switchingPath === node.path

      return (
        <li className="tree-item" key={node.path}>
          <button
            className={`article-row${isActive ? ' is-active' : ''}`}
            type="button"
            disabled={saveState === 'loading' || Boolean(switchingPath)}
            onClick={() => void handleSelectArticle(node.path)}
          >
            <span className="article-dot" aria-hidden="true" />
            <span className="tree-name">{node.name}</span>
            {isSwitching ? <span className="row-note">切换中</span> : null}
          </button>
        </li>
      )
    }

    const canCreateDirectory = node.depth < maxDirectoryDepth

    return (
      <li className={`tree-item depth-${node.depth}`} key={node.path}>
        <div className="directory-row">
          <span className="directory-marker" aria-hidden="true" />
          <span className="tree-name">{node.name}</span>
          <div className="row-actions">
            <button
              className="small-button"
              type="button"
              onClick={() => startCreateArticle(node.path)}
            >
              新文章
            </button>
            <button
              className="small-button"
              type="button"
              disabled={!canCreateDirectory}
              onClick={() => startCreateDirectory(node.path)}
            >
              新目录
            </button>
          </div>
        </div>
        {renderCreateForm(
          (creating?.type === 'directory' &&
            creating.parentPath === node.path) ||
            (creating?.type === 'article' &&
              creating.directoryPath === node.path),
        )}
        {node.children.length > 0 ? (
          <ul className="tree-list">{node.children.map(renderTreeNode)}</ul>
        ) : (
          <div className="empty-folder">还没有文章</div>
        )}
      </li>
    )
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            文
          </span>
          <div>
            <h1>md2wechat</h1>
            <p>Markdown 排版工作台</p>
          </div>
        </div>
        <div className="topbar-actions">
          <span className={`save-status ${saveState}`}>
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
            value={markdown}
            disabled={!selectedPath || saveState === 'loading'}
            onChange={(event) => {
              handleMarkdownChange(event.target.value)
            }}
            placeholder="选择左侧文章后开始编辑"
            spellCheck={false}
          />
        </label>

        <section className="pane preview-pane" aria-labelledby="preview-title">
          <div className="pane-title" id="preview-title">
            微信公众号预览
          </div>
          <article
            className="wechat-preview"
            dangerouslySetInnerHTML={{ __html: rendered.html }}
          />
        </section>
      </section>

      {errorMessage ? (
        <div className="app-message" role="alert">
          {errorMessage}
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
