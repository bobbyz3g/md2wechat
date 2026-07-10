# Electron Desktop Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 md2wechat 从浏览器中的 Go 本地服务迁移为跨平台 Electron 桌面应用，同时保留现有编辑、预览、文章管理、自动保存和磁盘冲突处理能力。

**Architecture:** Electron 主进程负责窗口、菜单、应用配置和文章库文件操作，预加载脚本通过受限 IPC 暴露类型明确的桌面 API，React 渲染进程继续负责编辑器和预览。应用只运行桌面端，不启动 localhost 或 Go 子进程；Go 源码在第一阶段保留用于回滚。

**Tech Stack:** Electron 43.1.0、Electron Forge 7.11.2、Forge Vite Plugin 7.11.2、React 19.2.5、Vite 8.0.10、TypeScript 6.0.3、Node.js 22.14+、npm 10.9.2。

## Global Constraints

- 所有代码注释使用中文，变量和函数使用英文。
- 本功能不新增自动化测试；每个任务运行现有测试、类型检查、lint 或手动验收中适用的部分。
- 不删除 Go 源码、Makefile 旧目标或 Go 发布工具；Electron 验收完成后另行确认清理。
- 执行 Task 1 前必须再次确认移动 `web/package.json`、移动 `web/package-lock.json`、移除生成目录 `web/node_modules`，并执行 `npm install`。
- Electron 与 Electron Forge 依赖使用本计划锁定的精确版本，Forge Vite Plugin 不使用浮动版本。
- 只支持单窗口、单文章库；关闭窗口后进程退出，不驻留托盘。
- 文章库支持任意目录深度，只显示普通 `.md` 文件，不扫描或访问符号链接。
- Renderer 保持 `nodeIntegration: false`、`contextIsolation: true`、`sandbox: true`，不直接暴露 `ipcRenderer`。
- 实施优先在 Windows 原生检出中完成并验证 Windows 应用。Linux 和 macOS 安装包分别在对应宿主系统的原生检出中构建，不引入 Wine、Mono 或交叉打包环境。
- 不配置自动更新、应用商店、代码签名、公证或 GitHub Actions 发布流程。

---

## File Map

**Create**

- `electron/shared/types.ts`：跨主进程、预加载和渲染进程共享的数据类型、IPC 通道和桌面 API。
- `electron/main/configStore.ts`：读取、修复和保存上次目录与最近 5 个目录。
- `electron/main/articleStore.ts`：文章库路径校验、递归目录树和文章文件操作。
- `electron/main/ipc.ts`：注册 IPC handler、转换错误并切换当前文章库。
- `electron/main/menu.ts`：文件菜单、最近目录菜单和打开目录事件。
- `electron/main/main.ts`：窗口、安全策略、启动恢复和关闭握手。
- `electron/preload/preload.ts`：通过 `contextBridge` 暴露 `window.md2wechat`。
- `electron/forge-env.d.ts`：Forge Vite Plugin 注入变量的类型声明。
- `web/src/desktop/api.ts`：Renderer 使用的桌面 API 入口。
- `web/src/app/WelcomeScreen.tsx`：首次启动、目录失效和最近目录界面。
- `forge.config.ts`：打包配置和平台 maker。
- `vite.main.config.ts`：主进程 Vite 配置。
- `vite.preload.config.ts`：预加载脚本 Vite 配置。
- `scripts/build-icons.mjs`：从现有 SVG 生成平台图标。
- `build/icons/`：生成后的 PNG、ICO 和 ICNS 图标。

**Move after explicit approval**

- `web/package.json` → `package.json`
- `web/package-lock.json` → `package-lock.json`

**Modify**

- `web/src/app/App.tsx`：用桌面 API 替换 HTTP，接入文章库启动、切换和关闭流程，移除两层目录限制。
- `web/src/app/styles.css`：欢迎页、目录按钮、关闭失败弹窗和任意层级缩进。
- `web/src/vite-env.d.ts`：声明 `window.md2wechat`。
- `web/vite.config.ts`：移除 `/api` 代理，保留 React 和 Vitest 配置。
- `web/tsconfig.app.json`：包含共享 Electron 类型。
- `web/tsconfig.node.json`：包含 Forge、主进程和预加载配置。
- `web/eslint.config.js`：分别声明 browser 与 Node/Electron 全局环境。
- `web/index.html`：增加适合本地应用和 Vite HMR 的 CSP。
- `.gitignore`：忽略 `.vite/`、`out/` 和 Forge 产物，保留 `build/icons/`。
- `Makefile`：默认开发、构建和发布命令切换到 Electron，旧 Go 专用目标继续保留。
- `README.md`：改写为桌面端安装、运行、目录和打包说明。

