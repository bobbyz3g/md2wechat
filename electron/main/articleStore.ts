import {
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises'
import path from 'node:path'

import type {
  ArticleContent,
  ArticleNode,
  ArticleRenameResult,
  ArticleSaveMode,
  ArticleSaveResult,
  ArticleStatus,
  ArticleTree,
  DeleteResult,
  DirectoryNode,
  DirectoryRenameResult,
  DesktopErrorCode,
  TreeNode,
} from '../shared/types'

export type AppErrorCode = DesktopErrorCode

export class AppError extends Error {
  readonly code: AppErrorCode

  constructor(code: AppErrorCode, message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause })
    this.name = 'AppError'
    this.code = code
  }
}

type ResolvedPath = {
  absolutePath: string
  relativePath: string
  depth: number
}

type ErrorMessages = {
  notFound?: string
  conflict?: string
}

export class ArticleStore {
  readonly rootPath: string

  private constructor(rootPath: string) {
    this.rootPath = rootPath
  }

  static async open(rootPath: string): Promise<ArticleStore> {
    if (typeof rootPath !== 'string' || rootPath.length === 0) {
      throw new AppError('INVALID_PATH', '目录路径不合法')
    }

    const absoluteRoot = path.resolve(rootPath)

    try {
      const rootStat = await lstat(absoluteRoot)
      if (rootStat.isSymbolicLink()) {
        throw new AppError('INVALID_PATH', '目录路径不合法')
      }
      if (!rootStat.isDirectory()) {
        throw new AppError('INVALID_PATH', '目标路径不是目录')
      }
    } catch (error) {
      throw mapFileSystemError(error, { notFound: '目录不存在' })
    }

    return new ArticleStore(absoluteRoot)
  }

  async getTree(): Promise<ArticleTree> {
    const root = await this.resolvePath('', 'directory')
    return {
      type: 'root',
      name: '文章库',
      path: '',
      children: await this.readDirectory(root.absolutePath, '', 0),
    }
  }

  async createDirectory(
    parentPath: string,
    rawName: string,
  ): Promise<DirectoryNode> {
    const parent = await this.resolvePath(parentPath, 'directory')
    const name = validateName(rawName, '目录名')
    const relativePath = joinRelativePath(parent.relativePath, name)
    const target = await this.resolvePath(relativePath, 'directory', true)

    try {
      await mkdir(target.absolutePath)
    } catch (error) {
      throw mapFileSystemError(error, { conflict: '同名目录已存在' })
    }

    return {
      type: 'directory',
      name,
      path: target.relativePath,
      depth: target.depth,
      children: [],
    }
  }

  async renameDirectory(
    directoryPath: string,
    rawName: string,
  ): Promise<DirectoryRenameResult> {
    const source = await this.resolvePath(directoryPath, 'directory')
    if (source.depth === 0) {
      throw new AppError('INVALID_PATH', '不能重命名文章库根目录')
    }

    const name = validateName(rawName, '目录名')
    const parentPath = parentRelativePath(source.relativePath)
    const targetRelativePath = joinRelativePath(parentPath, name)

    if (targetRelativePath === source.relativePath) {
      return {
        oldPath: source.relativePath,
        path: source.relativePath,
        name,
      }
    }

    const target = await this.resolvePath(
      targetRelativePath,
      'directory',
      true,
    )
    await assertPathAvailable(target.absolutePath, '同名目录已存在')

    try {
      await rename(source.absolutePath, target.absolutePath)
    } catch (error) {
      throw mapFileSystemError(error, { conflict: '同名目录已存在' })
    }

    return {
      oldPath: source.relativePath,
      path: target.relativePath,
      name,
    }
  }

  async deleteDirectory(directoryPath: string): Promise<DeleteResult> {
    const directory = await this.resolvePath(directoryPath, 'directory')
    if (directory.depth === 0) {
      throw new AppError('INVALID_PATH', '不能删除文章库根目录')
    }

    await this.assertDirectoryCanBeDeleted(directory.absolutePath)

    try {
      await rm(directory.absolutePath, { recursive: true })
    } catch (error) {
      throw mapFileSystemError(error, { notFound: '目录不存在' })
    }

    return { path: directory.relativePath }
  }

