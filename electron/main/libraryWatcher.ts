import { watch, type FSWatcher } from 'node:fs'
import { lstat, readdir, realpath } from 'node:fs/promises'
import path from 'node:path'

import type {
  LibraryChange,
  LibraryChangeBatch,
  LibraryEntryType,
} from '../shared/types'

type SnapshotEntry = {
  type: LibraryEntryType
  revision: string | null
}

type LibrarySnapshot = Map<string, SnapshotEntry>

const reconcileDelay = 200
const initialRecoveryDelay = 500
const maximumRecoveryDelay = 5000

export class LibraryWatcher {
  private watcher: FSWatcher | null = null
  private reconcileTimer: NodeJS.Timeout | null = null
  private recoveryTimer: NodeJS.Timeout | null = null
  private recoveryDelay = initialRecoveryDelay
  private isReconciling = false
  private shouldReconcileAgain = false
  private isDisposed = false

  private constructor(
    readonly rootPath: string,
    private readonly generation: number,
    private snapshot: LibrarySnapshot | null,
    private readonly onDidChange: (batch: LibraryChangeBatch) => void,
  ) {}

  static async start(
    rootPath: string,
    generation: number,
    onDidChange: (batch: LibraryChangeBatch) => void,
  ) {
    const libraryWatcher = new LibraryWatcher(
      rootPath,
      generation,
      null,
      onDidChange,
    )

    try {
      libraryWatcher.snapshot = await createSnapshot(rootPath)
    } catch (error) {
      console.error('创建文章库监听快照失败', error)
      libraryWatcher.emitBatch([], true)
      libraryWatcher.scheduleRecovery()
    }

    try {
      libraryWatcher.startWatching()
      libraryWatcher.scheduleReconcile()
    } catch (error) {
      console.error('启动文章库文件监听失败', error)
      libraryWatcher.emitBatch([], true)
      libraryWatcher.scheduleRecovery()
    }
    return libraryWatcher
  }

  dispose() {
    this.isDisposed = true

    if (this.reconcileTimer) {
      clearTimeout(this.reconcileTimer)
      this.reconcileTimer = null
    }

    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer)
      this.recoveryTimer = null
    }

    this.watcher?.close()
    this.watcher = null
  }

  private startWatching() {
    const watcher = watch(
      this.rootPath,
      { recursive: true },
      () => this.scheduleReconcile(),
    )
    this.watcher = watcher
    watcher.on('error', (error) => this.handleWatcherError(error))
  }

  private handleWatcherError(error: Error) {
    if (this.isDisposed) {
      return
    }

    console.error('文章库监听失败', error)
    this.watcher?.close()
    this.watcher = null
    this.emitBatch([], true)
    this.scheduleRecovery()
  }

  private scheduleReconcile() {
    if (this.isDisposed || this.reconcileTimer) {
      return
    }

    this.reconcileTimer = setTimeout(() => {
      this.reconcileTimer = null
      void this.reconcile()
    }, reconcileDelay)
  }

  private async reconcile() {
    if (this.isDisposed) {
      return
    }

    if (this.isReconciling) {
      this.shouldReconcileAgain = true
      return
    }

    this.isReconciling = true

    try {
      do {
        this.shouldReconcileAgain = false

        try {
          const nextSnapshot = await createSnapshot(this.rootPath)
          if (this.isDisposed) {
            return
          }

          const changes = this.snapshot
            ? compareSnapshots(this.snapshot, nextSnapshot)
            : []
          this.snapshot = nextSnapshot

          if (!this.watcher) {
            this.startWatching()
          }

          this.markRecovered()

          if (changes.length > 0) {
            this.emitBatch(changes, false)
          }
        } catch (error) {
          if (!this.isDisposed) {
            console.error('刷新文章库监听快照失败', error)
            this.emitBatch([], true)
            this.scheduleRecovery()
          }
        }
      } while (this.shouldReconcileAgain && !this.isDisposed)
    } finally {
      this.isReconciling = false
    }
  }

  private scheduleRecovery() {
    if (this.isDisposed || this.recoveryTimer) {
      return
    }

    const delay = this.recoveryDelay
    this.recoveryDelay = Math.min(
      this.recoveryDelay * 2,
      maximumRecoveryDelay,
    )
    this.recoveryTimer = setTimeout(() => {
      this.recoveryTimer = null
      void this.reconcile()
    }, delay)
  }

  private markRecovered() {
    this.recoveryDelay = initialRecoveryDelay

    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer)
      this.recoveryTimer = null
    }
  }

  private emitBatch(changes: LibraryChange[], needsFullRefresh: boolean) {
    this.onDidChange({
      rootPath: this.rootPath,
      generation: this.generation,
      changes,
      needsFullRefresh,
    })
  }
}

