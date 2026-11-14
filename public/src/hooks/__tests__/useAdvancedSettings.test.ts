import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

const auditedMergeMock = vi.fn().mockResolvedValue(undefined);
vi.mock('../../services/auditLog', () => ({
  auditedMerge: (...args: unknown[]) => auditedMergeMock(...args),
}));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db, coll, id) => ({ id, path: `${coll}/${id}` })),
  onSnapshot: vi.fn(() => () => {}),
  setDoc: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../services/firebase', () => ({ db: {} }));
vi.mock('../useAuth', () => ({ useAuth: () => ({ user: { uid: 'u1' } }) }));

import { useAdvancedSettings } from '../useAdvancedSettings';

describe('useAdvancedSettings', () => {
  it('le reste-à-vivre est journalisé comme dans RAVEditor', async () => {
    const { result } = renderHook(() => useAdvancedSettings());
    await act(() => result.current.updateRavConfig({ revenu_mensuel_net: 3000 }));
    expect(auditedMergeMock).toHaveBeenCalledWith(
      'budget',
      { id: 'rav_config', path: 'metadata/rav_config' },
      { revenu_mensuel_net: 3000 },
      'Reste-à-vivre',
    );
  });
});
