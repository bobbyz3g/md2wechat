import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  build: {
    outDir: fileURLToPath(
      new URL('../.vite/renderer/main_window', import.meta.url),
    ),
  },
  test: {
    environment: 'jsdom',
  },
})
