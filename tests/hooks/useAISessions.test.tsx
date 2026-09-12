import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Firestore functions
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  onSnapshot: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  serverTimestamp: vi.fn(() => '__serverTimestamp__'),
}));

// Mock services
vi.mock('../../public/src/services/firebase', () => ({
  db: { mock: true },
}));

// Mock useAuth
vi.mock('../../public/src/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

// Mock useFirestoreErrorHandler
vi.mock('../../public/src/hooks/useFirestoreErrorHandler', () => ({
  useFirestoreErrorHandler: () => ({
    handle: vi.fn(),
    wrap: (fn: any) => fn(),
  }),
}));

import { useAISessions } from '../../public/src/hooks/useAISessions';
import { useAuth } from '../../public/src/hooks/useAuth';
import { addDoc, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';

const mockAddDoc = vi.mocked(addDoc);
const mockUpdateDoc = vi.mocked(updateDoc);
const mockDeleteDoc = vi.mocked(deleteDoc);
const mockOnSnapshot = vi.mocked(onSnapshot);
const mockUseAuth = vi.mocked(useAuth);

describe('useAISessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with empty sessions when loading', async () => {
    mockUseAuth.mockReturnValue({
      user: { uid: 'u1' } as any,
    } as any);

    mockOnSnapshot.mockReturnValue(() => {});

    const { result } = renderHook(() => useAISessions());

    expect(result.current.sessions).toEqual([]);
    expect(result.current.loading).toBe(true);
  });

  it('should create a session with truncated title', async () => {
    mockUseAuth.mockReturnValue({
      user: { uid: 'u1' } as any,
    } as any);

    const docId = 'new-session-id';
    mockAddDoc.mockResolvedValue({ id: docId } as any);

    const { result } = renderHook(() => useAISessions());

    const longMsg = 'a'.repeat(100);
    let createdId: string | undefined;
    await act(async () => {
      createdId = await result.current.createSession([{ role: 'user', content: longMsg }]);
    });

    expect(createdId).toBe(docId);
    expect(mockAddDoc).toHaveBeenCalled();
    const [[, payload]] = (mockAddDoc as any).mock.calls;
    expect(payload.title).toHaveLength(60);
    expect(payload.title).toBe('a'.repeat(60));
  });

  it('should update a session', async () => {
    mockUseAuth.mockReturnValue({
      user: { uid: 'u1' } as any,
    } as any);

    const { result } = renderHook(() => useAISessions());

    await act(async () => {
      await result.current.updateSession('sess-1', [{ role: 'user', content: 'hello' }]);
    });

    expect(mockUpdateDoc).toHaveBeenCalled();
  });

  it('should delete a session', async () => {
    mockUseAuth.mockReturnValue({
      user: { uid: 'u1' } as any,
    } as any);

    const { result } = renderHook(() => useAISessions());

    await act(async () => {
      await result.current.deleteSession('sess-1');
    });

    expect(mockDeleteDoc).toHaveBeenCalled();
  });
});
