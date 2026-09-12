import { useEffect, useRef } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Traps keyboard focus inside `containerRef` while active.
 * Returns the ref to attach to the dialog container element.
 * On mount, focuses the first focusable child (or the container itself).
 * On unmount, restores focus to the element that had it before the trap opened.
 */
/** Confine le focus clavier à l'intérieur d'un conteneur tant que `active` est vrai. */
export function useFocusTrap<T extends HTMLElement>(active: boolean) {
  const containerRef = useRef<T>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;

    previousFocusRef.current = document.activeElement as HTMLElement;

    const container = containerRef.current;
    if (!container) return;

    const focusable = (): HTMLElement[] =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => !el.closest('[aria-hidden="true"]'),
      );

    // Focus first focusable element on open, fall back to container itself.
    const first = focusable()[0];
    if (first) {
      first.focus();
    } else {
      container.focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const nodes = focusable();
      if (nodes.length === 0) return;

      const firstEl = nodes[0];
      const lastEl = nodes[nodes.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault();
          lastEl?.focus();
        }
      } else {
        if (document.activeElement === lastEl) {
          e.preventDefault();
          firstEl?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Restore focus to whatever had it before the dialog opened.
      previousFocusRef.current?.focus();
    };
  }, [active]);

  return containerRef;
}
