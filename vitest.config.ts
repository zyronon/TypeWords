import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  esbuild: {
    // Unit tests must not depend on Nuxt's generated .nuxt/tsconfig files.
    tsconfigRaw: '{}',
  },
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./app', import.meta.url)),
      '@': fileURLToPath(new URL('./app', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    clearMocks: true,
  },
})
