import type { Preview } from '@storybook/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// AURUM design tokens — same stylesheet the app uses.
import '../public/src/tailwind.css';
import '../public/src/style.css';

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'aurum-ink',
      values: [
        { name: 'aurum-ink', value: '#0B0B14' },
        { name: 'aurum-surface', value: '#15151F' },
        { name: 'light', value: '#FFFFFF' },
      ],
    },
    controls: {
      matchers: { color: /(background|color)$/i, date: /Date$/i },
    },
    a11y: {
      // Match jest-axe config in tests/setup.ts — colour-contrast audited separately.
      config: { rules: [{ id: 'color-contrast', enabled: false }] },
    },
  },
  // Router is needed for components that use NavLink/Link.
  decorators: [
    (Story) =>
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(
          'div',
          { className: 'min-h-48 p-6 bg-bg text-label' },
          React.createElement(Story, null),
        ),
      ),
  ],
};

export default preview;
