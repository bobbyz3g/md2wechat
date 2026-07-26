type WelcomeScreenProps = {
  recentRoots: string[]
  errorMessage: string | null
  isOpening: boolean
  onChooseDirectory: () => void
  onOpenRecent: (rootPath: string) => void
}

export function WelcomeScreen({
  recentRoots,
  errorMessage,
  isOpening,
  onChooseDirectory,
  onOpenRecent,
}: WelcomeScreenProps) {
  return (
    <main className="welcome-screen">
      <section className="welcome-intro" aria-labelledby="welcome-title">
        <div className="welcome-brand">
          <span className="brand-mark welcome-mark" aria-hidden="true">
            文
          </span>
          <span>md2wechat</span>
        </div>
        <div className="welcome-heading">
          <p>本地 Markdown 写作空间</p>
          <h1 id="welcome-title">写好文章，再交给排版。</h1>
          <span>文章保存在你的电脑里，打开一个文件夹即可继续写作。</span>
        </div>
        <button
          className="welcome-open-button"
          type="button"
          disabled={isOpening}
          onClick={onChooseDirectory}
        >
          <span className="welcome-open-icon" aria-hidden="true">
            ↗
          </span>
          {isOpening ? '正在打开' : '打开文章库'}
        </button>
        {errorMessage ? (
          <div className="welcome-error" role="alert">
            {errorMessage}
          </div>
        ) : null}
      </section>

      <section className="welcome-library" aria-label="最近使用的文章库">
        <div className="welcome-library-heading">
          <span>最近使用</span>
          <span>{recentRoots.length > 0 ? `${recentRoots.length} 个文章库` : '暂无记录'}</span>
        </div>
        {recentRoots.length > 0 ? (
          <div className="welcome-recents">
            {recentRoots.slice(0, 5).map((rootPath) => (
              <button
                className="welcome-recent-button"
                type="button"
                disabled={isOpening}
                key={rootPath}
                onClick={() => onOpenRecent(rootPath)}
              >
                <span className="welcome-folder-icon" aria-hidden="true" />
                <span className="welcome-recent-copy">
                  <strong>{getDirectoryName(rootPath)}</strong>
                  <span>{rootPath}</span>
                </span>
                <span className="welcome-recent-arrow" aria-hidden="true">
                  →
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="welcome-empty">
            <span className="welcome-empty-line" aria-hidden="true" />
            <p>打开文章库后，它会出现在这里。</p>
          </div>
        )}
      </section>
    </main>
  )
}

function getDirectoryName(rootPath: string) {
  const segments = rootPath.split(/[\\/]/).filter(Boolean)
  return segments.at(-1) ?? rootPath
}
