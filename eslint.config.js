// ESLint flat config for Suivi-Budget (AURUM)
// Sprint 1.1 — quality foundations.
// Run: `npm run lint` (check) / `npm run lint:fix` (apply fixes).

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'archive/**',
      '.firebase/**',
      'functions/**',
      'playwright-report/**',
      'test-results/**',
      'storybook-static/**',
      'scripts/**',
      'storybook-static/**',
      'coverage/**',
      'public/lib/**',
      'public/vendor/**',
      '**/*.cjs',
      '**/*.min.js',
      '.worktrees/**',
      'venv/**',
      '.cline/**',
      '.claude/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,

      // React 17+ JSX transform — no need to import React.
      'react/react-in-jsx-scope': 'off',
      // We use TypeScript; runtime prop-types are redundant.
      'react/prop-types': 'off',
      // Allow `target="_blank"` patterns guarded elsewhere; keep as warn.
      'react/jsx-no-target-blank': 'warn',

      // TypeScript adjustments — start permissive, tighten later.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      'no-unused-vars': 'off',
      'no-empty': ['warn', { allowEmptyCatch: true }],

      // Hooks rules are non-negotiable.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // a11y baseline (full audit comes in Sprint 2.1).
      'jsx-a11y/label-has-associated-control': 'warn',
      'jsx-a11y/no-autofocus': 'warn',
      'jsx-a11y/click-events-have-key-events': 'warn',
      'jsx-a11y/no-static-element-interactions': 'warn',
    },
  },

  // Tests can use Node + Vitest globals.
  {
    files: [
      'tests/**/*.{ts,tsx,js,jsx}',
      '**/*.test.{ts,tsx,js,jsx}',
      '**/*.spec.{ts,tsx,js,jsx}',
      '**/__tests__/**/*.{ts,tsx,js,jsx}',
    ],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
        vi: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        beforeEach: 'readonly',
        afterAll: 'readonly',
        afterEach: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // Config files (vite.config.js, tailwind.config.js, etc.) run in Node.
  {
    files: [
      '*.config.{js,ts,mjs,cjs}',
      'vite.config.*',
      'vitest.config.*',
      'tailwind.config.*',
      'postcss.config.*',
    ],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  // Prettier must come last to disable formatting-related rules.
  prettierConfig,
);
