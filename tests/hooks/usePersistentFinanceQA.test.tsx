import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

let mockMessages: any[] = [];
const mockSend = vi.fn();
const mockClearChat = vi.fn();
const mockInitMessages = vi.fn();

vi.mock('../../public/src/hooks/useFinanceQA', () => ({
  useFinanceQA: () => ({
    messages: mockMessages,
    loading: false,
    send: mockSend,
    clearChat: mockClearChat,
    initMessages: mockInitMessages,
  }),
}));

let mockSessions: any[] = [];
const mockCreateSession = vi.fn();
const mockUpdateSession = vi.fn();
const mockDeleteSession = vi.fn();

vi.mock('../../public/src/hooks/useAISessions', () => ({
  useAISessions: () => ({
    sessions: mockSessions,
    loading: false,
    createSession: mockCreateSession,
    updateSession: mockUpdateSession,
    deleteSession: mockDeleteSession,
  }),
}));

import { usePersistentFinanceQA } from '../../public/src/hooks/usePersistentFinanceQA';

describe('usePersistentFinanceQA', () => {
  beforeEach(() => {
    mockMessages = [];
    mockSessions = [];
    vi.clearAllMocks();
  });

  it('should initialize with wrapped useFinanceQA values', () => {
    const { result } = renderHook(() => usePersistentFinanceQA());
    expect(result.current.messages).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('should auto-create session after 1st user+assistant pair', async () => {
    mockCreateSession.mockResolvedValue('new-session-id');
    const { result, rerender } = renderHook(() => usePersistentFinanceQA());

    // Initially empty
    expect(mockCreateSession).not.toHaveBeenCalled();

    // Set messages to first user + assistant pair
    mockMessages = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'world' },
    ];
    rerender();

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalledWith(mockMessages);
      expect(result.current.activeSessionId).toBe('new-session-id');
    });
  });

  it('should update session on subsequent messages', async () => {
    mockCreateSession.mockResolvedValue('new-session-id');
    const { rerender } = renderHook(() => usePersistentFinanceQA());

    // 1. Create session
    mockMessages = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'world' },
    ];
    rerender();

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalled();
    });

    // 2. Add message to active session
    mockMessages = [
      ...mockMessages,
      { role: 'user', content: 'next question' },
      { role: 'assistant', content: 'next answer' },
    ];
    rerender();

    await waitFor(() => {
      expect(mockUpdateSession).toHaveBeenCalledWith('new-session-id', mockMessages);
    });
  });

  it('should not save if the last message starts with ⚠', async () => {
    const { rerender } = renderHook(() => usePersistentFinanceQA());

    mockMessages = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: '⚠ API Key not configured' },
    ];
    rerender();

    // Should not trigger createSession
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('should handle selectSession, startNewSession, and deleteSession', async () => {
    mockSessions = [{ id: 'sess-1', title: 'Sess 1', messages: [{ role: 'user', content: 'S1' }] }];

    const { result } = renderHook(() => usePersistentFinanceQA());

    // Select session
    act(() => {
      result.current.selectSession('sess-1');
    });
    expect(mockInitMessages).toHaveBeenCalledWith(mockSessions[0].messages);
    expect(result.current.activeSessionId).toBe('sess-1');

    // Start new session
    act(() => {
      result.current.startNewSession();
    });
    expect(mockClearChat).toHaveBeenCalled();
    expect(result.current.activeSessionId).toBeNull();

    // Delete session
    act(() => {
      result.current.deleteSession('sess-1');
    });
    expect(mockDeleteSession).toHaveBeenCalledWith('sess-1');
  });
});
