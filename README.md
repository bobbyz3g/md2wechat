# md2wechat

md2wechat 是一个面向微信公众号写作的 Markdown 排版工具。

它适合习惯用 Markdown 写文章，但最终需要发布到微信公众号的人。你可以在页面里输入 Markdown，查看接近公众号编辑器的排版效果，再把内容复制到公众号后台。

这个项目关注的是稳定的粘贴结果，而不只是把 Markdown 转成网页。标题、段落、引用、列表和代码块都会按公众号可接受的方式排版，尽量减少粘贴后样式丢失、结构变形、代码块显示不一致这类问题。

当前版本服务本地写作和手动发布流程，目标是让内容作者更快得到一份能直接贴进微信公众号的文章。

## 架构

md2wechat 由三部分组成：

- React + Vite 前端：提供文章树、Markdown 编辑器、公众号预览和复制富文本能力。
- Go 本地应用服务：通过 `/api` 接口管理真实目录和 `.md` 文件，并能内嵌前端构建产物形成单二进制。
- 文章库：保存真实 Markdown 文件，目录最多两层，文章必须位于目录中；开发环境默认使用项目内 `articles/`，分发版默认使用系统用户数据目录。

开发环境下，Vite 会把 `/api` 请求代理到本地 Go 服务。前端不会直接访问任意系统目录，服务端只允许读写文章库目录，并校验路径不能越界。

```text
md2wechat
├─ cmd/md2wechat/              # Go main 入口
├─ internal/
│  ├─ app/                     # 启动配置、监听端口、自动打开浏览器
│  ├─ articles/                # 文章库路径校验、目录和 .md 文件读写
│  └─ server/                  # /api 路由、JSON 请求响应、错误映射
├─ web/                        # React + Vite 前端工程和嵌入式静态资源 handler
├─ scripts/dev.mjs             # 同时启动 Go API 和 Vite 的开发脚本
└─ tools/release/windows/      # Windows 绿色包构建脚本
```

当前 API 能力：

- `GET /api/articles/tree`：读取文章树。
- `POST /api/articles/directories`：新增目录。
- `POST /api/articles`：新增文章。
- `PATCH /api/articles/directories`：重命名目录。
- `PATCH /api/articles`：重命名文章。
- `DELETE /api/articles/directories?path=...`：删除空目录树。
- `DELETE /api/articles?path=...`：删除文章。
- `GET /api/articles/content?path=...`：读取文章内容。
- `PUT /api/articles/content`：保存文章内容。

切换文章时会先保存当前文章，保存成功后再读取目标文章。编辑过程中也会自动保存；如果保存失败，页面会保留在当前文章并显示错误提示。

## 运行

开发环境需要 Node.js 22.14+、npm 10.9+ 和 Go 1.26。安装前端依赖并启动开发服务：

```sh
npm --prefix web install
npm run dev
```

`npm run dev` 会同时启动 Go API 服务和 Vite 前端。开发环境的文章库固定为项目内 `articles/`，启动后在浏览器打开终端里显示的 Vite 地址。

如果需要分别启动：

```sh
npm run dev:api
npm run dev:web
```

## 本地应用

Go 服务支持以下参数：

```sh
go run ./cmd/md2wechat --host 127.0.0.1 --port 4174 --article-root articles --no-open
```

- `--host`：监听地址，默认 `127.0.0.1`。
- `--port`：监听端口，默认 `4174`；端口被占用时会自动切换到可用端口。
- `--article-root`：文章库目录；优先级高于环境变量。
- `--no-open`：启动后不自动打开浏览器。

文章库路径优先级：

1. `--article-root`
2. `MD2WECHAT_ARTICLE_ROOT`
3. 系统用户数据目录，例如 Windows 下的 `%APPDATA%/md2wechat/articles`

构建 Windows 绿色分发包：

```sh
npm run release:windows
```

该命令会先执行前端构建，再交叉编译 `md2wechat.exe`，最终输出 `release/md2wechat-windows-amd64.zip`。

常用验证命令：

```sh
go test ./cmd/md2wechat ./internal/... ./web ./tools/release/windows
go vet ./cmd/md2wechat ./internal/... ./web ./tools/release/windows
npm run lint
npm run test
npm run build
```
