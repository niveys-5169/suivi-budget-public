/**
 * Global UI Loader controls
 */

export const hideLoader = () => {
  const loader = document.getElementById('loader');
  if (loader) {
    loader.style.display = 'none';
  }
};

export const setLoaderMsg = (html: string) => {
  const loader = document.getElementById('loader');
  if (loader) {
    loader.innerHTML = '<div class="spinner"></div><br>' + html;
  }
};
