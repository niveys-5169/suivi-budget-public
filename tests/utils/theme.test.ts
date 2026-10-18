import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  THEME_KEY,
  resolveTheme,
  applyTheme,
  setThemePreference,
  cycleTheme,
} from '../../public/src/theme';

describe('theme system', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    vi.restoreAllMocks();
  });

  it('résout explicitement le thème gold', () => {
    expect(resolveTheme('gold')).toBe('gold');
  });

  it('résout explicitement le thème dark', () => {
    expect(resolveTheme('dark')).toBe('dark');
  });

  it('résout explicitement le thème light', () => {
    expect(resolveTheme('light')).toBe('light');
  });

  it('applique le thème gold sur le document et met à jour le meta tag', () => {
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);

    applyTheme('gold');

    expect(document.documentElement.getAttribute('data-theme')).toBe('gold');
    expect(meta.getAttribute('content')).toBe('rgb(249, 246, 240)');

    document.head.removeChild(meta);
  });

  it('enregistre la préférence gold et émet un événement', () => {
    const listener = vi.fn();
    window.addEventListener('theme-change', listener);

    setThemePreference('gold');

    expect(localStorage.getItem(THEME_KEY)).toBe('gold');
    expect(document.documentElement.getAttribute('data-theme')).toBe('gold');
    expect(listener).toHaveBeenCalled();

    window.removeEventListener('theme-change', listener);
  });

  it('fait défiler les thèmes via cycleTheme', () => {
    localStorage.setItem(THEME_KEY, 'dark');
    cycleTheme();
    expect(localStorage.getItem(THEME_KEY)).toBe('gold');

    cycleTheme();
    expect(localStorage.getItem(THEME_KEY)).toBe('light');

    cycleTheme();
    expect(localStorage.getItem(THEME_KEY)).toBe('auto');

    cycleTheme();
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
  });
});
