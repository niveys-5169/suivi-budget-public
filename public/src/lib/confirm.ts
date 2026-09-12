/**
 * Dialogue de confirmation accessible, en remplacement de window.confirm().
 *
 * API impérative promise-based (même esprit que lib/toast.ts) : n'importe où
 * dans le code on écrit `if (await confirm({ message })) { ... }`.
 *
 * Un `<ConfirmHost />` monté une fois par shell écoute l'évènement et rend le
 * dialogue via le composant Modal WCAG. Si aucun host n'est monté (tests, ou
 * shell qui l'aurait oublié), on retombe proprement sur window.confirm() —
 * jamais de promesse qui reste pendante.
 */
export interface ConfirmOptions {
  message: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Style destructif (bouton rouge) pour les suppressions. */
  danger?: boolean;
}

export interface ConfirmRequest {
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
}

let hostMounted = false;

/** Appelé par ConfirmHost à son montage/démontage. Interne. */
export function _setConfirmHostMounted(mounted: boolean): void {
  hostMounted = mounted;
}

export function confirm(options: ConfirmOptions): Promise<boolean> {
  if (!hostMounted || typeof window === 'undefined') {
    return Promise.resolve(window.confirm(options.message));
  }
  return new Promise<boolean>((resolve) => {
    window.dispatchEvent(
      new CustomEvent<ConfirmRequest>('app-confirm', { detail: { options, resolve } }),
    );
  });
}