  async createArticle(
    directoryPath: string,
    rawName: string,
    initialContent: string,
  ): Promise<ArticleNode> {
    if (typeof initialContent !== 'string') {
      throw new AppError('INVALID_PATH', '文章内容必须是字符串')
    }

    const directory = await this.resolvePath(directoryPath, 'directory')
    const fileName = normalizeArticleFileName(rawName)
    const relativePath = joinRelativePath(directory.relativePath, fileName)
    const target = await this.resolvePath(relativePath, 'article', true)

    try {
      await writeFile(target.absolutePath, initialContent, {
        encoding: 'utf8',
        flag: 'wx',
      })
      const fileStat = await stat(target.absolutePath)
      return {
        type: 'article',
        name: getArticleName(fileName),
        path: target.relativePath,
        updatedAt: fileStat.mtime.toISOString(),
      }
    } catch (error) {
      throw mapFileSystemError(error, {
        notFound: '文章不存在',
        conflict: '同名文章已存在',
      })
    }
  }

  async readArticle(articlePath: string): Promise<ArticleContent> {
    const article = await this.resolvePath(articlePath, 'article')

    try {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const beforeRead = await stat(article.absolutePath)
        const content = await readFile(article.absolutePath, 'utf8')
        const afterRead = await stat(article.absolutePath)

        if (createArticleRevision(beforeRead) === createArticleRevision(afterRead)) {
          return createArticleContent(article.relativePath, content, afterRead)
        }
      }

      throw new AppError('CONFLICT', '文章读取期间发生变化，请重试')
    } catch (error) {
      throw mapFileSystemError(error, { notFound: '文章不存在' })
    }
  }

  async getArticleStatus(articlePath: string): Promise<ArticleStatus> {
    const article = await this.resolvePath(articlePath, 'article')

    try {
      const fileStat = await stat(article.absolutePath)
      return createArticleStatus(article.relativePath, fileStat)
    } catch (error) {
      throw mapFileSystemError(error, { notFound: '文章不存在' })
    }
  }

  async saveArticle(
    articlePath: string,
    content: string,
    expectedRevision: string,
    mode: ArticleSaveMode,
  ): Promise<ArticleSaveResult> {
    if (typeof content !== 'string') {
      throw new AppError('INVALID_PATH', '文章内容必须是字符串')
    }

    const article = await this.resolvePath(
      articlePath,
      'article',
      mode === 'create',
    )

    try {
      if (mode === 'normal') {
        const currentStat = await stat(article.absolutePath)
        if (createArticleRevision(currentStat) !== expectedRevision) {
          throw new AppError('CONFLICT', '磁盘文件已变化')
        }
      }

      await writeFile(
        article.absolutePath,
        content,
        mode === 'create' ? { encoding: 'utf8', flag: 'wx' } : 'utf8',
      )
      const fileStat = await stat(article.absolutePath)
      return createArticleStatus(article.relativePath, fileStat)
    } catch (error) {
      throw mapFileSystemError(error, {
        notFound: '文章不存在',
        conflict: '磁盘文件已重新出现',
      })
    }
  }

  async renameArticle(
    articlePath: string,
    rawName: string,
  ): Promise<ArticleRenameResult> {
    const source = await this.resolvePath(articlePath, 'article')
    const fileName = normalizeArticleFileName(rawName)
    const parentPath = parentRelativePath(source.relativePath)
    const targetRelativePath = joinRelativePath(parentPath, fileName)

    if (targetRelativePath === source.relativePath) {
      try {
        const fileStat = await stat(source.absolutePath)
        return {
          oldPath: source.relativePath,
          path: source.relativePath,
          name: getArticleName(fileName),
          updatedAt: fileStat.mtime.toISOString(),
        }
      } catch (error) {
        throw mapFileSystemError(error, { notFound: '文章不存在' })
      }
    }

    const target = await this.resolvePath(
      targetRelativePath,
      'article',
      true,
    )
    await assertPathAvailable(target.absolutePath, '同名文章已存在')

    try {
      await rename(source.absolutePath, target.absolutePath)
      const fileStat = await stat(target.absolutePath)
      return {
        oldPath: source.relativePath,
        path: target.relativePath,
        name: getArticleName(fileName),
        updatedAt: fileStat.mtime.toISOString(),
      }
    } catch (error) {
      throw mapFileSystemError(error, {
        notFound: '文章不存在',
        conflict: '同名文章已存在',
      })
    }
  }

  async deleteArticle(articlePath: string): Promise<DeleteResult> {
    const article = await this.resolvePath(articlePath, 'article')

    try {
      await unlink(article.absolutePath)
    } catch (error) {
      throw mapFileSystemError(error, { notFound: '文章不存在' })
    }

    return { path: article.relativePath }
  }

  private async resolvePath(
    relativePath: string,
    kind: 'directory' | 'article',
    allowMissingLeaf = false,
  ): Promise<ResolvedPath> {
    const pathMessage = kind === 'directory' ? '目录路径不合法' : '文章路径不合法'
    if (
      typeof relativePath !== 'string' ||
      relativePath.includes('\\') ||
      relativePath.includes('\0') ||
      path.isAbsolute(relativePath)
    ) {
      throw new AppError('INVALID_PATH', pathMessage)
    }

    const segments = relativePath === '' ? [] : relativePath.split('/')
    if (
      segments.some(
        (segment) => segment === '' || segment === '.' || segment === '..',
      )
    ) {
      throw new AppError('INVALID_PATH', pathMessage)
    }

    if (
      kind === 'article' &&
      (segments.length === 0 || !segments.at(-1)?.endsWith('.md'))
    ) {
      throw new AppError('INVALID_PATH', '文章路径必须指向 .md 文件')
    }

    const absolutePath = path.resolve(this.rootPath, ...segments)
    const relativeToRoot = path.relative(this.rootPath, absolutePath)
    if (
      path.isAbsolute(relativeToRoot) ||
      relativeToRoot === '..' ||
      relativeToRoot.startsWith(`..${path.sep}`)
    ) {
      throw new AppError('INVALID_PATH', pathMessage)
    }

    let currentPath = this.rootPath
    const pathsToCheck = segments.length === 0 ? [this.rootPath] : segments

    for (const [index, segment] of pathsToCheck.entries()) {
      if (segments.length > 0) {
        currentPath = path.join(currentPath, segment)
      }

      const isLeaf = index === pathsToCheck.length - 1

      try {
        const currentStat = await lstat(currentPath)
        if (currentStat.isSymbolicLink()) {
          throw new AppError('INVALID_PATH', pathMessage)
        }

        if (!isLeaf && !currentStat.isDirectory()) {
          throw new AppError('INVALID_PATH', '目标路径不是目录')
        }

        if (isLeaf && !allowMissingLeaf) {
          if (kind === 'directory' && !currentStat.isDirectory()) {
            throw new AppError('INVALID_PATH', '目标路径不是目录')
          }
          if (kind === 'article' && !currentStat.isFile()) {
            throw new AppError('INVALID_PATH', '目标路径不是文章文件')
          }
        }
      } catch (error) {
        if (allowMissingLeaf && isLeaf && isFileSystemError(error, 'ENOENT')) {
          continue
        }

        const notFound =
          isLeaf && kind === 'article' ? '文章不存在' : '目录不存在'
        throw mapFileSystemError(error, { notFound })
      }
    }

    return {
      absolutePath,
      relativePath: segments.join('/'),
      depth: segments.length,
    }
  }

  private async readDirectory(
    absolutePath: string,
    relativePath: string,
    depth: number,
  ): Promise<TreeNode[]> {
    try {
      const entries = await readdir(absolutePath, { withFileTypes: true })
      const nodes: TreeNode[] = []

      for (const entry of entries) {
        const childRelativePath = joinRelativePath(relativePath, entry.name)
        const childAbsolutePath = path.join(absolutePath, entry.name)

        if (entry.isDirectory()) {
          nodes.push({
            type: 'directory',
            name: entry.name,
            path: childRelativePath,
            depth: depth + 1,
            children: await this.readDirectory(
              childAbsolutePath,
              childRelativePath,
              depth + 1,
            ),
          })
          continue
        }

        if (!entry.isFile() || !entry.name.endsWith('.md')) {
          continue
        }

        const fileStat = await lstat(childAbsolutePath)
        if (fileStat.isSymbolicLink() || !fileStat.isFile()) {
          continue
        }

        nodes.push({
          type: 'article',
          name: getArticleName(entry.name),
          path: childRelativePath,
          updatedAt: fileStat.mtime.toISOString(),
        })
      }

      return nodes.sort(compareTreeNodes)
    } catch (error) {
      throw mapFileSystemError(error, { notFound: '目录不存在' })
    }
  }

  private async assertDirectoryCanBeDeleted(absolutePath: string): Promise<void> {
    try {
      const entries = await readdir(absolutePath, { withFileTypes: true })
      for (const entry of entries) {
        const childPath = path.join(absolutePath, entry.name)
        if (entry.isDirectory()) {
          await this.assertDirectoryCanBeDeleted(childPath)
          continue
        }

        if (entry.isFile() && entry.name.endsWith('.md')) {
          throw new AppError('CONFLICT', '目录下还有文章')
        }

        throw new AppError('CONFLICT', '目录下还有非文章文件')
      }
    } catch (error) {
      throw mapFileSystemError(error, { notFound: '目录不存在' })
    }
  }
}

