type ToastType = 'success' | 'error' | 'info' | 'loading';

function dispatch(type: ToastType, message: string, duration: number, id?: string) {
  window.dispatchEvent(new CustomEvent('show-toast', { detail: { type, message, duration, id } }));
}

function dismiss(id: string) {
  window.dispatchEvent(new CustomEvent('dismiss-toast', { detail: { id } }));
}

export const toast = {
  success: (message: string, duration = 4000, id?: string) =>
    dispatch('success', message, duration, id),
  error: (message: string, duration = 6000, id?: string) =>
    dispatch('error', message, duration, id),
  info: (message: string, duration = 4000, id?: string) => dispatch('info', message, duration, id),
  loading: (message: string, id: string) => dispatch('loading', message, 0, id),
  dismiss,
};
