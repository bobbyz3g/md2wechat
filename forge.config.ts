import type { ForgeConfig } from '@electron-forge/shared-types'

const packageDescription = '面向微信公众号写作的 Markdown 桌面排版工具'

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    icon: 'build/icons/icon',
    executableName: 'md2wechat',
  },
  plugins: [
    {
      name: '@electron-forge/plugin-vite',
      config: {
        build: [
          { entry: 'electron/main/main.ts', config: 'vite.main.config.ts' },
          {
            entry: 'electron/preload/preload.ts',
            config: 'vite.preload.config.ts',
          },
        ],
        renderer: [{ name: 'main_window', config: 'web/vite.config.ts' }],
        concurrent: 2,
      },
    },
  ],
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      platforms: ['win32'],
      config: {
        name: 'md2wechat',
        authors: 'md2wechat',
        description: packageDescription,
        setupIcon: 'build/icons/icon.ico',
      },
    },
    {
      name: '@electron-forge/maker-dmg',
      platforms: ['darwin'],
      config: {
        icon: 'build/icons/icon.icns',
      },
    },
    {
      name: '@electron-forge/maker-deb',
      platforms: ['linux'],
      config: {
        options: {
          icon: 'build/icons/icon.png',
          maintainer: 'md2wechat',
          homepage: 'https://github.com/bobbyz3g/md2wechat',
          categories: ['Utility'],
        },
      },
    },
  ],
}

export default config
