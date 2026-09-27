import { defineConfig } from 'vitest/config';

// Tests des règles Firestore : exigent l'émulateur (voir `npm run test:rules`),
// donc hors de la suite par défaut.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.test.ts'],
    testTimeout: 20000,
    hookTimeout: 60000,
  },
});
