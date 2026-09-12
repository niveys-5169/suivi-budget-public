import { useEffect, useState } from 'react';

/**
 * Action de maintenance « réinitialisation dure » : désenregistre le service
 * worker, purge tous les caches puis recharge. Sert le bouton « vider le cache »
 * des réglages (AurumSettingsPage / MaintenanceTab / MSettingsModal).
 *
 * ⚠️ Ne PAS confondre avec l'enregistrement du SW : celui-ci est assuré par
 * `useRegisterSW` (`virtual:pwa-register/react`) dans `PWAUpdateBanner`, monté au
 * niveau d'AppRouter. Ce hook n'enregistre rien — il n'écoute que
 * `controllerchange` et propose le reset. Les deux sont complémentaires.
 */
interface PWAUpdateState {
  isUpdateAvailable: boolean;
  isRefreshing: boolean;
}

export const usePWAUpdate = () => {
  const [state, setState] = useState<PWAUpdateState>({
    isUpdateAvailable: false,
    isRefreshing: false,
  });

  useEffect(() => {
    if (!navigator.serviceWorker) {
      return;
    }

    // Listen for updates
    const handleControllerChange = () => {
      setState((prev) => ({ ...prev, isUpdateAvailable: true }));
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    // Check for updates periodically
    const interval = setInterval(() => {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg) {
          reg.update().catch(() => {
            // Silently handle errors on update check
          });
        }
      });
    }, 60000); // Check every minute

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      clearInterval(interval);
    };
  }, []);

  const refreshApp = async () => {
    setState((prev) => ({ ...prev, isRefreshing: true }));

    try {
      if (navigator.serviceWorker) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          registration.unregister();
        }
      }

      // Clear all caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      }

      // Force a hard refresh
      window.location.reload();
    } catch (error) {
      console.error('Failed to refresh PWA:', error);
      // Fallback: just reload
      window.location.reload();
    }
  };

  return {
    ...state,
    refreshApp,
  };
};
