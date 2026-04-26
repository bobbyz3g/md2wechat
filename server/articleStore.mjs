import { constants as fsConstants } from 'node:fs'
import {
  access,
  mkdir,
  readdir,
  readFile,
  stat,
  writeFile,
} from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const serverDir = path.dirname(fileURLToPath(import.meta.url))

export const articleRoot = path.resolve(serverDir, '..', 'articles')

const maxDirectoryDepth = 2
const articleExtension = '.md'
const defaultMarkdown = `# 春日读书笔记

午后重读《长安的荔枝》，最打动我的还是那些看似细碎的执行细节。

> 真正困难的不是想法，而是把每一步都落到可验证的现实里。

## 摘录

- 时间会放大流程里的缝隙
- 好方案通常先解决最确定的问题
- 复杂系统需要留下回退空间

\`\`\`ts
const note = '先把路走通，再谈优雅'
\`\`\`
`

export class ArticleStoreError extends Error {
  constructor(statusCode, message) {
    super(message)
    this.name = 'ArticleStoreError'
    this.statusCode = statusCode
  }
}

export async function ensureDefaultLibrary() {
  const defaultDirectory = path.join(articleRoot, '默认目录')
  const defaultArticle = path.join(defaultDirectory, '春日读书笔记.md')

  await mkdir(defaultDirectory, { recursive: true })

  try {
    await writeFile(defaultArticle, defaultMarkdown, { flag: 'wx' })
  } catch (error) {
    if (error?.code !== 'EEXIST') {
      throw error
    }
  }
}

export async function getArticleTree() {
  await mkdir(articleRoot, { recursive: true })

  return {
    type: 'root',
    name: '文章库',
    path: '',
    children: await readDirectory('', 0),
  }
}

export async function createDirectory(parentPath, rawName) {
  const parent = resolveDirectoryPath(parentPath ?? '')

  if (parent.depth >= maxDirectoryDepth) {
    throw new ArticleStoreError(400, '目录最多只能创建两层')
  }

  await assertDirectoryExists(parent.fullPath)

  const name = validateName(rawName, '目录名')
  const fullPath = path.resolve(parent.fullPath, name)
  assertInsideArticleRoot(fullPath)

  try {
    await mkdir(fullPath)
  } catch (error) {
    if (error?.code === 'EEXIST') {
      throw new ArticleStoreError(409, '同名目录已存在')
    }

    throw error
  }

  const relativePath = joinPath(parent.relativePath, name)

  return {
    type: 'directory',
    name,
    path: relativePath,
    depth: parent.depth + 1,
    children: [],
  }
}

export async function createArticle(directoryPath, rawName, content = '') {
  const directory = resolveDirectoryPath(directoryPath ?? '')

  if (directory.depth < 1) {
    throw new ArticleStoreError(400, '文章必须创建在目录中')
  }

  if (directory.depth > maxDirectoryDepth) {
    throw new ArticleStoreError(400, '目录层级超过限制')
  }

  await assertDirectoryExists(directory.fullPath)

  const fileName = normalizeArticleFileName(rawName)
  const fullPath = path.resolve(directory.fullPath, fileName)
  assertInsideArticleRoot(fullPath)

  try {
    await writeFile(fullPath, content, { flag: 'wx' })
  } catch (error) {
    if (error?.code === 'EEXIST') {
      throw new ArticleStoreError(409, '同名文章已存在')
    }

    throw error
  }

  const fileStat = await stat(fullPath)

  return {
    type: 'article',
    name: getArticleName(fileName),
    path: joinPath(directory.relativePath, fileName),
    updatedAt: fileStat.mtime.toISOString(),
  }
}

export async function readArticle(articlePath) {
  const article = resolveArticlePath(articlePath)
  await assertFileExists(article.fullPath)

  return readFile(article.fullPath, 'utf8')
}

export async function saveArticle(articlePath, content) {
  if (typeof content !== 'string') {
    throw new ArticleStoreError(400, '文章内容必须是字符串')
  }

  const article = resolveArticlePath(articlePath)
  await assertFileExists(article.fullPath)
  await writeFile(article.fullPath, content)

  const fileStat = await stat(article.fullPath)

  return {
    path: article.relativePath,
    updatedAt: fileStat.mtime.toISOString(),
  }
}

