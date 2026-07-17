import { spawn } from 'node:child_process'
import { copyFile, mkdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
const buildDirectory = path.join(projectRoot, 'build')
const iconsDirectory = path.join(buildDirectory, 'icons')
const sourceSvgPath = path.join(projectRoot, 'web', 'public', 'favicon.svg')
const sourcePngPath = path.join(buildDirectory, 'icon-source.png')
const builderExecutable = path.join(
  projectRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32'
    ? 'electron-icon-builder.cmd'
    : 'electron-icon-builder',
)

await mkdir(iconsDirectory, { recursive: true })
await sharp(sourceSvgPath)
  .resize(1024, 1024, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toFile(sourcePngPath)

await run(builderExecutable, [
  `--input=${sourcePngPath}`,
  `--output=${buildDirectory}`,
  '--flatten',
])

const iconPaths = {
  png: path.join(iconsDirectory, 'icon.png'),
  ico: path.join(iconsDirectory, 'icon.ico'),
  icns: path.join(iconsDirectory, 'icon.icns'),
}

await copyFile(path.join(iconsDirectory, '1024x1024.png'), iconPaths.png)

for (const iconPath of Object.values(iconPaths)) {
  const iconStat = await stat(iconPath)
  if (!iconStat.isFile() || iconStat.size === 0) {
    throw new Error(`图标生成失败：${iconPath}`)
  }
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      shell: process.platform === 'win32',
      stdio: 'inherit',
    })

    child.once('error', reject)
    child.once('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`图标生成命令退出，状态码：${code ?? 'unknown'}`))
    })
  })
}
