import { useMemo, useState } from 'react'

import { copyWechatHtml } from '../clipboard/copyWechatHtml'
import { renderMarkdown } from '../core/renderMarkdown'

const initialMarkdown = `# 春日读书笔记

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

type CopyState = 'idle' | 'copied' | 'failed'

export function App() {
  const [markdown, setMarkdown] = useState(initialMarkdown)
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const rendered = useMemo(() => renderMarkdown(markdown), [markdown])

  async function handleCopy() {
    try {
      await copyWechatHtml(rendered)
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
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
        <button className="copy-button" type="button" onClick={handleCopy}>
          {copyState === 'copied'
            ? '已复制'
            : copyState === 'failed'
              ? '复制失败'
              : '复制富文本'}
        </button>
      </header>

      <section className="workspace" aria-label="Markdown 编辑和预览">
        <label className="pane editor-pane">
          <span className="pane-title">Markdown</span>
          <textarea
            value={markdown}
            onChange={(event) => {
              setMarkdown(event.target.value)
              setCopyState('idle')
            }}
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
    </main>
  )
}
