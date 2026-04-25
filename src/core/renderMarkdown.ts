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
  value?: string
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
    html: renderWrapper(theme, html),
    text: markdown.trim(),
  }
}

function renderWrapper(theme: WechatTheme, html: string) {
  const attributes = [
    'id="nice"',
    theme.dataTool ? `data-tool="${escapeAttribute(theme.dataTool)}"` : '',
    theme.website ? `data-website="${escapeAttribute(theme.website)}"` : '',
    `style="${theme.wrapperStyle}"`,
  ].filter(Boolean)

  return `<section ${attributes.join(' ')}>${html}</section>`
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
  applyElementStructure(node, theme, parentTagName)

  const tagName = node.tagName
  if (!tagName) {
    return
  }

  const style = getElementStyle(tagName, theme, parentTagName)
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

function applyElementStructure(
  node: HastNode,
  theme: WechatTheme,
  parentTagName?: string,
) {
  const tagName = node.tagName
  if (!tagName) {
    return
  }

  addDataTool(node, theme, parentTagName)

  if (isHeadingTag(tagName)) {
    wrapHeadingContent(node, theme, tagName)
  }

  if (tagName === 'li') {
    wrapListItemContent(node, theme)
  }

  if (tagName === 'blockquote') {
    addClassName(node, 'custom-blockquote')
    addClassName(node, 'multiquote-1')
    prependBlockquoteMarker(node, theme)
  }

  if (tagName === 'pre') {
    addClassName(node, 'custom')
    prependCodeBlockHeader(node, theme)
  }

  if (tagName === 'code' && parentTagName === 'pre') {
    node.properties = {
      ...node.properties,
      className: ['hljs'],
    }
  }
}

function getElementStyle(
  tagName: string,
  theme: WechatTheme,
  parentTagName?: string,
) {
  if (tagName === 'p' && parentTagName === 'blockquote') {
    return theme.blockquoteParagraphStyle ?? theme.elementStyles.p
  }

  return theme.elementStyles[tagName]
}

function codeBlockStyle(theme: WechatTheme) {
  return theme.codeBlockStyle ?? theme.elementStyles.code
}

function mergeStyle(existing: unknown, nextStyle: string) {
  if (typeof existing !== 'string' || existing.trim().length === 0) {
    return nextStyle
  }

  return `${existing.replace(/;?$/, ';')}${nextStyle}`
}

function addDataTool(
  node: HastNode,
  theme: WechatTheme,
  parentTagName?: string,
) {
  if (!theme.dataTool || !shouldAddDataTool(node.tagName, parentTagName)) {
    return
  }

  node.properties = {
    ...node.properties,
    'data-tool': theme.dataTool,
  }
}

function shouldAddDataTool(tagName?: string, parentTagName?: string) {
  if (!tagName) {
    return false
  }

  if (tagName === 'p') {
    return parentTagName !== 'blockquote'
  }

  return ['h1', 'h2', 'h3', 'h4', 'h5', 'blockquote', 'ol', 'ul', 'pre'].includes(
    tagName,
  )
}

function isHeadingTag(tagName: string): tagName is 'h1' | 'h2' | 'h3' | 'h4' | 'h5' {
  return ['h1', 'h2', 'h3', 'h4', 'h5'].includes(tagName)
}

function wrapHeadingContent(
  node: HastNode,
  theme: WechatTheme,
  tagName: 'h1' | 'h2' | 'h3' | 'h4' | 'h5',
) {
  if (!theme.headingContentStyles?.[tagName] || hasChildClass(node, 'content')) {
    return
  }

  const children = node.children ?? []
  node.children = [
    createElement('span', {
      className: ['prefix'],
      style: theme.headingPrefixStyle ?? 'display:none;',
    }),
    createElement(
      'span',
      {
        className: ['content'],
        style: theme.headingContentStyles[tagName],
      },
      children,
    ),
    createElement('span', {
      className: ['suffix'],
      style: theme.headingSuffixStyle ?? 'display:none;',
    }),
  ]

  if (tagName === 'h2' && theme.h2AfterStyle) {
    node.children.push(
      createElement('span', { style: theme.h2AfterStyle }, [
        { type: 'text', value: ' ' },
      ]),
    )
  }
}

function hasChildClass(node: HastNode, className: string) {
  return (node.children ?? []).some((child) => {
    const value = child.properties?.className

    return Array.isArray(value) && value.includes(className)
  })
}

function wrapListItemContent(node: HastNode, theme: WechatTheme) {
  if (!theme.listItemSectionStyle || hasSectionChild(node)) {
    return
  }

  const nextChildren: HastNode[] = []
  let bufferedChildren: HastNode[] = []

  for (const child of node.children ?? []) {
    if (child.tagName === 'ul' || child.tagName === 'ol') {
      flushListItemBuffer(nextChildren, bufferedChildren, theme)
      bufferedChildren = []
      nextChildren.push(child)
      continue
    }

    if (child.tagName === 'p') {
      bufferedChildren.push(...(child.children ?? []))
      continue
    }

    bufferedChildren.push(child)
  }

  flushListItemBuffer(nextChildren, bufferedChildren, theme)
  node.children = nextChildren
}

function hasSectionChild(node: HastNode) {
  return (node.children ?? []).some((child) => child.tagName === 'section')
}

function flushListItemBuffer(
  nextChildren: HastNode[],
  bufferedChildren: HastNode[],
  theme: WechatTheme,
) {
  if (bufferedChildren.length === 0) {
    return
  }

  nextChildren.push(
    createElement(
      'section',
      { style: theme.listItemSectionStyle },
      bufferedChildren,
    ),
  )
}

function prependBlockquoteMarker(node: HastNode, theme: WechatTheme) {
  if (!theme.blockquoteMarkerStyle || hasHiddenMarker(node)) {
    return
  }

  node.children = [
    createElement('span', { style: theme.blockquoteMarkerStyle }),
    ...(node.children ?? []),
  ]
}

function hasHiddenMarker(node: HastNode) {
  return (node.children ?? []).some(
    (child) => child.tagName === 'span' && child.properties?.style === 'display:none;',
  )
}

function prependCodeBlockHeader(node: HastNode, theme: WechatTheme) {
  if (!theme.codeBlockHeaderStyle || hasCodeBlockHeader(node, theme)) {
    return
  }

  node.children = [
    createElement(
      'span',
      { style: theme.codeBlockHeaderStyle },
      createCodeBlockHeaderDots(theme),
    ),
    ...(node.children ?? []),
  ]
}

function hasCodeBlockHeader(node: HastNode, theme: WechatTheme) {
  return (node.children ?? []).some(
    (child) =>
      child.tagName === 'span' &&
      child.properties?.style === theme.codeBlockHeaderStyle,
  )
}

function createElement(
  tagName: string,
  properties: Record<string, unknown> = {},
  children: HastNode[] = [],
): HastNode {
  return {
    type: 'element',
    tagName,
    properties,
    children,
  }
}

function createCodeBlockHeaderDots(theme: WechatTheme) {
  return (theme.codeBlockHeaderDotStyles ?? []).map((style) =>
    createElement('span', { style }, [{ type: 'text', value: '\u25cf' }]),
  )
}

function addClassName(node: HastNode, className: string) {
  const existing = node.properties?.className
  const classNames = Array.isArray(existing)
    ? existing.map(String)
    : typeof existing === 'string'
      ? existing.split(/\s+/)
      : []

  if (classNames.includes(className)) {
    return
  }

  node.properties = {
    ...node.properties,
    className: [...classNames, className],
  }
}

function escapeAttribute(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
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
