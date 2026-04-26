import { createServer } from 'node:http'

import {
  ArticleStoreError,
  articleRoot,
  createArticle,
  createDirectory,
  ensureDefaultLibrary,
  getArticleTree,
  readArticle,
  renameArticle,
  renameDirectory,
  saveArticle,
} from './articleStore.mjs'

const port = Number.parseInt(process.env.PORT ?? '4174', 10)

await ensureDefaultLibrary()

const server = createServer(async (request, response) => {
  try {
    if (request.method === 'OPTIONS') {
      response.writeHead(204)
      response.end()
      return
    }

    const url = new URL(
      request.url ?? '/',
      `http://${request.headers.host ?? '127.0.0.1'}`,
    )

    if (request.method === 'GET' && url.pathname === '/api/health') {
      sendJson(response, 200, {
        ok: true,
        articleRoot,
      })
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/articles/tree') {
      sendJson(response, 200, await getArticleTree())
      return
    }

    if (
      request.method === 'POST' &&
      url.pathname === '/api/articles/directories'
    ) {
      const body = await readJsonBody(request)
      const directory = await createDirectory(body.parentPath, body.name)

      sendJson(response, 201, directory)
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/articles') {
      const body = await readJsonBody(request)
      const content =
        typeof body.content === 'string' ? body.content : `# ${body.name}\n\n`
      const article = await createArticle(body.directoryPath, body.name, content)

      sendJson(response, 201, article)
      return
    }

    if (
      request.method === 'PATCH' &&
      url.pathname === '/api/articles/directories'
    ) {
      const body = await readJsonBody(request)
      const directory = await renameDirectory(body.path, body.name)

      sendJson(response, 200, directory)
      return
    }

    if (request.method === 'PATCH' && url.pathname === '/api/articles') {
      const body = await readJsonBody(request)
      const article = await renameArticle(body.path, body.name)

      sendJson(response, 200, article)
      return
    }

    if (
      request.method === 'GET' &&
      url.pathname === '/api/articles/content'
    ) {
      const articlePath = url.searchParams.get('path') ?? ''

      sendJson(response, 200, {
        path: articlePath,
        content: await readArticle(articlePath),
      })
      return
    }

    if (
      request.method === 'PUT' &&
      url.pathname === '/api/articles/content'
    ) {
      const body = await readJsonBody(request)
      const result = await saveArticle(body.path, body.content)

      sendJson(response, 200, result)
      return
    }

    sendJson(response, 404, {
      message: '接口不存在',
    })
  } catch (error) {
    handleError(response, error)
  }
})

server.listen(port, '127.0.0.1', () => {
  console.log(`md2wechat api listening on http://127.0.0.1:${port}`)
})

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
  })
  response.end(JSON.stringify(payload))
}

function handleError(response, error) {
  if (error instanceof ArticleStoreError) {
    sendJson(response, error.statusCode, {
      message: error.message,
    })
    return
  }

  console.error(error)
  sendJson(response, 500, {
    message: '服务端处理失败',
  })
}

async function readJsonBody(request) {
  let body = ''

  for await (const chunk of request) {
    body += chunk

    if (Buffer.byteLength(body) > 10 * 1024 * 1024) {
      throw new ArticleStoreError(413, '请求内容过大')
    }
  }

  if (!body.trim()) {
    return {}
  }

  try {
    return JSON.parse(body)
  } catch {
    throw new ArticleStoreError(400, '请求 JSON 格式不合法')
  }
}
