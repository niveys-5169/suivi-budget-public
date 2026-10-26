/**
 * Global UI Loader controls
 */

export const hideLoader = () => {
  const loader = document.getElementById('loader');
  if (loader) {
    loader.style.display = 'none';
  }
};

export const setLoaderMsg = (msg: string) => {
  const loader = document.getElementById('loader');
  if (loader) {
    loader.replaceChildren();
    const spinner = document.createElement('div');
    spinner.className = 'spinner';
    const br = document.createElement('br');
    const text = document.createTextNode(msg);
    loader.append(spinner, br, text);
  }
};