async function createSnapshot(rootPath: string): Promise<LibrarySnapshot> {
  const rootStat = await lstat(rootPath)
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    throw new Error('文章库根目录不可用')
  }

  const rootRealPath = await realpath(rootPath)
  const snapshot: LibrarySnapshot = new Map()
  await scanDirectory(rootPath, rootRealPath, '', snapshot)
  return snapshot
}

async function scanDirectory(
  absolutePath: string,
  rootRealPath: string,
  relativePath: string,
  snapshot: LibrarySnapshot,
) {
  const directoryStat = await lstat(absolutePath)
  if (directoryStat.isSymbolicLink() || !directoryStat.isDirectory()) {
    return
  }

  const directoryRealPath = await realpath(absolutePath)
  if (!isPathInsideRoot(rootRealPath, directoryRealPath)) {
    return
  }

  const entries = await readdir(directoryRealPath, { withFileTypes: true })

  for (const entry of entries) {
    const childRelativePath = joinRelativePath(relativePath, entry.name)
    const childAbsolutePath = path.join(directoryRealPath, entry.name)

    if (entry.isDirectory()) {
      const childStat = await lstat(childAbsolutePath)
      if (childStat.isSymbolicLink() || !childStat.isDirectory()) {
        continue
      }

      snapshot.set(childRelativePath, {
        type: 'directory',
        revision: null,
      })
      await scanDirectory(
        childAbsolutePath,
        rootRealPath,
        childRelativePath,
        snapshot,
      )
      continue
    }

    if (!entry.isFile() || !entry.name.endsWith('.md')) {
      continue
    }

    const childStat = await lstat(childAbsolutePath)
    if (childStat.isSymbolicLink() || !childStat.isFile()) {
      continue
    }

    snapshot.set(childRelativePath, {
      type: 'article',
      revision: `${childStat.mtimeMs}:${childStat.size}`,
    })
  }
}

function isPathInsideRoot(rootPath: string, candidatePath: string) {
  const relativePath = path.relative(rootPath, candidatePath)
  return (
    relativePath === '' ||
    (!path.isAbsolute(relativePath) &&
      relativePath !== '..' &&
      !relativePath.startsWith(`..${path.sep}`))
  )
}

function compareSnapshots(
  previousSnapshot: LibrarySnapshot,
  nextSnapshot: LibrarySnapshot,
) {
  const changes: LibraryChange[] = []

  for (const [entryPath, previousEntry] of previousSnapshot) {
    const nextEntry = nextSnapshot.get(entryPath)

    if (!nextEntry) {
      changes.push({
        type: 'deleted',
        entryType: previousEntry.type,
        path: entryPath,
      })
      continue
    }

    if (nextEntry.type !== previousEntry.type) {
      changes.push({
        type: 'deleted',
        entryType: previousEntry.type,
        path: entryPath,
      })
      changes.push({
        type: 'created',
        entryType: nextEntry.type,
        path: entryPath,
      })
      continue
    }

    if (
      nextEntry.type === 'article' &&
      nextEntry.revision !== previousEntry.revision
    ) {
      changes.push({
        type: 'updated',
        entryType: 'article',
        path: entryPath,
      })
    }
  }

  for (const [entryPath, nextEntry] of nextSnapshot) {
    if (previousSnapshot.has(entryPath)) {
      continue
    }

    changes.push({
      type: 'created',
      entryType: nextEntry.type,
      path: entryPath,
    })
  }

  return changes.sort(compareChanges)
}

function compareChanges(left: LibraryChange, right: LibraryChange) {
  const pathComparison = left.path.localeCompare(right.path, 'zh-CN')
  if (pathComparison !== 0) {
    return pathComparison
  }
  return left.type.localeCompare(right.type)
}

function joinRelativePath(parentPath: string, childName: string) {
  return parentPath === '' ? childName : `${parentPath}/${childName}`
}
