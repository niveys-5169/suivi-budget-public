import type { StorybookConfig } from '@storybook/react-vite';

/**
 * Storybook 8 (Vite) — minimal config for the AURUM Design System.
 *
 * Scope (Sprint 3.2): stories for primitives in `public/src/components/shared/`
 * and any DS-level component. We deliberately exclude feature components
 * (dashboard, transactions…) — those should be tested via integration tests.
 *
 * Run locally:
 *   npm run storybook        # dev server on :6006
 *   npm run build-storybook  # static build to storybook-static/
 */
const config: StorybookConfig = {
  stories: ['../public/src/**/*.stories.@(ts|tsx|mdx)'],
  addons: ['@storybook/addon-essentials', '@storybook/addon-a11y', '@storybook/addon-interactions'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  docs: { autodocs: 'tag' },
  typescript: { reactDocgen: 'react-docgen-typescript' },
};

export default config;
