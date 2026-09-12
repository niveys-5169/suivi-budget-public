import React, { useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { hideLoader } from './utils/loader';
import { MobileShell } from './mobile/MobileShell';
import { MobileSwipeContainer } from './mobile/MobileSwipeContainer';
import { Toast } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';

export const MobileApp: React.FC = () => {
  const { user, loading: authLoading } = useAuth();

  // Sync the static HTML loader and login screen with auth state.
  // Without this, the PWA stays stuck on "Interrogation Firestore..." forever
  // because MobileApp returns null while the static loader remains visible.
  useEffect(() => {
    if (authLoading) return;
    const loginScreen = document.getElementById('login-screen');
    if (loginScreen) {
      if (user) {
        loginScreen.classList.add('hidden');
        loginScreen.classList.remove('flex');
      } else {
        loginScreen.classList.remove('hidden');
        loginScreen.classList.add('flex');
      }
    }
    hideLoader();
  }, [user, authLoading]);

  if (authLoading) return null;
  if (!user) return null;

  return (
    <>
      <MobileShell>
        <ErrorBoundary label="Écran">
          <MobileSwipeContainer />
        </ErrorBoundary>
      </MobileShell>
      <Toast />
    </>
  );
};
