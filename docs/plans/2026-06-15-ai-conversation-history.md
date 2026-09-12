# AI Conversation History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable persistent, session-based AI conversation history backed by Firestore for both desktop and PWA mobile screens.

**Architecture:** Use a dedicated `useAISessions` hook for Firestore CRUD, wrap it with `usePersistentFinanceQA` to coordinate with `useFinanceQA` for auto-saves and session loading, and build desktop and mobile components utilizing the unified API.

**Tech Stack:** React 18, TypeScript, Firebase Firestore, Tailwind CSS, Lucide Icons, Framer Motion.

---

### Task 1: Firestore Rules Update

**Files:**

- Modify: `firestore.rules`

- [ ] **Step 1: Add ai_sessions rule**
      Add the following match rule to `firestore.rules` under `rules_version = '2'; service cloud.firestore { match /databases/{database}/documents { ... } }`:

  ```firestore-rules
  // --- Sessions IA (historique des conversations, isolation stricte) ---
  match /users/{uid}/ai_sessions/{docId} {
    allow read, write: if request.auth != null && request.auth.uid == uid;
  }
  ```

- [ ] **Step 2: Commit changes**
  ```bash
  git add firestore.rules
  git commit -m "rules: add rules for users' ai_sessions collection"
  ```

---

### Task 2: useFinanceQA Hook Update

**Files:**

- Modify: `public/src/hooks/useFinanceQA.ts`

- [ ] **Step 1: Implement initMessages function**
      Add `initMessages` callback to set the internal messages state and slice the history ref to the last 20 messages.

  ```typescript
  const initMessages = useCallback((msgs: ChatMessage[]) => {
    setMessages(msgs);
    historyRef.current = msgs.slice(-20);
  }, []);
  ```

  And expose it in the return object:

  ```typescript
  return { messages, loading, send, clearChat, initMessages };
  ```

- [ ] **Step 2: Commit changes**
  ```bash
  git add public/src/hooks/useFinanceQA.ts
  git commit -m "feat(qa): add initMessages callback to useFinanceQA"
  ```

---

### Task 3: Format Relative Date Utility

**Files:**

- Create: `public/src/utils/formatRelativeDate.ts`

- [ ] **Step 1: Implement formatRelativeDate**
      Create the file and write the following utility to format date inputs (Date, Timestamp, or strings) into French relative labels:

  ```typescript
  import { parseDateInput, DateInput } from './date';

  export function formatRelativeDate(value: DateInput): string {
    const date = parseDateInput(value);
    if (!date) return '';

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const diffTime = startOfToday.getTime() - startOfDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return "Aujourd'hui";
    } else if (diffDays === 1) {
      return 'Hier';
    } else if (diffDays > 1 && diffDays <= 7) {
      return `Il y a ${diffDays} j`;
    } else {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    }
  }
  ```

- [ ] **Step 2: Commit changes**
  ```bash
  git add public/src/utils/formatRelativeDate.ts
  git commit -m "feat(utils): create formatRelativeDate helper"
  ```

---

### Task 4: useAISessions Firestore Hook

**Files:**

- Create: `public/src/hooks/useAISessions.ts`

- [ ] **Step 1: Write useAISessions hook**
      Implement the hook to fetch and mutate user AI sessions in Firestore, wrapping writes in `withRetry` and `useFirestoreErrorHandler`.

  ```typescript
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
      const q = query(
        collection(db, 'users', user.uid, 'ai_sessions'),
        orderBy('updatedAt', 'desc'),
      );

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
  ```

- [ ] **Step 2: Commit changes**
  ```bash
  git add public/src/hooks/useAISessions.ts
  git commit -m "feat(qa): create useAISessions hook for Firestore CRUD"
  ```

---

### Task 5: usePersistentFinanceQA Composite Hook

**Files:**

- Create: `public/src/hooks/usePersistentFinanceQA.ts`

- [ ] **Step 1: Write usePersistentFinanceQA hook**
      Implement the hook that coordinates `useFinanceQA` and `useAISessions`, auto-saving messages without duplicate creations or saving error messages.

  ```typescript
  import { useEffect, useRef, useState, useCallback } from 'react';
  import { useFinanceQA } from './useFinanceQA';
  import { useAISessions } from './useAISessions';

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
    const inFlightRef = useRef<Promise<any>>(Promise.resolve());

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

      // Check if we need to create or update
      const currentActiveId = activeSessionIdRef.current;

      if (currentActiveId) {
        // Queue the update
        inFlightRef.current = inFlightRef.current.then(async () => {
          await updateSession(currentActiveId, messages);
        });
      } else if (isNewSession.current && messages.length >= 2) {
        // Prevent concurrent createSession fires by marking isNewSession false immediately
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
  ```

- [ ] **Step 2: Commit changes**
  ```bash
  git add public/src/hooks/usePersistentFinanceQA.ts
  git commit -m "feat(qa): create usePersistentFinanceQA composite hook"
  ```

---

### Task 6: ConversationHistoryPanel UI Component

**Files:**

- Create: `public/src/components/ConversationHistoryPanel.tsx`