---

### Task 1: Establish the Electron build foundation

**Files:**

- Move: `web/package.json` → `package.json`
- Move: `web/package-lock.json` → `package-lock.json`
- Create: `forge.config.ts`
- Create: `vite.main.config.ts`
- Create: `vite.preload.config.ts`
- Create: `electron/forge-env.d.ts`
- Create: `electron/main/main.ts`
- Create: `electron/preload/preload.ts`
- Modify: `web/vite.config.ts`
- Modify: `web/tsconfig.app.json`
- Modify: `web/tsconfig.node.json`
- Modify: `web/eslint.config.js`
- Modify: `.gitignore`

**Interfaces:**

- Produces: `npm run start`, `npm run package`, `npm run make`, `npm run typecheck`, `npm run lint`, `npm test`。
- Produces: Forge renderer 名称 `main_window`，后续主进程使用 `MAIN_WINDOW_VITE_DEV_SERVER_URL` 和 `MAIN_WINDOW_VITE_NAME`。

- [ ] **Step 1: Obtain the repository-required approval**

在执行任何写操作前，明确请求并获得以下授权：移动两个 package 文件、删除生成目录 `web/node_modules`、运行 `npm install`。如果任一项未获批准，停止 Task 1，不换用其他包管理器或隐式下载方式。

- [ ] **Step 2: Move the package files and remove only the approved generated directory**

Run from the repository root in Windows PowerShell:

```powershell
Move-Item -LiteralPath 'web\package.json' -Destination 'package.json'
Move-Item -LiteralPath 'web\package-lock.json' -Destination 'package-lock.json'
if (Test-Path -LiteralPath 'web\node_modules') {
  Remove-Item -Recurse -Force -LiteralPath 'web\node_modules'
}
```

Expected: 根目录出现 `package.json` 和 `package-lock.json`，`web/node_modules` 不再影响从根目录解析依赖。

- [ ] **Step 3: Install the exact desktop build dependencies**

Run:

```bash
npm install --save-exact electron-squirrel-startup@1.0.1
npm install --save-dev --save-exact electron@43.1.0 @electron-forge/cli@7.11.2 @electron-forge/shared-types@7.11.2 @electron-forge/plugin-vite@7.11.2 @electron-forge/maker-squirrel@7.11.2 @electron-forge/maker-dmg@7.11.2 @electron-forge/maker-deb@7.11.2 electron-icon-builder@2.0.1 sharp@0.35.3
```

Expected: 根目录 `node_modules/` 创建成功，锁文件只解析上述精确 Electron/Forge 版本。

- [ ] **Step 4: Replace the root package metadata and scripts**

Keep the existing React, Markdown, lint and test dependencies, and set these fields exactly:

```json
{
  "name": "md2wechat",
  "productName": "md2wechat",
  "version": "0.0.0",
  "description": "面向微信公众号写作的 Markdown 桌面排版工具",
  "author": "md2wechat",
  "private": true,
  "type": "module",
  "main": ".vite/build/main.js",
  "packageManager": "npm@10.9.2",
  "engines": { "node": ">=22.14.0" },
  "scripts": {
    "start": "electron-forge start",
    "dev": "electron-forge start",
    "package": "electron-forge package",
    "make": "electron-forge make",
    "typecheck": "tsc -b web/tsconfig.json",
    "lint": "eslint --config web/eslint.config.js .",
    "test": "vitest run --config web/vite.config.ts",
    "icons": "node scripts/build-icons.mjs"
  }
}
```

Expected: 不再存在 `npm --prefix web` 脚本，现有依赖版本保持不变。

- [ ] **Step 5: Configure Forge and Vite**

Create `forge.config.ts` with `asar: true`, the Vite plugin build entries below, and maker platform filters:

