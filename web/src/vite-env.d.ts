/// <reference types="vite/client" />

import type { Md2WechatDesktopApi } from '../../electron/shared/types'

declare global {
  interface Window {
    md2wechat: Md2WechatDesktopApi
  }
}
