import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

export type AppConfig = {
  lastRoot: string | null
  recentRoots: string[]
}

const emptyConfig: AppConfig = {
  lastRoot: null,
  recentRoots: [],
}

const recentRootLimit = 5

export class ConfigStore {
  private readonly configPath: string
  private config: AppConfig = { ...emptyConfig }

  constructor(userDataPath: string) {
    this.configPath = path.join(userDataPath, 'config.json')
  }

  async load(): Promise<AppConfig> {
    try {
      const content = await readFile(this.configPath, 'utf8')
      this.config = normalizeConfig(JSON.parse(content) as unknown)
    } catch (error) {
      if (!isFileSystemError(error, 'ENOENT') && !(error instanceof SyntaxError)) {
        throw error
      }
      this.config = { ...emptyConfig }
    }

    return this.getState()
  }

  getState(): AppConfig {
    return {
      lastRoot: this.config.lastRoot,
      recentRoots: [...this.config.recentRoots],
    }
  }

  async setActiveRoot(rootPath: string): Promise<void> {
    this.config = {
      lastRoot: rootPath,
      recentRoots: [
        rootPath,
        ...this.config.recentRoots.filter((recentRoot) => recentRoot !== rootPath),
      ].slice(0, recentRootLimit),
    }
    await this.persist()
  }

  async removeRecentRoot(rootPath: string): Promise<void> {
    this.config = {
      lastRoot: this.config.lastRoot === rootPath ? null : this.config.lastRoot,
      recentRoots: this.config.recentRoots.filter(
        (recentRoot) => recentRoot !== rootPath,
      ),
    }
    await this.persist()
  }

  private async persist(): Promise<void> {
    await writeFile(
      this.configPath,
      `${JSON.stringify(this.config, null, 2)}\n`,
      'utf8',
    )
  }
}

function normalizeConfig(value: unknown): AppConfig {
  if (!isRecord(value)) {
    return { ...emptyConfig }
  }

  if (
    value.lastRoot !== null &&
    typeof value.lastRoot !== 'string'
  ) {
    return { ...emptyConfig }
  }

  if (!Array.isArray(value.recentRoots)) {
    return { ...emptyConfig }
  }

  const recentRoots = [
    ...new Set(
      value.recentRoots.filter(
        (rootPath): rootPath is string => typeof rootPath === 'string',
      ),
    ),
  ].slice(0, recentRootLimit)

  return {
    lastRoot: value.lastRoot,
    recentRoots,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isFileSystemError(error: unknown, code: string) {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === code
  )
}
