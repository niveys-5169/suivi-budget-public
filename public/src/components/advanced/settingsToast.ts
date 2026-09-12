/** Toast léger basé sur le CustomEvent `show-toast` consommé par le système global. */
export const settingsToast = (
  type: 'success' | 'error' | 'info' | 'loading',
  message: string,
  duration = 4000,
) => {
  window.dispatchEvent(new CustomEvent('show-toast', { detail: { type, message, duration } }));
};