async function readDirectory(relativePath, depth) {
  const directory = resolveDirectoryPath(relativePath)
  const entries = await readdir(directory.fullPath, { withFileTypes: true })
  const nodes = []

  for (const entry of entries) {
    const childPath = joinPath(relativePath, entry.name)

    if (entry.isDirectory()) {
      nodes.push({
        type: 'directory',
        name: entry.name,
        path: childPath,
        depth: depth + 1,
        children: await readDirectory(childPath, depth + 1),
      })
      continue
    }

    if (entry.isFile() && entry.name.endsWith(articleExtension)) {
      const fullPath = path.resolve(directory.fullPath, entry.name)
      const fileStat = await stat(fullPath)

      nodes.push({
        type: 'article',
        name: getArticleName(entry.name),
        path: childPath,
        updatedAt: fileStat.mtime.toISOString(),
      })
    }
  }

  return nodes.sort((left, right) => {
    if (left.type !== right.type) {
      return left.type === 'directory' ? -1 : 1
    }

    return left.name.localeCompare(right.name, 'zh-CN')
  })
}

function resolveDirectoryPath(relativePath) {
  const segments = getSafeSegments(relativePath ?? '', '目录路径')
  const fullPath = path.resolve(articleRoot, ...segments)
  assertInsideArticleRoot(fullPath)

  return {
    fullPath,
    relativePath: segments.join('/'),
    depth: segments.length,
  }
}

function resolveArticlePath(relativePath) {
  const segments = getSafeSegments(relativePath ?? '', '文章路径')
  const fileName = segments.at(-1)

  if (!fileName || !fileName.endsWith(articleExtension)) {
    throw new ArticleStoreError(400, '文章路径必须指向 .md 文件')
  }

  if (segments.length < 2) {
    throw new ArticleStoreError(400, '文章必须位于目录中')
  }

  const directoryDepth = segments.length - 1

  if (directoryDepth > maxDirectoryDepth) {
    throw new ArticleStoreError(400, '目录层级超过限制')
  }

  const fullPath = path.resolve(articleRoot, ...segments)
  assertInsideArticleRoot(fullPath)

  return {
    fullPath,
    relativePath: segments.join('/'),
  }
}

function getSafeSegments(relativePath, fieldName) {
  if (typeof relativePath !== 'string') {
    throw new ArticleStoreError(400, `${fieldName}必须是字符串`)
  }

  if (relativePath === '') {
    return []
  }

  if (
    relativePath.includes('\\') ||
    relativePath.startsWith('/') ||
    relativePath.includes('\0')
  ) {
    throw new ArticleStoreError(400, `${fieldName}不合法`)
  }

  const segments = relativePath.split('/')

  for (const segment of segments) {
    validatePathSegment(segment, fieldName)
  }

  return segments
}

function validatePathSegment(segment, fieldName) {
  if (!segment || segment === '.' || segment === '..') {
    throw new ArticleStoreError(400, `${fieldName}不合法`)
  }
}

function validateName(rawName, fieldName) {
  if (typeof rawName !== 'string') {
    throw new ArticleStoreError(400, `${fieldName}必须是字符串`)
  }

  const name = rawName.trim()

  if (!name) {
    throw new ArticleStoreError(400, `${fieldName}不能为空`)
  }

  if (
    name === '.' ||
    name === '..' ||
    name.includes('/') ||
    name.includes('\\') ||
    name.includes('\0') ||
    /[\r\n]/.test(name)
  ) {
    throw new ArticleStoreError(400, `${fieldName}不合法`)
  }

  if (name.length > 80) {
    throw new ArticleStoreError(400, `${fieldName}不能超过 80 个字符`)
  }

  return name
}

function normalizeArticleFileName(rawName) {
  const name = validateName(rawName, '文章名')
  const baseName = name.endsWith(articleExtension)
    ? name.slice(0, -articleExtension.length).trim()
    : name

  return `${validateName(baseName, '文章名')}${articleExtension}`
}

function getArticleName(fileName) {
  return fileName.slice(0, -articleExtension.length)
}

function joinPath(parentPath, childName) {
  return parentPath ? `${parentPath}/${childName}` : childName
}

async function assertDirectoryExists(fullPath) {
  try {
    const fileStat = await stat(fullPath)

    if (!fileStat.isDirectory()) {
      throw new ArticleStoreError(400, '目标路径不是目录')
    }
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new ArticleStoreError(404, '目录不存在')
    }

    throw error
  }
}

async function assertFileExists(fullPath) {
  try {
    await access(fullPath, fsConstants.R_OK | fsConstants.W_OK)
    const fileStat = await stat(fullPath)

    if (!fileStat.isFile()) {
      throw new ArticleStoreError(400, '目标路径不是文章文件')
    }
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new ArticleStoreError(404, '文章不存在')
    }

    throw error
  }
}

function assertInsideArticleRoot(fullPath) {
  const relativePath = path.relative(articleRoot, fullPath)

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new ArticleStoreError(400, '路径不能超出文章库')
  }
}
