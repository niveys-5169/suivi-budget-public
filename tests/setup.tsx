import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { configureAxe } from 'jest-axe';
import React from 'react';

// Configure axe globally — project uses dark-theme custom classes, so we disable
// the colour-contrast rule here; audit contrast separately via axe DevTools.
export const axe = configureAxe({
  rules: { 'color-contrast': { enabled: false } },
});

// Polyfills for JSDOM
window.scrollTo = vi.fn();

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserverMock;

class IntersectionObserverMock {
  constructor(
    public callback: any,
    public options: any,
  ) {}
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.IntersectionObserver = IntersectionObserverMock as any;

// Mock react-intl globally so components using useIntl() work without an IntlProvider
// wrapper in every test. formatMessage resolves against the FR catalogue (default
// locale) so assertions on visible text keep working.
vi.mock('react-intl', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  const { default: frMessages } = await import('../public/src/i18n/messages/fr');
  return {
    ...actual,
    useIntl: () => ({
      formatMessage: ({ id }: { id: string }) => (frMessages as Record<string, string>)[id] ?? id,
      formatNumber: (v: number) => String(v),
      formatDate: (v: Date | string | number) => String(v),
      locale: 'fr',
    }),
    FormattedMessage: ({ id, defaultMessage }: { id: string; defaultMessage?: string }) =>
      ((frMessages as Record<string, string>)[id] ?? defaultMessage ?? id) as any,
    FormattedNumber: ({ value }: { value: number }) => <span>{value}</span>,
    FormattedDate: ({ value }: { value: Date | string | number }) => <span>{String(value)}</span>,
  };
});

// Mock framer-motion globally to save memory and avoid ESM issues
vi.mock('framer-motion', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    motion: new Proxy(actual.motion, {
      get: (target, prop) => {
        if (typeof prop === 'string') {
          const MockMotionComponent = React.forwardRef(({ children, ...props }: any, ref: any) => {
            // Remove motion-specific props that shouldn't reach the DOM
            const {
              whileHover: _whileHover,
              whileTap: _whileTap,
              initial: _initial,
              animate: _animate,
              exit: _exit,
              transition: _transition,
              layout: _layout,
              layoutId: _layoutId,
              drag: _drag,
              dragControls: _dragControls,
              dragListener: _dragListener,
              dragConstraints: _dragConstraints,
              dragElastic: _dragElastic,
              onDrag: _onDrag,
              onDragStart: _onDragStart,
              onDragEnd: _onDragEnd,
              ...domProps
            } = props;
            return React.createElement(prop, { ...domProps, ref }, children);
          });
          MockMotionComponent.displayName = `Motion.${prop}`;
          return MockMotionComponent;
        }
        return target[prop as keyof typeof target];
      },
    }),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useReducedMotion: () => false,
  };
});

// Mock Recharts to avoid "width/height should be greater than 0" warnings
vi.mock('recharts', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  const MockResponsiveContainer = ({ children }: { children: any }) => (
    <div className="recharts-responsive-container" style={{ width: '800px', height: '400px' }}>
      {children}
    </div>
  );
  MockResponsiveContainer.displayName = 'ResponsiveContainer';
  return {
    ...actual,
    ResponsiveContainer: MockResponsiveContainer,
  };
});

// Mock SVGs to avoid unrecognized tag warnings in JSDOM
const originalCreateElement = document.createElement.bind(document);
document.createElement = (tagName: string, options?: ElementCreationOptions) => {
  if (
    ['svg', 'path', 'defs', 'linearGradient', 'stop', 'rect', 'circle', 'line'].includes(tagName)
  ) {
    return originalCreateElement('div', options);
  }
  return originalCreateElement(tagName, options);
};

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, () => {}],
    offlineReady: [false, () => {}],
    updateServiceWorker: () => Promise.resolve(),
  }),
}));

// Mock firebase/firestore to prevent validation errors on db={} stub
vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  const mockRef = () => ({ id: 'mock', type: 'ref', path: 'mock/path' });
  return {
    ...actual,
    collection: vi.fn(mockRef),
    doc: vi.fn(mockRef),
    query: vi.fn((ref: any) => ref),
    where: vi.fn(() => ({ type: 'where' })),
    orderBy: vi.fn(() => ({ type: 'orderBy' })),
    limit: vi.fn(() => ({ type: 'limit' })),
    startAfter: vi.fn(() => ({ type: 'startAfter' })),
    onSnapshot: vi.fn(() => () => {}),
    getDocs: vi.fn(() => Promise.resolve({ docs: [], empty: true, size: 0, forEach: vi.fn() })),
    getDoc: vi.fn(() =>
      Promise.resolve({ exists: () => false, data: () => undefined, id: 'mock-id' }),
    ),
    addDoc: vi.fn(() => Promise.resolve({ id: 'mock-id' })),
    setDoc: vi.fn(() => Promise.resolve()),
    updateDoc: vi.fn(() => Promise.resolve()),
    deleteDoc: vi.fn(() => Promise.resolve()),
    writeBatch: vi.fn(() => ({
      set: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      commit: vi.fn(() => Promise.resolve()),
    })),
    runTransaction: vi.fn(() => Promise.resolve()),
  };
});

// Mock Firebase service globally to prevent initialization with missing API keys in tests
vi.mock('../public/src/services/firebase', () => ({
  FIREBASE_CONFIG: { apiKey: 'test-key', projectId: 'test-project' },
  PORTFOLIO_FIREBASE_CONFIG: { apiKey: 'test-key', projectId: 'test-portfolio' },
  app: {},
  auth: {
    currentUser: null,
    onAuthStateChanged: vi.fn(() => () => {}),
    signInWithPopup: vi.fn(),
    signOut: vi.fn(),
  },
  authPortfolio: {
    currentUser: null,
    onAuthStateChanged: vi.fn(() => () => {}),
  },
  db: {},
  dbPortfolio: {},
  googleProvider: {},
  functions: {},
}));

// Mock AuthContext globally
vi.mock('../public/src/context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuthContext: () => ({
    user: { uid: 'test-uid', email: 'test@example.com' },
    loading: false,
    error: null,
  }),
}));

afterEach(() => {
  cleanup();
});
