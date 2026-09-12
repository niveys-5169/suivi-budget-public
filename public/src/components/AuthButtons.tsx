import React, { useState } from 'react';
import { useIntl } from 'react-intl';
import { auth, googleProvider } from '../services/firebase';
import { signInWithPopup, signOut } from 'firebase/auth';
import type { MessageId } from '../i18n/messages/fr';

const IOS_LOGIN_PARAM = 'ios_login';

/** True when this tab was opened from the standalone app specifically for auth. */
export const isIOSLoginTab = (): boolean =>
  new URLSearchParams(window.location.search).has(IOS_LOGIN_PARAM);

export const LoginButton: React.FC = () => {
  const { formatMessage: t } = useIntl();
  const [error, setError] = useState<string>('');

  const handleLogin = async () => {
    setError('');
    try {
      googleProvider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      console.error('[Auth] signInWithPopup failed:', err);
      const errorObj = err as { code?: string };
      const code = errorObj?.code || '';
      const messageId: MessageId = code.includes('auth/unauthorized-domain')
        ? 'auth.error.unauthorizedDomain'
        : code.includes('auth/popup-blocked')
          ? 'auth.error.popupBlocked'
          : code.includes('auth/popup-closed-by-user')
            ? 'auth.error.popupClosed'
            : 'auth.error.generic';
      setError(t({ id: messageId }));
    }
  };

  return (
    <div className="space-y-4 w-full">
      <button
        onClick={handleLogin}
        className="w-full h-16 rounded-lg bg-gold text-bg font-semibold text-xs flex items-center justify-center gap-4 hover:bg-gold-light transition-all shadow-gold/20"
      >
        <svg width="20" height="20" viewBox="0 0 18 18" aria-hidden="true">
          <path
            fill="currentColor"
            d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
          />
          <path
            fill="currentColor"
            d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
          />
          <path
            fill="currentColor"
            d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
          />
          <path
            fill="currentColor"
            d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
          />
        </svg>
        {t({ id: 'auth.signIn.google' })}
      </button>
      {error && (
        <div role="alert" className="text-negative text-caption font-semibold">
          {error}
        </div>
      )}
    </div>
  );
};

export const LogoutButton: React.FC = () => {
  const { formatMessage: t } = useIntl();
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('[Auth] signOut failed:', err);
    }
  };

  return (
    <button
      onClick={handleLogout}
      className="px-4 py-2 rounded-xl bg-surface border border-separator text-caption font-semibold tracking-wide text-label-secondary hover:text-white transition-all"
    >
      {t({ id: 'auth.signOut.short' })}
    </button>
  );
};