function validateName(rawName: unknown, fieldName: '目录名' | '文章名') {
  if (typeof rawName !== 'string') {
    throw new AppError('INVALID_PATH', `${fieldName}必须是字符串`)
  }

  const name = rawName.trim()
  if (name === '') {
    throw new AppError('INVALID_PATH', `${fieldName}不能为空`)
  }

  if (
    name === '.' ||
    name === '..' ||
    name.includes('/') ||
    name.includes('\\') ||
    name.includes('\0') ||
    name.includes('\r') ||
    name.includes('\n')
  ) {
    throw new AppError('INVALID_PATH', `${fieldName}不合法`)
  }

  if ([...name].length > 80) {
    throw new AppError('INVALID_PATH', `${fieldName}不能超过 80 个字符`)
  }

  return name
}

function normalizeArticleFileName(rawName: unknown) {
  let baseName = validateName(rawName, '文章名')
  if (baseName.endsWith('.md')) {
    baseName = baseName.slice(0, -3).trim()
  }
  return `${validateName(baseName, '文章名')}.md`
}

function getArticleName(fileName: string) {
  return fileName.slice(0, -3)
}

function joinRelativePath(parentPath: string, childName: string) {
  return parentPath === '' ? childName : `${parentPath}/${childName}`
}

function parentRelativePath(relativePath: string) {
  const separatorIndex = relativePath.lastIndexOf('/')
  return separatorIndex === -1 ? '' : relativePath.slice(0, separatorIndex)
}

