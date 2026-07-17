import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    sourcemap: true,
    lib: {
      entry: 'electron/main/main.ts',
      fileName: () => 'main.js',
      formats: ['es'],
    },
  },
})
