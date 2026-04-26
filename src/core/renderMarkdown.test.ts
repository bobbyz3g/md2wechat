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

    expect(result.html).toContain('<section id="nice"')
    expect(result.html).toContain('data-tool="mdnice编辑器"')
    expect(result.html).toContain('<h1 data-tool="mdnice编辑器"')
    expect(result.html).toContain('<span class="content"')
    expect(result.html).toContain('<blockquote data-tool="mdnice编辑器"')
    expect(result.html).toContain('class="custom-blockquote multiquote-1"')
    expect(result.html).toContain('<ul data-tool="mdnice编辑器"')
    expect(result.html).toContain('<li><section style=')
    expect(result.html).toContain('<pre data-tool="mdnice编辑器"')
    expect(result.html).toContain('class="hljs language-ts"')
    expect(result.html).toContain('class="hljs-keyword"')
    expect(result.html).toContain('style="color:#c678dd;line-height:26px;"')
    expect(result.text).toContain('# 标题')
  })

  it('renders the mdnice heading and code-block structure', () => {
    const result = renderMarkdown(`## 二级标题

\`\`\`
这里是代码块
\`\`\`
`)

    expect(result.html).toContain('background-color:rgb(239, 112, 96)')
    expect(result.html).toContain('border-bottom-width:36px')
    expect(result.html).toContain('background-color:#282c34')
    expect(result.html).toContain('overflow-x:auto')
    expect(result.html).toContain('display:-webkit-box')
    expect(result.html).not.toContain('white-space:pre')
    expect(result.html).not.toContain('word-break:normal')
    expect(result.html).not.toContain('overflow-wrap:normal')
    expect(result.html).not.toContain('width:max-content')
    expect(result.html).not.toContain('min-width:100%')
    expect(result.html).toContain('background-color:#ff5f56')
    expect(result.html).toContain('background-color:#ffbd2e')
    expect(result.html).toContain('background-color:#27c93f')
    expect(result.html).toContain('color:#ff5f56')
    expect(result.html).toContain('>\u25cf</span>')
    expect(result.html).not.toContain('hljs-keyword')
    expect(result.html).not.toContain('files.mdnice.com')
  })

  it('does not detect language for unlabeled code blocks', () => {
    const result = renderMarkdown(`\`\`\`
const value = 1
\`\`\`
`)

    expect(result.html).toContain('<code class="hljs"')
    expect(result.html).not.toContain('class="hljs-keyword"')
    expect(result.html).not.toContain('style="color:#c678dd;line-height:26px;"')
  })

  it('materializes code whitespace for rich text paste targets', () => {
    const result = renderMarkdown(`\`\`\`go
func buildInfoHandler() {
\treturn
}
\`\`\`
`)

    expect(result.html).toContain(`</span>\u00a0<span`)
    expect(result.html).toContain('<br>')
    expect(result.html).toContain('display:-webkit-box')
    expect(result.html).toContain(`\u00a0\u00a0\u00a0\u00a0<span`)
    expect(result.html).not.toContain('width:max-content')
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
