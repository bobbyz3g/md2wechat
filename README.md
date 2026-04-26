# md2wechat

md2wechat 是一个面向微信公众号写作的 Markdown 排版工具。

它适合习惯用 Markdown 写文章，但最终需要发布到微信公众号的人。你可以在页面里输入 Markdown，查看接近公众号编辑器的排版效果，再把内容复制到公众号后台。

这个项目关注的是稳定的粘贴结果，而不只是把 Markdown 转成网页。标题、段落、引用、列表和代码块都会按公众号可接受的方式排版，尽量减少粘贴后样式丢失、结构变形、代码块显示不一致这类问题。

当前版本服务本地写作和手动发布流程，目标是让内容作者更快得到一份能直接贴进微信公众号的文章。

## 架构

md2wechat 由三部分组成：

- React + Vite 前端：提供文章树、Markdown 编辑器、公众号预览和复制富文本能力。
- Node 本地 API 服务：通过 `/api` 接口管理真实目录和 `.md` 文件，不依赖 Express 等额外框架。
- `articles/` 文章库：保存真实 Markdown 文件，目录最多两层，文章必须位于目录中。

开发环境下，Vite 会把 `/api` 请求代理到本地 Node 服务。前端不会直接访问任意系统目录，服务端只允许读写项目内的 `articles/`，并校验路径不能越界。

```text
md2wechat
├─ articles/              # 本地 Markdown 文章库
├─ server/                # Node 本地 API 服务
│  ├─ articleStore.mjs    # 文章目录、文件读写和路径校验
│  ├─ index.mjs           # HTTP API 入口
│  └─ dev.mjs             # 同时启动前端和 API 的开发脚本
└─ src/                   # React 前端
```

当前 API 能力：

- `GET /api/articles/tree`：读取文章树。
- `POST /api/articles/directories`：新增目录。
- `POST /api/articles`：新增文章。
- `PATCH /api/articles/directories`：重命名目录。
- `PATCH /api/articles`：重命名文章。
- `GET /api/articles/content?path=...`：读取文章内容。
- `PUT /api/articles/content`：保存文章内容。

切换文章时会先保存当前文章，保存成功后再读取目标文章。编辑过程中也会自动保存；如果保存失败，页面会保留在当前文章并显示错误提示。

## 运行

在已有 npm 环境下安装依赖并启动开发服务：

```sh
npm install
npm run dev
```

`npm run dev` 会同时启动 Node API 服务和 Vite 前端。启动后在浏览器打开终端里显示的本地地址。

如果需要分别启动：

```sh
npm run dev:api
npm run dev:web
```
