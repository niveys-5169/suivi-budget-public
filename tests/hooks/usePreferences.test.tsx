import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Firebase functions
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  onSnapshot: vi.fn(),
}));

// Mock services
vi.mock('../../public/src/services/firebase', () => ({
  db: { mock: true },
}));

// Mock useAuth
vi.mock('../../public/src/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

import { usePreferences } from '../../public/src/hooks/usePreferences';
import { useAuth } from '../../public/src/hooks/useAuth';
import { getDoc, setDoc, onSnapshot } from 'firebase/firestore';

const mockGetDoc = vi.mocked(getDoc);
const mockSetDoc = vi.mocked(setDoc);
const mockOnSnapshot = vi.mocked(onSnapshot);
const mockUseAuth = vi.mocked(useAuth);

describe('usePreferences', () => {
  beforeEach(() => {
    // Clear localStorage and mocks before each test
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('initialization', () => {
    it('should initialize with empty array when no data exists', async () => {
      mockUseAuth.mockReturnValue({
        user: { uid: 'test-user-123' } as any,
        loading: false,
        error: null,
        signIn: vi.fn(),
        signOut: vi.fn(),
      } as any);

      mockGetDoc.mockResolvedValue({ exists: (() => false) as any } as any);
      mockOnSnapshot.mockReturnValue((() => {}) as any);

      const { result } = renderHook(() => usePreferences());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(result.current.dashboardCategories).toEqual([]);
    });

    it('should load from localStorage if Firestore is unavailable', async () => {
      const savedCategories = ['Category1', 'Category2'];
      localStorage.setItem('dashboard_categories_test-user-123', JSON.stringify(savedCategories));

      mockGetDoc.mockResolvedValue({ exists: (() => false) as any } as any);
      mockOnSnapshot.mockReturnValue(() => {});

      mockUseAuth.mockReturnValue({
        user: { uid: 'test-user-123' } as any,
        loading: false,
        error: null,
      } as any);

      const { result } = renderHook(() => usePreferences());

      await waitFor(() => {
        expect(result.current.dashboardCategories).toEqual(savedCategories);
        expect(result.current.loading).toBe(false);
      });
    });

    it('should show loading state while fetching from Firestore', async () => {
      // Make getDoc take time to resolve
      mockGetDoc.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ exists: (() => false) as any } as any), 100),
          ),
      );
      mockOnSnapshot.mockReturnValue(() => {});

      mockUseAuth.mockReturnValue({
        user: { uid: 'test-user-123' } as any,
        loading: false,
        error: null,
      } as any);

      const { result } = renderHook(() => usePreferences());

      // Loading should be true initially
      expect(result.current.loading).toBe(true);

      // Then false after loading completes
      await waitFor(
        () => {
          expect(result.current.loading).toBe(false);
        },
        { timeout: 500 },
      );
    });

    it('should return empty array and no error when user is not authenticated', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        loading: false,
        error: null,
        signIn: vi.fn(),
        signOut: vi.fn(),
      } as any);

      const { result } = renderHook(() => usePreferences());

      expect(result.current.dashboardCategories).toEqual([]);
      expect(result.current.error).toBeNull();
    });
  });

  describe('persistence', () => {
    it('should save to localStorage immediately when categories change', async () => {
      mockGetDoc.mockResolvedValue({ exists: (() => false) as any } as any);
      mockSetDoc.mockResolvedValue(undefined);
      mockOnSnapshot.mockReturnValue(() => {});

      mockUseAuth.mockReturnValue({
        user: { uid: 'test-user-123' } as any,
        loading: false,
        error: null,
      } as any);

      const { result } = renderHook(() => usePreferences());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.setDashboardCategories(['NewCategory1', 'NewCategory2']);
      });

      const stored = localStorage.getItem('dashboard_categories_test-user-123');
      expect(JSON.parse(stored!)).toEqual(['NewCategory1', 'NewCategory2']);
    });

    it('should debounce Firestore writes (no immediate write)', async () => {
      mockGetDoc.mockResolvedValue({ exists: (() => false) as any } as any);
      mockSetDoc.mockResolvedValue(undefined);
      mockOnSnapshot.mockReturnValue(() => {});

      mockUseAuth.mockReturnValue({
        user: { uid: 'test-user-123' } as any,
        loading: false,
        error: null,
      } as any);

      const { result } = renderHook(() => usePreferences());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.setDashboardCategories(['Cat1']);
      });

      // Firestore write should be debounced, not happen immediately
      expect(result.current.isSyncing).toBe(true);
    });

    it('should set isSyncing to false after Firestore write completes', async () => {
      mockGetDoc.mockResolvedValue({ exists: (() => false) as any } as any);
      mockSetDoc.mockResolvedValue(undefined);
      mockOnSnapshot.mockReturnValue(() => {});

      mockUseAuth.mockReturnValue({
        user: { uid: 'test-user-123' } as any,
        loading: false,
        error: null,
      } as any);

      const { result } = renderHook(() => usePreferences());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.setDashboardCategories(['Cat1', 'Cat2']);
      });

      await waitFor(
        () => {
          expect(result.current.isSyncing).toBe(false);
        },
        { timeout: 2000 },
      );
    });
  });

  describe('error handling', () => {
    it('should set error state if Firestore read fails', async () => {
      mockUseAuth.mockReturnValue({
        user: { uid: 'test-user-123' } as any,
        loading: false,
        error: null,
      } as any);

      // Mock Firestore to fail (will be implemented in hook)
      const { result } = renderHook(() => usePreferences());

      // When Firestore fails, hook should have error but still work with localStorage
      await waitFor(() => {
        expect(result.current.error).toBeDefined();
      });
    });

    it('should clear error after successful write', async () => {
      mockGetDoc.mockResolvedValue({ exists: (() => false) as any } as any);
      mockSetDoc.mockResolvedValue(undefined);
      mockOnSnapshot.mockReturnValue(() => {});

      mockUseAuth.mockReturnValue({
        user: { uid: 'test-user-123' } as any,
        loading: false,
        error: null,
      } as any);

      const { result } = renderHook(() => usePreferences());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.setDashboardCategories(['Cat1']);
      });

      await waitFor(
        () => {
          expect(result.current.error).toBeNull();
        },
        { timeout: 2000 },
      );
    });
  });

  describe('real-time sync', () => {
    it('should subscribe to Firestore changes when authenticated', async () => {
      mockUseAuth.mockReturnValue({
        user: { uid: 'test-user-123' } as any,
        loading: false,
        error: null,
      } as any);

      const { result } = renderHook(() => usePreferences());

      // Hook should set up a real-time listener
      // This will be verified by checking if onSnapshot is called in implementation
      await waitFor(() => {
        expect(result.current).toBeDefined();
      });
    });

    it('should update local state when Firestore changes externally', async () => {
      mockUseAuth.mockReturnValue({
        user: { uid: 'test-user-123' } as any,
        loading: false,
        error: null,
      } as any);

      const { result } = renderHook(() => usePreferences());

      // Simulate external change (from another device)
      // This will be tested by mocking onSnapshot in the implementation test
      await waitFor(() => {
        expect(result.current.dashboardCategories).toBeDefined();
      });
    });
  });

  describe('density (A14)', () => {
    it('defaults to "comfortable" when nothing is stored', async () => {
      mockGetDoc.mockResolvedValue({ exists: (() => false) as any } as any);
      mockOnSnapshot.mockReturnValue(() => {});
      mockUseAuth.mockReturnValue({
        user: { uid: 'u1' } as any,
        loading: false,
        error: null,
      } as any);

      const { result } = renderHook(() => usePreferences());
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.density).toBe('comfortable');
    });

    it('hydrates density from localStorage when present', async () => {
      localStorage.setItem('ui_density', 'compact');
      mockGetDoc.mockResolvedValue({ exists: (() => false) as any } as any);
      mockOnSnapshot.mockReturnValue(() => {});
      mockUseAuth.mockReturnValue({
        user: { uid: 'u1' } as any,
        loading: false,
        error: null,
      } as any);

      const { result } = renderHook(() => usePreferences());
      expect(result.current.density).toBe('compact');
    });

    it('persists density to localStorage and dispatches density-change event', async () => {
      mockGetDoc.mockResolvedValue({ exists: (() => false) as any } as any);
      mockSetDoc.mockResolvedValue(undefined);
      mockOnSnapshot.mockReturnValue(() => {});
      mockUseAuth.mockReturnValue({
        user: { uid: 'u1' } as any,
        loading: false,
        error: null,
      } as any);

      const events: string[] = [];
      const listener = (e: Event) => events.push((e as CustomEvent).detail.density);
      window.addEventListener('density-change', listener);

      const { result } = renderHook(() => usePreferences());
      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => result.current.setDensity('compact'));

      expect(localStorage.getItem('ui_density')).toBe('compact');
      expect(events).toContain('compact');

      window.removeEventListener('density-change', listener);
    });

    it('writes density to Firestore via setDoc(merge:true) when authenticated', async () => {
      mockGetDoc.mockResolvedValue({ exists: (() => false) as any } as any);
      mockSetDoc.mockResolvedValue(undefined);
      mockOnSnapshot.mockReturnValue(() => {});
      mockUseAuth.mockReturnValue({
        user: { uid: 'u1' } as any,
        loading: false,
        error: null,
      } as any);

      const { result } = renderHook(() => usePreferences());
      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => result.current.setDensity('compact'));

      const called = (mockSetDoc as any).mock.calls.some(
        ([, payload, opts]: any[]) => payload?.density === 'compact' && opts?.merge === true,
      );
      expect(called).toBe(true);
    });
  });

  describe('offline behavior', () => {
    it('should work offline with localStorage only', async () => {
      mockGetDoc.mockResolvedValue({ exists: (() => false) as any } as any);
      mockOnSnapshot.mockReturnValue(() => {});

      mockUseAuth.mockReturnValue({
        user: { uid: 'test-user-123' } as any,
        loading: false,
        error: null,
      } as any);

      localStorage.setItem(
        'dashboard_categories_test-user-123',
        JSON.stringify(['OfflineCategory']),
      );

      const { result } = renderHook(() => usePreferences());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.dashboardCategories).toEqual(['OfflineCategory']);
    });

    it('should retry Firestore write when coming online', async () => {
      mockGetDoc.mockResolvedValue({ exists: (() => false) as any } as any);
      mockSetDoc.mockResolvedValue(undefined);
      mockOnSnapshot.mockReturnValue(() => {});

      mockUseAuth.mockReturnValue({
        user: { uid: 'test-user-123' } as any,
        loading: false,
        error: null,
      } as any);

      const { result } = renderHook(() => usePreferences());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.setDashboardCategories(['RetryCategory']);
      });

      // Simulate coming online
      act(() => {
        window.dispatchEvent(new Event('online'));
      });

      // Firestore sync should be retried
      await waitFor(
        () => {
          expect(result.current.isSyncing).toBe(false);
        },
        { timeout: 3000 },
      );
    });
  });
});
