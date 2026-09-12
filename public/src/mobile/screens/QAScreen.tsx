import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MScreenHeader } from '../components/MScreenHeader';
import { MAIConfigSheet } from '../components/MAIConfigSheet';
import { usePersistentFinanceQA } from '../../hooks/usePersistentFinanceQA';
import { Settings, Trash, Send, ChevronLeft, History, Plus } from 'lucide-react';
import { Modal } from '../../components/shared/Modal';
import { formatRelativeDate } from '../../utils/formatRelativeDate';
import { confirm } from '../../lib/confirm';

const SUGGESTED_QUESTIONS = [
  'Combien ai-je dépensé en santé cette année ?',
  'Quelles sont mes 5 plus grosses catégories de dépenses ?',
  'Quel est mon solde global ?',
  'Compare mes dépenses de ce mois avec le mois dernier',
  'Donne-moi un résumé de mes finances de cette année',
];

export function QAScreen() {
  const navigate = useNavigate();
  const {
    messages,
    loading,
    send,
    clearChat,
    sessions,
    activeSessionId,
    selectSession,
    startNewSession,
    deleteSession,
  } = usePersistentFinanceQA();
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = () => {
    if (!input.trim() || loading) return;
    send(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const parseMarkdown = (text: string) => {
    // Échappement HTML avant conversion : la réponse du LLM est injectée via
    // dangerouslySetInnerHTML (même règle que renderMarkdown côté desktop).
    const escaped = String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    let parsed = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    parsed = parsed.replace(/\n/g, '<br/>');
    return parsed;
  };

  return (
    <div className="flex flex-col h-full bg-bg">
      <MScreenHeader
        title="Assistant IA"
        leftAction={
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-label-secondary">
            <ChevronLeft size={24} />
          </button>
        }
        rightAction={
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsHistoryOpen(true)}
              className="text-label-secondary"
              title="Historique"
            >
              <History size={20} />
            </button>
            {messages.length > 0 && (
              <button onClick={clearChat} className="text-label-secondary">
                <Trash size={20} />
              </button>
            )}
            <button onClick={() => setIsConfigOpen(true)} className="text-label-secondary">
              <Settings size={20} />
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col gap-2 mt-4">
            {SUGGESTED_QUESTIONS.map((q, i) => (
              <button
                key={i}
                onClick={() => send(q)}
                className="text-left p-4 bg-white/5 border border-separator rounded-xl text-label-secondary text-sm"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`p-4 text-sm max-w-[85%] ${
                msg.role === 'user'
                  ? 'bg-gold text-bg rounded-lg rounded-br-none'
                  : 'bg-white/5 border border-separator text-white rounded-lg rounded-bl-none'
              }`}
              dangerouslySetInnerHTML={{ __html: parseMarkdown(msg.content) }}
            />
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="p-4 bg-white/5 border border-separator rounded-lg rounded-bl-none">
              <span className="animate-pulse text-label-secondary">...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-separator px-4 py-4 flex gap-2 items-center bg-bg">
        <textarea
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Posez une question sur vos finances..."
          className="flex-1 bg-white/5 border border-separator rounded-lg px-4 py-4 text-white text-base focus:outline-none resize-none"
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="p-4 bg-gold text-bg rounded-xl disabled:opacity-50 disabled:bg-zinc-700 disabled:text-label-tertiary"
        >
          <Send size={20} />
        </button>
      </div>

      {isConfigOpen && <MAIConfigSheet onClose={() => setIsConfigOpen(false)} />}

      {isHistoryOpen && (
        <Modal
          isOpen
          onClose={() => setIsHistoryOpen(false)}
          title="Historique IA"
          subtitle="Conversations passées"
          variant="sheet"
        >
          <div className="p-4 space-y-4">
            <button
              onClick={() => {
                startNewSession();
                setIsHistoryOpen(false);
              }}
              className="w-full flex items-center justify-center gap-2 bg-gold text-bg font-bold px-4 py-4 rounded-xl transition-colors text-sm tracking-tighter"
            >
              <Plus size={16} />
              Nouvelle conversation
            </button>

            <div className="space-y-2 max-h-[50dvh] overflow-y-auto no-scrollbar">
              {sessions.length === 0 ? (
                <div className="text-center py-8 text-label-tertiary text-sm">Aucun historique</div>
              ) : (
                sessions.map((session) => {
                  const isActive = session.id === activeSessionId;
                  return (
                    <div
                      key={session.id}
                      className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                        isActive
                          ? 'bg-white/10 text-gold border-separator'
                          : 'bg-white/5 text-label-secondary border-transparent'
                      }`}
                    >
                      <button
                        type="button"
                        className="flex-1 min-w-0 pr-4 text-left focus:outline-none"
                        onClick={() => {
                          selectSession(session.id);
                          setIsHistoryOpen(false);
                        }}
                      >
                        <div className="text-sm font-medium truncate">
                          {session.title || 'Conversation sans titre'}
                        </div>
                        <div className="text-caption text-label-tertiary mt-1">
                          {formatRelativeDate(session.updatedAt)}
                        </div>
                      </button>

                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (
                            await confirm({
                              message: 'Supprimer cette conversation ?',
                              danger: true,
                            })
                          ) {
                            deleteSession(session.id);
                          }
                        }}
                        className="p-2 text-label-tertiary hover:text-negative"
                        title="Supprimer"
                      >
                        <Trash size={16} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
