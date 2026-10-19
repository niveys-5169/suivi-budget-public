export const THEME_KEY = 'themePreference';

export type ThemePreference = 'auto' | 'dark' | 'gold' | 'light';
export type ResolvedTheme = 'dark' | 'gold' | 'light';

export function getSystemPrefersDark(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false;
}

export function isNightTime(): boolean {
  const h = new Date().getHours();
  return h >= 21 || h < 7;
}

export function resolveTheme(pref: string): ResolvedTheme {
  if (pref === 'dark') return 'dark';
  if (pref === 'gold') return 'gold';
  if (pref === 'light') return 'light';
  return 'gold';
}

export function applyTheme(theme: ResolvedTheme): void {
  document.documentElement.setAttribute('data-theme', theme);

  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute(
      'content',
      theme === 'gold'
        ? 'rgb(9, 8, 6)'
        : theme === 'light'
          ? 'rgb(255, 255, 255)'
          : 'rgb(11, 11, 20)',
    );
  }

  const icon = document.getElementById('theme-icon');
  if (!icon) return;
  const pref = localStorage.getItem(THEME_KEY) || 'auto';
  if (pref === 'auto') icon.textContent = '◑';
  else if (pref === 'dark') icon.textContent = '🌙';
  else if (pref === 'gold') icon.textContent = '✨';
  else icon.textContent = '☀️';
}

export function setThemePreference(pref: ThemePreference): void {
  localStorage.setItem(THEME_KEY, pref);
  applyTheme(resolveTheme(pref));
  window.dispatchEvent(new CustomEvent('theme-change', { detail: { theme: pref } }));
}

export function cycleTheme(): void {
  const current = (localStorage.getItem(THEME_KEY) || 'auto') as ThemePreference;
  const next: ThemePreference =
    current === 'auto'
      ? 'dark'
      : current === 'dark'
        ? 'gold'
        : current === 'gold'
          ? 'light'
          : 'auto';
  setThemePreference(next);
}

// Initialisation du thème au chargement
export function initTheme(): void {
  const pref = localStorage.getItem(THEME_KEY) || 'auto';
  applyTheme(resolveTheme(pref));
  window.matchMedia?.('(prefers-color-scheme: dark)')?.addEventListener('change', () => {
    const p = localStorage.getItem(THEME_KEY) || 'auto';
    if (p === 'auto') applyTheme(resolveTheme('auto'));
  });
  setInterval(() => {
    const p = localStorage.getItem(THEME_KEY) || 'auto';
    if (p === 'auto') applyTheme(resolveTheme('auto'));
  }, 600000);
}
