import { describe, it, expect } from 'vitest';
import { NAV_ITEMS, getTabIndex } from '../navItems';

describe('getTabIndex', () => {
  it('matches the home route exactly', () => {
    expect(getTabIndex('/')).toBe(0);
  });

  it('matches a top-level tab route', () => {
    expect(getTabIndex('/transactions')).toBe(1);
    expect(getTabIndex('/analyse')).toBe(2);
    expect(getTabIndex('/budgets')).toBe(3);
    expect(getTabIndex('/patrimoine')).toBe(4);
  });

  it('matches a sub-route to its parent tab', () => {
    expect(getTabIndex('/budgets/abc')).toBe(NAV_ITEMS.findIndex((i) => i.to === '/budgets'));
  });

  it('does not treat home as a prefix for other routes', () => {
    expect(getTabIndex('/transactions')).not.toBe(0);
  });

  it('returns -1 for routes outside the main tabs', () => {
    expect(getTabIndex('/qa')).toBe(-1);
    expect(getTabIndex('/unknown')).toBe(-1);
  });
});
