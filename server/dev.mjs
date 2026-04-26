import { spawn } from 'node:child_process'
import path from 'node:path'

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const nodeBinDir = path.dirname(process.execPath)
const childEnv = {
  ...process.env,
  PATH: `${nodeBinDir}${path.delimiter}${process.env.PATH ?? ''}`,
}
const children = [
  spawn(npmCommand, ['run', 'dev:api'], { env: childEnv, stdio: 'inherit' }),
  spawn(npmCommand, ['run', 'dev:web'], { env: childEnv, stdio: 'inherit' }),
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