```ts
plugins: [
  {
    name: '@electron-forge/plugin-vite',
    config: {
      build: [
        { entry: 'electron/main/main.ts', config: 'vite.main.config.ts' },
        { entry: 'electron/preload/preload.ts', config: 'vite.preload.config.ts' },
      ],
      renderer: [{ name: 'main_window', config: 'web/vite.config.ts' }],
      concurrent: 2,
    },
  },
],
makers: [
  { name: '@electron-forge/maker-squirrel', platforms: ['win32'], config: {} },
  { name: '@electron-forge/maker-dmg', platforms: ['darwin'], config: {} },
  { name: '@electron-forge/maker-deb', platforms: ['linux'], config: {} },
],
```

Set both main/preload Vite configs to `build: { sourcemap: true }`. In `web/vite.config.ts`, remove the `/api` proxy and set `root` to the `web` directory using `fileURLToPath(new URL('.', import.meta.url))` so Forge resolves `web/index.html` from the repository root.

- [ ] **Step 6: Add a minimal secure desktop window**

Create a main entry that uses the Forge globals and these window preferences:

```ts
const mainWindow = new BrowserWindow({
  width: 1440,
  height: 900,
  minWidth: 1080,
  minHeight: 680,
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
  },
})

if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
  await mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
} else {
  await mainWindow.loadFile(
    path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
  )
}
```

The temporary preload entry contains only `export {}`. Add the two Forge globals to `electron/forge-env.d.ts` and include `electron/**/*.ts`, `forge.config.ts`, `vite.main.config.ts`, and `vite.preload.config.ts` in the Node TypeScript project.

- [ ] **Step 7: Verify the build foundation**

Run:

```bash
npm run typecheck
npm run lint
npm test
npm run package
```

Expected: all commands exit 0; `npm test` reports the existing Markdown renderer tests passing; `.vite/` and `out/` contain generated desktop build files.

Run `npm run start` with a 60-second observation window. Expected: one Electron window opens with the existing React UI, and closing the window ends the Electron process. The article requests may fail until Task 4 and are not accepted as a regression in this foundation task.

- [ ] **Step 8: Commit the foundation**

```bash
git add package.json package-lock.json forge.config.ts vite.main.config.ts vite.preload.config.ts electron/forge-env.d.ts electron/main/main.ts electron/preload/preload.ts web/vite.config.ts web/tsconfig.app.json web/tsconfig.node.json web/eslint.config.js .gitignore
git commit -m "chore(app): add Electron build foundation"
```

---

### Task 2: Define desktop contracts and persistent app configuration

**Files:**

- Create: `electron/shared/types.ts`
- Create: `electron/main/configStore.ts`
- Modify: `web/src/vite-env.d.ts`

**Interfaces:**

- Produces: `ArticleNode`, `DirectoryNode`, `ArticleTree`, `DesktopError`, `DesktopResult<T>`, `BootstrapState`, `LibraryOpenResult`, `CloseResolution`, `Md2WechatDesktopApi`, `IPC_CHANNELS`。
- Produces: `ConfigStore.load()`, `ConfigStore.getState()`, `ConfigStore.setActiveRoot(rootPath)`, `ConfigStore.removeRecentRoot(rootPath)`。

- [ ] **Step 1: Define the shared data contract**

Create exact discriminated unions and method signatures:

```ts
export type ArticleNode = {
  type: 'article'
  name: string
  path: string
  updatedAt: string
}

export type DirectoryNode = {
  type: 'directory'
  name: string
  path: string
  depth: number
  children: TreeNode[]
}

export type TreeNode = ArticleNode | DirectoryNode
export type ArticleTree = {
  type: 'root'
  name: '文章库'
  path: ''
  children: TreeNode[]
}

export type DesktopError = { code: string; message: string }
export type DesktopResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: DesktopError }

export type LibraryOpenResult = {
  rootPath: string
  recentRoots: string[]
  tree: ArticleTree
}

export type BootstrapState = {
  rootPath: string | null
  recentRoots: string[]
  tree: ArticleTree | null
  error: DesktopError | null
}

export type CloseResolution = 'saved' | 'continue-editing' | 'discard'

export type ArticleContent = { path: string; content: string }
export type ArticleStatus = { path: string; updatedAt: string }
export type ArticleSaveResult = ArticleStatus
export type DirectoryRenameResult = {
  oldPath: string
  path: string
  name: string
}
export type ArticleRenameResult = DirectoryRenameResult & {
  updatedAt: string
}
export type DeleteResult = { path: string }
```

