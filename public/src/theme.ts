export const THEME_KEY = 'themePreference';

export type ThemePreference = 'auto' | 'dark' | 'light';
export type ResolvedTheme = 'dark' | 'light';

export function getSystemPrefersDark(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false;
}

export function isNightTime(): boolean {
  const h = new Date().getHours();
  return h >= 21 || h < 7;
}

export function resolveTheme(pref: string): ResolvedTheme {
  if (pref === 'dark') return 'dark';
  if (pref === 'light') return 'light';
  if (getSystemPrefersDark() || isNightTime()) return 'dark';
  return 'light';
}

export function applyTheme(theme: ResolvedTheme): void {
  document.documentElement.setAttribute('data-theme', theme);
  const icon = document.getElementById('theme-icon');
  if (!icon) return;
  const pref = localStorage.getItem(THEME_KEY) || 'auto';
  if (pref === 'auto') icon.textContent = '◑';
  else if (pref === 'dark') icon.textContent = '🌙';
  else icon.textContent = '☀️';
}

export function cycleTheme(): void {
  const current = localStorage.getItem(THEME_KEY) || 'auto';
  const next = current === 'auto' ? 'dark' : current === 'dark' ? 'light' : 'auto';
  localStorage.setItem(THEME_KEY, next);
  applyTheme(resolveTheme(next));
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
