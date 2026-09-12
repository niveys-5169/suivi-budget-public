import { useEffect, useRef, useState, useCallback } from 'react';
import { useFinanceQA } from './useFinanceQA';
import { useAISessions } from './useAISessions';

/** Composite hook managing local chat state and syncing sessions to Firestore */
export function usePersistentFinanceQA() {
  const qa = useFinanceQA();
  const {
    sessions,
    loading: sessionsLoading,
    createSession,
    updateSession,
    deleteSession: apiDeleteSession,
  } = useAISessions();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const isNewSession = useRef(true);
  const activeSessionIdRef = useRef<string | null>(null);
  const inFlightRef = useRef<Promise<void>>(Promise.resolve());

  // Sync state to ref
  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  // Auto-save effect
  useEffect(() => {
    const messages = qa.messages;
    if (messages.length === 0) return;

    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.content.startsWith('⚠')) {
      return; // Do not save LLM error messages
    }

    const currentActiveId = activeSessionIdRef.current;

    if (currentActiveId) {
      // Queue update
      inFlightRef.current = inFlightRef.current.then(async () => {
        await updateSession(currentActiveId, messages);
      });
    } else if (isNewSession.current && messages.length >= 2) {
      // Prevent concurrent createSession calls by setting isNewSession immediately
      isNewSession.current = false;

      inFlightRef.current = inFlightRef.current.then(async () => {
        const newId = await createSession(messages);
        if (newId) {
          activeSessionIdRef.current = newId;
          setActiveSessionId(newId);
        } else {
          isNewSession.current = true;
        }
      });
    }
  }, [qa.messages, createSession, updateSession]);

  const selectSession = useCallback(
    (sessionId: string) => {
      const session = sessions.find((s) => s.id === sessionId);
      if (!session) return;
      isNewSession.current = false;
      setActiveSessionId(sessionId);
      qa.initMessages(session.messages);
    },
    [sessions, qa],
  );

  const startNewSession = useCallback(() => {
    isNewSession.current = true;
    setActiveSessionId(null);
    qa.clearChat();
  }, [qa]);

  const deleteSession = useCallback(
    async (sessionId: string) => {
      await apiDeleteSession(sessionId);
      if (activeSessionIdRef.current === sessionId) {
        startNewSession();
      }
    },
    [apiDeleteSession, startNewSession],
  );

  return {
    ...qa,
    sessions,
    sessionsLoading,
    activeSessionId,
    selectSession,
    startNewSession,
    deleteSession,
  };
}