Define `IPC_CHANNELS` for every spec API plus `app:open-library-requested`. `Md2WechatDesktopApi` must expose `app.getBootstrapState`, `app.onBeforeClose`, `app.onOpenLibraryRequested`, `app.resolveClose`, `library.choose`, `library.open`, `library.getTree`, all three directory methods, and all six article methods. Event subscriptions return an unsubscribe function and never expose Electron event objects.

- [ ] **Step 2: Implement the JSON config store**

Use this persisted shape and normalization rule:

```ts
type AppConfig = {
  lastRoot: string | null
  recentRoots: string[]
}

const emptyConfig: AppConfig = { lastRoot: null, recentRoots: [] }
const recentRootLimit = 5
```

`ConfigStore.load()` reads `<userData>/config.json`, accepts only string paths, removes duplicates, truncates to 5, and falls back to `emptyConfig` on `ENOENT`, invalid JSON, or wrong field types. `setActiveRoot()` moves the path to the front and persists immediately. `removeRecentRoot()` removes the path, clears `lastRoot` if it matches, and persists. Use `writeFile(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8')`; do not add a storage dependency.

- [ ] **Step 3: Declare the renderer global**

In `web/src/vite-env.d.ts` import `Md2WechatDesktopApi` as a type and extend `Window`:

```ts
interface Window {
  md2wechat: Md2WechatDesktopApi
}
```

- [ ] **Step 4: Verify and commit**

Run `npm run typecheck` and `npm run lint`. Expected: both exit 0.

```bash
git add electron/shared/types.ts electron/main/configStore.ts web/src/vite-env.d.ts
git commit -m "feat(app): add desktop app contracts"
```

---

### Task 3: Implement the secure TypeScript article store

**Files:**

- Create: `electron/main/articleStore.ts`
- Reference: `internal/articles/store.go`

**Interfaces:**

- Produces: `ArticleStore.open(rootPath: string): Promise<ArticleStore>`。
- Produces: `getTree`, `createDirectory`, `renameDirectory`, `deleteDirectory`, `createArticle`, `readArticle`, `getArticleStatus`, `saveArticle`, `renameArticle`, `deleteArticle` with the shared contract types.
- Produces: `AppError` with stable `code` and Chinese `message` fields.

- [ ] **Step 1: Add explicit error and name validation**

Use `AppError` codes `INVALID_PATH`, `NOT_FOUND`, `CONFLICT`, `PERMISSION_DENIED`, and `IO_ERROR`. Preserve these messages exactly where applicable:

```text
目录路径不合法
文章路径不合法
文章路径必须指向 .md 文件
目录名不能为空
文章名不能为空
目录名不能超过 80 个字符
文章名不能超过 80 个字符
同名目录已存在
同名文章已存在
目录不存在
文章不存在
目标路径不是目录
目标路径不是文章文件
不能重命名文章库根目录
不能删除文章库根目录
目录下还有文章
目录下还有非文章文件
```

