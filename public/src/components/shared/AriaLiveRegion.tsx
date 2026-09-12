import { useEffect, useState } from 'react';

interface LiveMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'loading';
  message: string;
}

const PROLOGUE: Record<LiveMessage['type'], string> = {
  success: 'Succès :',
  error: 'Erreur :',
  info: 'Information :',
  loading: 'Chargement :',
};

/**
 * Annonces aria-live globales pour les lecteurs d'écran.
 *
 * Écoute les mêmes événements `show-toast` que le composant Toast visuel, mais
 * rend deux régions sr-only :
 *   - polite (role="status") pour success/info/loading
 *   - assertive (role="alert") pour error
 *
 * Le préfixe en français ("Succès :", "Erreur :"...) clarifie la nature du
 * message lorsque l'icône visuelle n'est pas accessible au lecteur d'écran.
 */
export const AriaLiveRegion = () => {
  const [polite, setPolite] = useState<LiveMessage[]>([]);
  const [assertive, setAssertive] = useState<LiveMessage[]>([]);

  useEffect(() => {
    const activeTimers = new Set<NodeJS.Timeout>();

    const handleShow = (event: Event) => {
      const { type, message, id: customId } = (event as CustomEvent).detail;
      if (!message) return;

      // Use a more unique ID to avoid collisions during rapid bursts
      const id = customId ?? `live-${Math.random().toString(36).slice(2, 11)}-${Date.now()}`;
      const entry: LiveMessage = { id, type, message };

      if (type === 'error') {
        setAssertive((prev) => [...prev, entry]);
        const timer = setTimeout(() => {
          setAssertive((prev) => prev.filter((m) => m.id !== id));
          activeTimers.delete(timer);
        }, 1000);
        activeTimers.add(timer);
      } else {
        setPolite((prev) => [...prev, entry]);
        const timer = setTimeout(() => {
          setPolite((prev) => prev.filter((m) => m.id !== id));
          activeTimers.delete(timer);
        }, 1000);
        activeTimers.add(timer);
      }
    };

    window.addEventListener('show-toast', handleShow);
    return () => {
      window.removeEventListener('show-toast', handleShow);
      activeTimers.forEach(clearTimeout);
      activeTimers.clear();
    };
  }, []);

  return (
    <>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {polite.map((m) => (
          <p key={m.id}>
            {PROLOGUE[m.type]} {m.message}
          </p>
        ))}
      </div>
      <div role="alert" aria-live="assertive" aria-atomic="true" className="sr-only">
        {assertive.map((m) => (
          <p key={m.id}>
            {PROLOGUE[m.type]} {m.message}
          </p>
        ))}
      </div>
    </>
  );
};