- [ ] **Step 1: Write ConversationHistoryPanel**
      Build a sleek Sidebar panel that shows the list of sessions grouped/formatted using `formatRelativeDate`, active session states, a "Nouvelle conversation" button, and delete icons on hover.
      Make it follow the AURUM design system (Gold/Ink theme, Glassmorphism, smooth animations).

  ```typescript
  import React from 'react';
  import { Plus, Trash2, MessageSquare } from 'lucide-react';
  import { formatRelativeDate } from '../utils/formatRelativeDate';
  import type { AISession } from '../hooks/useAISessions';

  interface ConversationHistoryPanelProps {
    sessions: AISession[];
    activeSessionId: string | null;
    onSelectSession: (id: string) => void;
    onStartNewSession: () => void;
    onDeleteSession: (id: string) => void;
  }

  export const ConversationHistoryPanel: React.FC<ConversationHistoryPanelProps> = ({
    sessions,
    activeSessionId,
    onSelectSession,
    onStartNewSession,
    onDeleteSession,
  }) => {
    return (
      <div className="w-80 border-r border-white/5 bg-ink flex flex-col h-full overflow-hidden shrink-0">
        <div className="p-4 border-b border-white/5">
          <button
            onClick={onStartNewSession}
            className="w-full flex items-center justify-center gap-2 bg-gold hover:bg-gold/90 text-ink font-bold px-4 py-2.5 rounded-control transition-colors text-sm uppercase italic tracking-tighter"
          >
            <Plus size={16} />
            Nouvelle conversation
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-4 no-scrollbar">
          {sessions.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 text-sm">
              Aucun historique
            </div>
          ) : (
            <div className="space-y-1">
              <div className="text-label font-bold text-zinc-500 uppercase tracking-widest text-[10px] px-3 mb-2">
                Conversations Récentes
              </div>
              {sessions.map((session) => {
                const isActive = session.id === activeSessionId;
                return (
                  <div
                    key={session.id}
                    className={`group relative flex items-center justify-between rounded-control p-3 cursor-pointer transition-all ${
                      isActive
                        ? 'bg-white/10 text-gold border border-white/10'
                        : 'text-zinc-400 hover:bg-white/5 hover:text-white border border-transparent'
                    }`}
                    onClick={() => onSelectSession(session.id)}
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-6">
                      <MessageSquare size={16} className={isActive ? 'text-gold' : 'text-zinc-500'} />
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium truncate">
                          {session.title || 'Conversation sans titre'}
                        </span>
                        <span className="text-[10px] text-zinc-500 mt-0.5">
                          {formatRelativeDate(session.updatedAt)}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('Supprimer cette conversation ?')) {
                          onDeleteSession(session.id);
                        }
                      }}
                      className="absolute right-3 opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 text-zinc-500 rounded transition-all"
                      title="Supprimer la conversation"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };
  ```

- [ ] **Step 2: Commit changes**
  ```bash
  git add public/src/components/ConversationHistoryPanel.tsx
  git commit -m "feat(ui): create ConversationHistoryPanel component"
  ```

---

### Task 7: FinanceQASection Desktop View Update

**Files:**

- Modify: `public/src/components/FinanceQASection.tsx`

- [ ] **Step 1: Update components to use persistent hook & sidebar**
      Replace `useFinanceQA` with `usePersistentFinanceQA`. Add state to toggle the history sidebar. Update the layout to place the history sidebar and chat area side-by-side. Add an clock/history toggle button in the header.

- [ ] **Step 2: Commit changes**
  ```bash
  git add public/src/components/FinanceQASection.tsx
  git commit -m "feat(ui): update FinanceQASection with conversation history sidebar"
  ```

---

### Task 8: QAScreen Mobile PWA View Update

**Files:**

- Modify: `public/src/mobile/screens/QAScreen.tsx`

- [ ] **Step 1: Integrate persistent QA hook and bottom sheet Modal**
      Replace `useFinanceQA` with `usePersistentFinanceQA`. Add a button in the header to open a bottom sheet modal (using `<Modal variant="sheet">`) containing the session list. Let users select or delete sessions inside the sheet.

- [ ] **Step 2: Commit changes**
  ```bash
  git add public/src/mobile/screens/QAScreen.tsx
  git commit -m "feat(ui): update mobile QAScreen to support conversation history sheet"
  ```

---

### Task 9: Test Suite Validation & Fix CI

**Files:**

- Create: `tests/hooks/usePersistentFinanceQA.test.tsx`
- Modify: `tests/components/mobile/QAScreen.test.tsx`

- [ ] **Step 1: Write usePersistentFinanceQA unit test**
      Write tests for the composition hook logic, mocking `useAuth` and Firestore calls.

- [ ] **Step 2: Update QAScreen test**
      Update the mocked hook in `tests/components/mobile/QAScreen.test.tsx` to match the new `usePersistentFinanceQA` interface.

- [ ] **Step 3: Run Vitest**
      Verify all tests pass:
      `npx vitest run`

- [ ] **Step 4: Commit changes**
  ```bash
  git add tests/
  git commit -m "test: add tests for usePersistentFinanceQA and update QAScreen tests"
  ```
