# md2wechat

一个面向微信公众号排版的 Markdown 预览与复制工具。

第一版目标很小：输入 Markdown，实时生成带内联样式的公众号可粘贴 HTML，并通过浏览器 Clipboard API 复制富文本。

## 开发

当前仓库使用 WSL nvm 管理的 Node.js。

```sh
source ~/.nvm/nvm.sh
npm install
npm run dev
```

## 脚本

```sh
npm run lint
npm test
npm run build
```

## 结构

```text
src/core/
  renderMarkdown.ts
  themes.ts
src/clipboard/
  copyWechatHtml.ts
src/app/
  App.tsx
  styles.css
```

`src/core` 是后续 CLI 和 Web UI 可以共同复用的渲染核心。
