import React from 'react';
import { createRoot } from 'react-dom/client';
import './tailwind.css';
import './style.css';
import { initTheme } from './theme';
import './store';

// React Providers
import { BudgetProvider } from './context/BudgetContext';
import { CategoryMetaProvider } from './context/CategoryMetaContext';
import { AppStateProvider } from './context/AppStateContext';
import { TransactionProvider } from './context/TransactionContext';
import { GlobalDataProvider } from './context/GlobalDataContext';
import { AuthProvider } from './context/AuthContext';
import { FLAGS } from './lib/featureFlags';
import { BrowserRouter } from 'react-router-dom';
import { AppRouter } from './AppRouter';
import { IntlProviderWrapper } from './i18n/IntlProviderWrapper';
import { LoginButton } from './components/AuthButtons';

window.FLAGS = FLAGS;

window.reactRoots = window.reactRoots || {};

// Orchestrate Root Mounting
const appRootEl = document.getElementById('app-root');
if (appRootEl) {
  if (!window.reactRoots['app-root']) {
    window.reactRoots['app-root'] = createRoot(appRootEl);
  }
  window.reactRoots['app-root'].render(
    React.createElement(
      IntlProviderWrapper,
      null,
      React.createElement(
        AuthProvider,
        null,
        React.createElement(
          BrowserRouter,
          null,
          React.createElement(
            AppStateProvider,
            null,
            React.createElement(
              GlobalDataProvider,
              null,
              React.createElement(
                TransactionProvider,
                null,
                React.createElement(
                  BudgetProvider,
                  null,
                  React.createElement(CategoryMetaProvider, null, React.createElement(AppRouter)),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );

  // Hide legacy panels (if they somehow exist)
  const legacyWrap = document.getElementById('legacy-panels');
  if (legacyWrap) legacyWrap.classList.add('hidden');
}

// LoginButton requires IntlProvider (useIntl hook) — wrap it explicitly
const loginBtnEl = document.getElementById('login-button-root');
if (loginBtnEl) {
  if (!window.reactRoots['login-button-root']) {
    window.reactRoots['login-button-root'] = createRoot(loginBtnEl);
  }
  window.reactRoots['login-button-root'].render(
    React.createElement(
      IntlProviderWrapper,
      null,
      React.createElement(AuthProvider, null, React.createElement(LoginButton)),
    ),
  );
}

// Initialize Services
initTheme();
