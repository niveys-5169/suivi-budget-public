import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'mock-pwa',
      resolveId(id) {
        if (id === 'virtual:pwa-register/react') return '\0virtual:pwa-register/react';
      },
      load(id) {
        if (id === '\0virtual:pwa-register/react')
          return 'export const useRegisterSW = () => ({ needRefresh: [false, () => {}], offlineReady: [false, () => {}], updateServiceWorker: () => {} });';
      },
    },
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './tests/setup.tsx',
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.worktrees/**',
      '**/Suivi-Budget-mirror/**',
      '**/e2e/**',
      '**/playwright-report/**',
      '**/storybook-static/**',
    ],
    // Use forks pool for isolation, but allow parallel execution
    pool: 'forks',
    isolate: true,
    testTimeout: 10000,
  },
});
