import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/palette/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.ts',
    // Nested git worktrees under .claude/worktrees and .worktrees hold stale
    // checkouts of this repo; without excluding them vitest runs their old test
    // copies too, which balloons runs and can hang on since-fixed code.
    exclude: [...configDefaults.exclude, '**/.claude/**', '**/.worktrees/**'],
  },
})
