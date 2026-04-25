import { describe, expect, it } from 'vitest'

import { renderMarkdown } from './renderMarkdown'

describe('renderMarkdown', () => {
  it('returns empty output for empty markdown', () => {
    expect(renderMarkdown('  \n\t  ')).toEqual({ html: '', text: '' })
  })

  it('renders common article blocks with inline styles', () => {
    const result = renderMarkdown(`# 标题

> 引用

- 第一项
- 第二项

\`\`\`ts
const value = 1
\`\`\`
`)

    expect(result.html).toContain('<section style=')
    expect(result.html).toContain('<h1 style=')
    expect(result.html).toContain('<blockquote style=')
    expect(result.html).toContain('<ul style=')
    expect(result.html).toContain('<pre style=')
    expect(result.text).toContain('# 标题')
  })

  it('supports gfm tables and strikethrough', () => {
    const result = renderMarkdown(`| 名称 | 状态 |
| --- | --- |
| MVP | ~~草稿~~ |
`)

    expect(result.html).toContain('<table style=')
    expect(result.html).toContain('<th style=')
    expect(result.html).toContain('<td style=')
    expect(result.html).toContain('<del style=')
  })

  it('removes unsafe link protocols before previewing html', () => {
    const result = renderMarkdown('[危险链接](javascript:alert(1))')

    expect(result.html).toContain('<a style=')
    expect(result.html).not.toContain('javascript:')
    expect(result.html).not.toContain('href=')
  })
})