`validateName()` trims the value, rejects `.`, `..`, `/`, `\`, NUL, CR and LF, and counts Unicode code points with `[...name].length <= 80`. `normalizeArticleFileName()` removes one trailing `.md`, trims again, validates the base name, and adds `.md`.

- [ ] **Step 2: Implement root-bounded path resolution**

Implement one resolver used by every operation:

```ts
private async resolvePath(
  relativePath: string,
  kind: 'directory' | 'article',
  allowMissingLeaf = false,
): Promise<{ absolutePath: string; relativePath: string; depth: number }>
```

It must reject backslashes, absolute paths, NUL, empty segments, `.` and `..`; require `.md` for articles; call `path.resolve(this.rootPath, ...segments)`; verify `path.relative(this.rootPath, target)` is neither absolute nor prefixed by `..`; use `lstat` on every existing segment and reject symbolic links. With `allowMissingLeaf`, only the final segment may be absent and its parent must be a real directory inside the root.

- [ ] **Step 3: Implement arbitrary-depth tree reading**

Use `readdir(directory, { withFileTypes: true })`. Recurse only when `entry.isDirectory()` is true, include only `entry.isFile()` names ending in `.md`, ignore symbolic links and all other entries, and sort directories before articles with `name.localeCompare(other.name, 'zh-CN')`. Directory `depth` equals the number of relative path segments; there is no maximum.

- [ ] **Step 4: Implement all mutations with existing semantics**

- `createDirectory`: validate parent and name, use `mkdir` without `recursive`, return a directory node with empty children.
- `createArticle`: validate directory and name, use `writeFile(..., { flag: 'wx' })`, return `updatedAt` from `stat.mtime.toISOString()`.
- `renameDirectory` and `renameArticle`: validate source and destination, return unchanged metadata when the normalized path is unchanged, reject an existing destination, then call `rename`.
- `saveArticle`: require string content, write UTF-8, return the new modification time.
- `readArticle` and `getArticleStatus`: reject missing or non-regular files.
- `deleteArticle`: call `unlink` only after validation.
- `deleteDirectory`: recursively inspect first; reject any regular `.md` file as “目录下还有文章” and any other entry as “目录下还有非文章文件”; after the check call `rm(path, { recursive: true })`.

Map `ENOENT`, `EEXIST`, `EACCES` and `EPERM` into the stable application errors. Other failures use `IO_ERROR` and the user-facing message `文件操作失败` while retaining the original error as `cause` for main-process logging.

- [ ] **Step 5: Verify and commit**

Run `npm run typecheck` and `npm run lint`. Expected: both exit 0.

```bash
git add electron/main/articleStore.ts
git commit -m "feat(app): add desktop article storage"
```

---

### Task 4: Wire IPC, preload, menus, startup restoration, and close lifecycle

**Files:**

- Create: `electron/main/ipc.ts`
- Create: `electron/main/menu.ts`
- Modify: `electron/main/main.ts`
- Modify: `electron/preload/preload.ts`
- Modify: `web/index.html`

**Interfaces:**

- Consumes: all shared contracts, `ConfigStore`, `ArticleStore`.
- Produces: fully functional `window.md2wechat` bridge.
- Produces: renderer events `app:before-close` and `app:open-library-requested`.

- [ ] **Step 1: Register narrow IPC handlers**

Create `registerIpcHandlers({ configStore, getWindow, onLibraryChanged })`. Maintain one `ArticleStore | null` inside the main-process composition root. `app.getBootstrapState` restores `lastRoot`; if opening it fails, remove it from recent roots and return `rootPath: null`, `tree: null`, and the converted error.

`library.choose` uses `dialog.showOpenDialog({ properties: ['openDirectory'] })`; cancellation returns `null`. `library.open` accepts only a path already present in `ConfigStore.getState().recentRoots`. Both successful open paths replace the current store, persist the active root, rebuild the native menu, and return `LibraryOpenResult`.

When a recent path fails with `NOT_FOUND` or `PERMISSION_DENIED`, remove it from `ConfigStore`, rebuild the menu, then return the original error so the renderer can keep the welcome page visible.

Wrap every invoke result with:

```ts
async function toResult<T>(operation: () => Promise<T>): Promise<DesktopResult<T>> {
  try {
    return { ok: true, value: await operation() }
  } catch (error) {
    return { ok: false, error: toDesktopError(error) }
  }
}
```

Validate `event.sender === getWindow()?.webContents` before running a handler. Register each channel once and remove handlers during shutdown.

- [ ] **Step 2: Expose the typed preload API**

The preload `invoke` helper unwraps `DesktopResult<T>` and throws `Error(result.error.message)` on failure. Expose one function per `Md2WechatDesktopApi` member. Event wrappers must discard Electron event objects:

```ts
onBeforeClose(callback) {
  const listener = () => callback()
  ipcRenderer.on(IPC_CHANNELS.appBeforeClose, listener)
  return () => ipcRenderer.removeListener(IPC_CHANNELS.appBeforeClose, listener)
}
```

Use the same pattern for `onOpenLibraryRequested`, passing only `string | null`.

- [ ] **Step 3: Add the native File menu**

Create a Chinese File menu with:

- “打开文件夹…” and accelerator `CmdOrCtrl+O`.
- “打开最近使用的目录” submenu, disabled when empty, with one item per recent path.
- Separator and “退出”, which calls `mainWindow.close()` so the save handshake always runs.

Menu items send `app:open-library-requested` with `null` for the chooser or an existing recent root path. Rebuild the menu after every successful open and after removal of an invalid recent path.

- [ ] **Step 4: Complete the secure window lifecycle**

Handle Squirrel startup before creating a window. Enforce one application instance with `app.requestSingleInstanceLock()`; a second launch focuses the existing window. Deny all new windows with `setWindowOpenHandler(() => ({ action: 'deny' }))`, prevent navigation away from the current renderer URL, deny permission requests, and do not call `shell.openExternal`.

Implement close state as `let allowClose = false`. On the first `close`, call `event.preventDefault()` and send `app:before-close`. `app.resolveClose('saved' | 'discard')` sets `allowClose = true` and closes again. `continue-editing` leaves the window open. `window-all-closed` always calls `app.quit()`, including macOS.

- [ ] **Step 5: Add the Content Security Policy**

Add this CSP to `web/index.html`:

```html
<meta
  http-equiv="Content-Security-Policy"
  content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' ws:; object-src 'none'; base-uri 'none'; form-action 'none'"
