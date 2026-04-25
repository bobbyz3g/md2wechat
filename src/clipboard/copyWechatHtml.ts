import type { RenderResult } from '../core/renderMarkdown'

export async function copyWechatHtml(result: RenderResult): Promise<void> {
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    throw new Error('当前浏览器不支持复制富文本 HTML')
  }

  const item = new ClipboardItem({
    'text/html': new Blob([result.html], { type: 'text/html' }),
    'text/plain': new Blob([result.text], { type: 'text/plain' }),
  })

  await navigator.clipboard.write([item])
}
