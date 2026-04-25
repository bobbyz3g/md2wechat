import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'

import { getTheme, type ThemeId, type WechatTheme } from './themes'

export type RenderOptions = {
  themeId?: ThemeId
}

export type RenderResult = {
  html: string
  text: string
}

type HastNode = {
  type?: string
  tagName?: string
  properties?: Record<string, unknown>
  children?: HastNode[]
}

export function renderMarkdown(
  markdown: string,
  options: RenderOptions = {},
): RenderResult {
  if (markdown.trim().length === 0) {
    return { html: '', text: '' }
  }

  const theme = getTheme(options.themeId)
  const html = String(
    unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype)
      .use(applyWechatTheme, theme)
      .use(rehypeStringify)
      .processSync(markdown),
  )

  return {
    html: `<section style="${theme.wrapperStyle}">${html}</section>`,
    text: markdown.trim(),
  }
}

function applyWechatTheme(theme: WechatTheme) {
  return function transform(tree: unknown) {
    walk(tree as HastNode, theme)
  }
}

function walk(node: HastNode, theme: WechatTheme, parentTagName?: string) {
  if (node.type === 'element' && node.tagName) {
    applyElementStyle(node, theme, parentTagName)
  }

  for (const child of node.children ?? []) {
    walk(child, theme, node.tagName)
  }
}

function applyElementStyle(
  node: HastNode,
  theme: WechatTheme,
  parentTagName?: string,
) {
  sanitizeElementProperties(node)

  const tagName = node.tagName
  if (!tagName) {
    return
  }

  const style = theme.elementStyles[tagName]
  if (!style) {
    return
  }

  const nextStyle =
    tagName === 'code' && parentTagName === 'pre'
      ? codeBlockStyle(theme)
      : style

  node.properties = {
    ...node.properties,
    style: mergeStyle(node.properties?.style, nextStyle),
  }
}

function codeBlockStyle(theme: WechatTheme) {
  return [
    theme.elementStyles.code,
    'display:block;padding:0;background:transparent;color:inherit;border-radius:0;',
  ].join('')
}

function mergeStyle(existing: unknown, nextStyle: string) {
  if (typeof existing !== 'string' || existing.trim().length === 0) {
    return nextStyle
  }

  return `${existing.replace(/;?$/, ';')}${nextStyle}`
}

function sanitizeElementProperties(node: HastNode) {
  if (!node.properties) {
    return
  }

  removeUnsafeUrl(node.properties, 'href')
  removeUnsafeUrl(node.properties, 'src')
}

function removeUnsafeUrl(properties: Record<string, unknown>, key: string) {
  const value = properties[key]
  if (typeof value !== 'string') {
    return
  }

  if (!isSafeUrl(value)) {
    delete properties[key]
  }
}

function isSafeUrl(value: string) {
  const trimmed = value.trim().toLowerCase()

  return (
    trimmed.startsWith('#') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('./') ||
    trimmed.startsWith('../') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('tel:')
  )
}
