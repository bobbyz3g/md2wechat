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
      <section className="welcome-card" aria-labelledby="welcome-title">
        <span className="brand-mark welcome-mark" aria-hidden="true">
          文
        </span>
        <h1 id="welcome-title">md2wechat</h1>
        <button
          className="welcome-open-button"
          type="button"
          disabled={isOpening}
          onClick={onChooseDirectory}
        >
          {isOpening ? '打开中' : '打开文件夹'}
        </button>
        {errorMessage ? (
          <div className="welcome-error" role="alert">
            {errorMessage}
          </div>
        ) : null}
        {recentRoots.length > 0 ? (
          <div className="welcome-recents">
            <div className="welcome-recents-title">最近使用的目录</div>
            {recentRoots.slice(0, 5).map((rootPath) => (
              <button
                className="welcome-recent-button"
                type="button"
                disabled={isOpening}
                key={rootPath}
                onClick={() => onOpenRecent(rootPath)}
              >
                {rootPath}
              </button>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  )
}