function compareTreeNodes(left: TreeNode, right: TreeNode) {
  if (left.type !== right.type) {
    return left.type === 'directory' ? -1 : 1
  }
  return left.name.localeCompare(right.name, 'zh-CN')
}

function createArticleContent(
  articlePath: string,
  content: string,
  fileStat: { mtime: Date; mtimeMs: number; size: number },
): ArticleContent {
  return {
    ...createArticleStatus(articlePath, fileStat),
    content,
  }
}

function createArticleStatus(
  articlePath: string,
  fileStat: { mtime: Date; mtimeMs: number; size: number },
): ArticleStatus {
  return {
    path: articlePath,
    updatedAt: fileStat.mtime.toISOString(),
    revision: createArticleRevision(fileStat),
  }
}

function createArticleRevision(fileStat: { mtimeMs: number; size: number }) {
  return `${fileStat.mtimeMs}:${fileStat.size}`
}

async function assertPathAvailable(absolutePath: string, message: string) {
  try {
    await lstat(absolutePath)
  } catch (error) {
    if (isFileSystemError(error, 'ENOENT')) {
      return
    }
    throw mapFileSystemError(error)
  }
  throw new AppError('CONFLICT', message)
}

function mapFileSystemError(
  error: unknown,
  messages: ErrorMessages = {},
): AppError {
  if (error instanceof AppError) {
    return error
  }

  if (isFileSystemError(error, 'ENOENT')) {
    return new AppError('NOT_FOUND', messages.notFound ?? '路径不存在', error)
  }
  if (isFileSystemError(error, 'EEXIST')) {
    return new AppError(
      'CONFLICT',
      messages.conflict ?? '目标路径已存在',
      error,
    )
  }
  if (
    isFileSystemError(error, 'EACCES') ||
    isFileSystemError(error, 'EPERM')
  ) {
    return new AppError('PERMISSION_DENIED', '没有文件访问权限', error)
  }
  return new AppError('IO_ERROR', '文件操作失败', error)
}

function isFileSystemError(error: unknown, code: string) {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === code
  )
}
