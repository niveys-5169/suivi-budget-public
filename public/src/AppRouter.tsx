import React, { Suspense, lazy, useSyncExternalStore } from 'react';
import { FLAGS } from './lib/featureFlags';
import { DevConsoleLogger } from './components/dashboard/v2/DevConsoleLogger';
import { PWAUpdateBanner } from './components/shared/PWAUpdateBanner';

// Un seul des deux arbres sert sur un appareil donné : chacun vit dans son
// chunk pour que le mobile ne télécharge pas le desktop (et inversement).
// Pas de fallback : le loader de index.html reste affiché jusqu'à hideLoader().
const MainApp = lazy(() => import('./MainApp').then((m) => ({ default: m.MainApp })));
const MobileApp = lazy(() => import('./MobileApp').then((m) => ({ default: m.MobileApp })));

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
      <Suspense fallback={null}>
        {FLAGS.MOBILE_V3 && mode === 'mobile' ? <MobileApp /> : <MainApp />}
      </Suspense>
      {/* Monté au niveau routeur pour enregistrer le service worker (useRegisterSW)
          et afficher l'invite de mise à jour dans les deux modes, PWA mobile incluse. */}
      <PWAUpdateBanner />
    </>
  );
};