/>
```

- [ ] **Step 6: Verify and commit**

Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run package`. Expected: all exit 0.

Run `npm run start`. Expected: one window, Chinese File menu, no external navigation, and the main process logs no unhandled IPC errors.

```bash
git add electron/main/ipc.ts electron/main/menu.ts electron/main/main.ts electron/preload/preload.ts web/index.html
git commit -m "feat(app): expose secure desktop APIs"
```

---

### Task 5: Migrate the existing workspace from HTTP to desktop APIs

**Files:**

- Create: `web/src/desktop/api.ts`
- Modify: `web/src/app/App.tsx:20-118`
- Modify: `web/src/app/App.tsx:180-455`
- Modify: `web/src/app/App.tsx:743-1000`
- Modify: `web/src/app/App.tsx:1123-1232`
- Modify: `web/src/app/App.tsx:1623-1647`
- Modify: `web/src/app/App.tsx:1785-1819`
- Modify: `web/src/app/styles.css:387-604`

**Interfaces:**

- Consumes: `window.md2wechat` and all shared node types.
- Produces: `desktopApi` singleton and a workspace with no `fetch('/api/...')` calls.

- [ ] **Step 1: Add the renderer API adapter**

`web/src/desktop/api.ts` must fail clearly outside Electron:

```ts
if (!window.md2wechat) {
  throw new Error('桌面 API 不可用')
}

export const desktopApi = window.md2wechat
```

- [ ] **Step 2: Move shared node types out of App.tsx**

Import `ArticleNode`, `ArticleTree`, `DirectoryNode`, `TreeNode`, `LibraryOpenResult` and response types from `electron/shared/types.ts`. Remove the duplicate local declarations and delete `maxDirectoryDepth`.

- [ ] **Step 3: Replace every HTTP operation explicitly**

Apply this mapping throughout `App.tsx`:

| Existing request | Desktop call |
| --- | --- |
| GET article tree | `desktopApi.library.getTree()` |
| GET article content | `desktopApi.articles.read(path)` |
| PUT article content | `desktopApi.articles.save(path, content)` |
| GET article status | `desktopApi.articles.getStatus(path)` |
| POST directory | `desktopApi.directories.create(parentPath, name)` |
| PATCH directory | `desktopApi.directories.rename(path, name)` |
| DELETE directory | `desktopApi.directories.delete(path)` |
| POST article | `desktopApi.articles.create(directoryPath, name, content)` |
| PATCH article | `desktopApi.articles.rename(path, name)` |
| DELETE article | `desktopApi.articles.delete(path)` |

Delete `requestJson` after `rg -n "requestJson|/api/|fetch\(" web/src` returns no matches.

- [ ] **Step 4: Scope the last selected article by article root**

Replace the fixed storage key with:

```ts
function getLastArticleStorageKey(rootPath: string) {
  return `md2wechat:lastArticlePath:${encodeURIComponent(rootPath)}`
}
```

Pass `rootPath` to read, write and clear helpers. On bootstrap, load only the selected root's stored article and expand all parent directory paths.

- [ ] **Step 5: Replace the boot request with desktop bootstrap**

Add `rootPath`, `recentRoots`, `bootstrapError`, and `isBootstrapping` state in `App.tsx`. Replace the old GET-tree boot effect with `desktopApi.app.getBootstrapState()`. Store its root, recent paths, tree and error; only restore an article when both `rootPath` and `tree` are non-null. When no root is active, render a temporary neutral loading/empty state until Task 6 adds the welcome page.

- [ ] **Step 6: Remove the depth limit from the tree UI**

