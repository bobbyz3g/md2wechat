if (!window.md2wechat) {
  throw new Error('桌面 API 不可用')
}

export const desktopApi = window.md2wechat
