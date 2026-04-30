import { spawn } from 'node:child_process'
import path from 'node:path'

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const goCommand = process.platform === 'win32' ? 'go.exe' : 'go'
const nodeBinDir = path.dirname(process.execPath)
const childEnv = {
  ...process.env,
  PATH: `${nodeBinDir}${path.delimiter}${process.env.PATH ?? ''}`,
}
const children = [
  spawn(
    goCommand,
    ['run', './cmd/md2wechat', '--no-open', '--article-root', 'articles'],
    { env: childEnv, stdio: 'inherit' },
  ),
  spawn(npmCommand, ['--prefix', 'web', 'run', 'dev'], {
    env: childEnv,
    stdio: 'inherit',
  }),
]
let stopping = false

for (const child of children) {
  child.on('exit', (code) => {
    if (!stopping) {
      stopAll(code ?? 1)
    }
  })
}

process.on('SIGINT', () => stopAll(0))
process.on('SIGTERM', () => stopAll(0))

function stopAll(exitCode) {
  stopping = true

  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGTERM')
    }
  }

  setTimeout(() => {
    process.exit(exitCode)
  }, 200)
}