Always allow directory creation from a directory action menu. Replace `.depth-2` with indentation derived from the node depth:

```tsx
<li
  className="tree-item"
  key={node.path}
  style={{ '--tree-depth': node.depth } as CSSProperties}
>
```

Use `padding-inline-start: calc(var(--tree-depth, 0) * 0.75rem)` in CSS so every depth is readable without generating class names.

- [ ] **Step 7: Verify and commit**

Run:

```bash
rg -n "requestJson|/api/|fetch\(|maxDirectoryDepth|depth-2" web/src
npm run typecheck
npm run lint
npm test
```

Expected: `rg` prints no matches and exits 1; all npm checks exit 0.

```bash
git add web/src/desktop/api.ts web/src/app/App.tsx web/src/app/styles.css
git commit -m "feat(app): migrate workspace to desktop APIs"
```

---

### Task 6: Add folder workspace UX and save-safe switching and closing

**Files:**

- Create: `web/src/app/WelcomeScreen.tsx`
- Modify: `web/src/app/App.tsx`
- Modify: `web/src/app/styles.css`

**Interfaces:**

- Consumes: `BootstrapState`, `LibraryOpenResult`, open-library events and close events.
- Produces: first-run welcome page, recent directory selection, safe folder switching and close-failure decision UI.

- [ ] **Step 1: Bootstrap the active article library**

Use the `rootPath`, `recentRoots`, `bootstrapError`, and `isBootstrapping` state added in Task 5. When `rootPath` is null, show the welcome page instead of the editor workspace; do not issue a second bootstrap call.

- [ ] **Step 2: Build the welcome page**

`WelcomeScreen` receives:

```ts
type WelcomeScreenProps = {
  recentRoots: string[]
  errorMessage: string | null
  isOpening: boolean
  onChooseDirectory: () => void
  onOpenRecent: (rootPath: string) => void
}
```

Render the existing “文” mark, product name, one primary “打开文件夹” button, the exact failure message when present, and up to five recent absolute paths. Do not add onboarding, templates, drag-and-drop or multi-window controls.

- [ ] **Step 3: Implement one safe library switching function**

Create `openLibrary(request: { type: 'choose' } | { type: 'recent'; rootPath: string })`. It calls `saveCurrentArticle()` first; on failure it returns without changing state. It then calls `library.choose()` or `library.open(rootPath)`, ignores chooser cancellation, clears editor/transient modal state, updates `rootPath`, `recentRoots` and `tree`, and restores the new root's last article if it still exists.

Subscribe to `app.onOpenLibraryRequested` and route menu events through the same function. Unsubscribe on unmount.

- [ ] **Step 4: Implement the close save handshake**

Subscribe to `app.onBeforeClose`. Call `saveCurrentArticle()` once. On success call `app.resolveClose('saved')`. On failure open a renderer modal with exactly two actions:

- “继续编辑” closes the modal and calls `app.resolveClose('continue-editing')`.
- “放弃修改并退出” calls `app.resolveClose('discard')`.

Disable repeated close attempts while a save is in progress. Keep the unsaved Markdown in React state until the user chooses discard.

- [ ] **Step 5: Handle invalid and disappearing paths**

- Bootstrap failure: show the welcome page with the returned message.
- Invalid recent path: remove it from the local recent list after `library.open` fails and keep the welcome page usable.
- Selected file disappears during read/status: refresh the tree, clear the current article if it no longer exists, and show `文章不存在`.
- Folder switch save failure: keep the old root and workspace untouched.

- [ ] **Step 6: Verify the desktop workflow manually**

Run `npm run start` and check:

1. First launch shows the welcome page.
2. Choosing a folder loads arbitrary nested directories and only `.md` files.
3. Restart restores the folder and its last selected article.
4. `CmdOrCtrl+O` saves before switching folders.
5. An invalid recent folder returns to a usable welcome page.
6. Editing saves after 900 ms; external modification still reloads or shows the conflict banner.
7. A forced save failure blocks switching.
8. Closing after a forced save failure offers continue or discard.
9. Normal close ends the Electron process.

