import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Feature Flags', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should export FLAGS object with all flags as booleans', async () => {
    const { FLAGS } = await import('../featureFlags');
    expect(typeof FLAGS.ANALYSE_PAGE).toBe('boolean');
    expect(typeof FLAGS.BUDGET_BANKIN).toBe('boolean');
    expect(typeof FLAGS.BOTTOMNAV_V2).toBe('boolean');
  });

  it('should have flags true by default if not set to false', async () => {
    vi.stubEnv('VITE_ANALYSE_PAGE', 'true');
    vi.stubEnv('VITE_BUDGET_BANKIN', 'true');
    const { FLAGS } = await import('../featureFlags');
    expect(FLAGS.ANALYSE_PAGE).toBe(true);
    expect(FLAGS.BUDGET_BANKIN).toBe(true);
    expect(FLAGS.BOTTOMNAV_V2).toBe(true);
  });

  it('should respect false environment variables', async () => {
    vi.stubEnv('VITE_ANALYSE_PAGE', 'false');
    vi.stubEnv('VITE_BUDGET_BANKIN', 'false');
    const { FLAGS } = await import('../featureFlags');
    expect(FLAGS.ANALYSE_PAGE).toBe(false);
    expect(FLAGS.BUDGET_BANKIN).toBe(false);
  });
});
