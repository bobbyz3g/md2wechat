import type { ForgeConfig } from '@electron-forge/shared-types'

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
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
      config: {},
    },
    {
      name: '@electron-forge/maker-dmg',
      platforms: ['darwin'],
      config: {},
    },
    {
      name: '@electron-forge/maker-deb',
      platforms: ['linux'],
      config: {},
    },
  ],
}

export default config