Then run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run package`. Expected: all exit 0.

- [ ] **Step 7: Commit the completed desktop workflow**

```bash
git add web/src/app/WelcomeScreen.tsx web/src/app/App.tsx web/src/app/styles.css
git commit -m "feat(app): add folder workspace flow"
```

---

### Task 7: Add platform packaging assets, command routing, and documentation

**Files:**

- Create: `scripts/build-icons.mjs`
- Create: `build/icons/icon.png`
- Create: `build/icons/icon.ico`
- Create: `build/icons/icon.icns`
- Modify: `forge.config.ts`
- Modify: `Makefile`
- Modify: `README.md`
- Modify: `.gitignore`

**Interfaces:**

- Produces: `make dev`, `make build`, `make release`, host-native installer output under `out/make/`.

- [ ] **Step 1: Generate platform icons from the existing logo**

Use `sharp` to rasterize `web/public/favicon.svg` to a transparent 1024×1024 `build/icon-source.png`, then invoke `electron-icon-builder --input=<absolute source> --output=build --flatten`. Rename/copy its generated files to the stable paths `build/icons/icon.png`, `build/icons/icon.ico`, and `build/icons/icon.icns`. The script must create directories with `mkdir({ recursive: true })` and fail if any final icon is missing.

Run `npm run icons`. Expected: all three final icon files exist and are non-empty. Commit generated icon assets so end users do not need the icon tools to package an unchanged checkout.

- [ ] **Step 2: Finish Forge maker metadata**

Set `packagerConfig.asar = true`, `packagerConfig.icon = 'build/icons/icon'`, and `packagerConfig.executableName = 'md2wechat'`. Configure:

- Squirrel Windows with `name: 'md2wechat'`, `authors: 'md2wechat'`, `description` from package metadata, and `setupIcon: 'build/icons/icon.ico'`.
- DMG with `icon: 'build/icons/icon.icns'`.
- Debian with `options.icon: 'build/icons/icon.png'`, `maintainer: 'md2wechat'`, `homepage: 'https://github.com/bobbyz3g/md2wechat'`, and `categories: ['Utility']`.

Do not add signing environment variables, publisher credentials or update feeds.

- [ ] **Step 3: Route the default Make targets to Electron**

Change only the primary targets:

```make
dev:
	npm run start

build:
	npm run package

release:
	npm run make

test:
	npm test

lint:
	npm run typecheck
	npm run lint
```

Keep the existing Go-specific source targets available for rollback until the separate cleanup approval.

- [ ] **Step 4: Rewrite README for the desktop workflow**

Document Node/npm prerequisites, the explicit `npm install` step, `make dev`, opening a folder, automatic restoration, arbitrary directory depth, auto-save, external change conflicts, `make build`, and host-native `make release`. State that WSL produces Linux artifacts, Windows artifacts require a Windows-native checkout, and DMG requires macOS. Remove browser URLs and Go service flags from the primary usage path, but add one short “旧实现回滚” note pointing to the retained Go source.

- [ ] **Step 5: Run the full verification gate**

Before `npm run make` on Linux, run `command -v dpkg-deb` and `command -v fakeroot`. Expected: both print an executable path. If either is missing, stop and request permission before installing system packages; do not silently switch maker or run `apt install`.

Run fresh:

```bash
npm run typecheck
npm run lint
npm test
npm run package
npm run make
git diff --check
```

Expected: every command exits 0; existing Vitest tests pass; the host-native packaged app exists under `out/`; the host-native maker artifact exists under `out/make/`; `git diff --check` prints nothing.

Inspect `git status --short` and stage only files from this migration. Confirm Go source files are neither modified nor deleted. Launch the packaged app, open a real Markdown directory, copy rich text into the WeChat editor, and close the app. Expected: preview formatting survives the copy, the article is saved, and the process exits.

- [ ] **Step 6: Commit documentation and packaging**

```bash
git add scripts/build-icons.mjs build/icons forge.config.ts Makefile README.md .gitignore package.json package-lock.json
git commit -m "chore(app): package Electron desktop app"
```

---

## Release Follow-through

After the implementation commits pass local review:

1. Run `/check` before merging or publishing.
2. Build and launch Squirrel.Windows from a Windows-native checkout.
3. Build and launch the DMG from macOS.
4. Build and launch the Debian package from Linux.
5. Compare Markdown preview and rich-text clipboard output on all three systems.
6. Only after Electron acceptance, ask separately whether to remove Go source, `scripts/dev.mjs`, `tools/release`, old Make targets and Go documentation.

Rollback requires no data migration: stop using the Electron build and run the retained Go version against the same Markdown directory.
