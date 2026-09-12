import { useEffect, useState, useCallback } from 'react';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from './useAuth';
import { withRetry } from '../utils/withRetry';
import { useFirestoreErrorHandler } from './useFirestoreErrorHandler';
import type { ChatMessage } from './useFinanceQA';

export interface AISession {
  id: string;
  title: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  messages: ChatMessage[];
  messageCount: number;
}

/** Hook pour gérer les sessions de conversation IA dans Firestore */
export function useAISessions() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<AISession[]>([]);
  const [loading, setLoading] = useState(true);
  const { wrap } = useFirestoreErrorHandler();

  useEffect(() => {
    if (!user) {
      setSessions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(collection(db, 'users', user.uid, 'ai_sessions'), orderBy('updatedAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: AISession[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id,
            title: data.title || '',
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            messages: data.messages || [],
            messageCount: data.messageCount || 0,
          });
        });
        setSessions(list);
        setLoading(false);
      },
      (err) => {
        console.error('>>> useAISessions onSnapshot error:', err);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [user]);

  const createSession = useCallback(
    async (messages: ChatMessage[]): Promise<string | undefined> => {
      if (!user) return undefined;
      const firstUserMsg =
        messages.find((m) => m.role === 'user')?.content || 'Nouvelle conversation';
      const title = firstUserMsg.slice(0, 60);

      return await wrap(
        async () => {
          const docRef = await withRetry(() =>
            addDoc(collection(db, 'users', user.uid, 'ai_sessions'), {
              title,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              messages,
              messageCount: messages.length,
            }),
          );
          return docRef.id;
        },
        { context: 'ai_sessions.create' },
      );
    },
    [user, wrap],
  );

  const updateSession = useCallback(
    async (sessionId: string, messages: ChatMessage[]) => {
      if (!user) return;
      await wrap(
        () =>
          withRetry(() =>
            updateDoc(doc(db, 'users', user.uid, 'ai_sessions', sessionId), {
              messages,
              messageCount: messages.length,
              updatedAt: serverTimestamp(),
            }),
          ),
        { context: 'ai_sessions.update' },
      );
    },
    [user, wrap],
  );

  const deleteSession = useCallback(
    async (sessionId: string) => {
      if (!user) return;
      await wrap(
        () => withRetry(() => deleteDoc(doc(db, 'users', user.uid, 'ai_sessions', sessionId))),
        { context: 'ai_sessions.delete' },
      );
    },
    [user, wrap],
  );

  return {
    sessions,
    loading: user ? loading : false,
    createSession,
    updateSession,
    deleteSession,
  };
}
