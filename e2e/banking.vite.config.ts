import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve, dirname } from 'node:path';

const root = resolve('e2e/banking-app');
const mocks = new Map([
  [resolve('public/src/services/banking-api'), resolve(root, 'mock-banking-api.ts')],
  [resolve('public/src/services/firebase'), resolve(root, 'mock-firebase.ts')],
  ...[
    'public/src/hooks/useAuth',
    'public/src/hooks/useBudget',
    'public/src/context/AppStateContext',
  ].map((path) => [resolve(path), resolve(root, 'mock-hooks.ts')]),
]);
export default defineConfig({
  root,
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'banking-test-boundaries',
      enforce: 'pre',
      resolveId(id, importer) {
        if (importer && id.startsWith('.'))
          return mocks.get(resolve(dirname(importer), id).replace(/\.(tsx?|jsx?)$/, ''));
      },
    },
  ],
  server: { port: 4184, strictPort: true, fs: { allow: [resolve('.')] } },
});
