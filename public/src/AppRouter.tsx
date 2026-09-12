import React, { useSyncExternalStore } from 'react';
import { MainApp } from './MainApp';
import { MobileApp } from './MobileApp';
import { FLAGS } from './lib/featureFlags';
import { DevConsoleLogger } from './components/dashboard/v2/DevConsoleLogger';
import { PWAUpdateBanner } from './components/shared/PWAUpdateBanner';

const MOBILE_MAX_DIMENSION = 767;

// On se base sur la plus petite dimension (largeur ou hauteur) plutôt que sur
// la largeur seule : un smartphone en mode paysage a une largeur > 767px mais
// reste un mobile. Utiliser uniquement la largeur ferait basculer vers
// l'interface desktop à la rotation et réinitialiserait la navigation mobile.
function isMobileViewport() {
  return Math.min(window.innerWidth, window.innerHeight) <= MOBILE_MAX_DIMENSION;
}

function subscribe(callback: () => void) {
  window.addEventListener('resize', callback);
  window.addEventListener('orientationchange', callback);
  return () => {
    window.removeEventListener('resize', callback);
    window.removeEventListener('orientationchange', callback);
  };
}

function getSnapshot(): 'mobile' | 'desktop' {
  // URL override pour debug : ?ui=mobile ou ?ui=desktop
  const override = new URLSearchParams(window.location.search).get('ui');
  if (override === 'mobile' || override === 'desktop') return override;
  return isMobileViewport() ? 'mobile' : 'desktop';
}

export const AppRouter: React.FC = () => {
  const mode = useSyncExternalStore(subscribe, getSnapshot, () => 'desktop');
  return (
    <>
      <DevConsoleLogger />
      {FLAGS.MOBILE_V3 && mode === 'mobile' ? <MobileApp /> : <MainApp />}
      {/* Monté au niveau routeur pour enregistrer le service worker (useRegisterSW)
          et afficher l'invite de mise à jour dans les deux modes, PWA mobile incluse. */}
      <PWAUpdateBanner />
    </>
  );
};
