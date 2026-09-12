import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Settings, Trash2, BotMessageSquare, ExternalLink, History } from 'lucide-react';
import { usePersistentFinanceQA } from '../hooks/usePersistentFinanceQA';
import { ConversationHistoryPanel } from './ConversationHistoryPanel';
import type { ChatMessage } from '../hooks/useFinanceQA';
import { hideLoader } from '../utils/loader';
import { Modal } from './shared/Modal';
import { PageHeader } from './shared/PageHeader';
import { Card } from './shared/Card';
import { Button } from './shared/Button';
import { AISettingsForm } from './advanced/AISettingsForm';
import { useNavigate } from 'react-router-dom';

// --- Markdown renderer (safe — HTML-escaped first) ---
function renderMarkdown(text: string): string {
  const escaped = String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  return escaped
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^#{1,3}\s(.+)$/gm, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

// --- Suggested questions ---
const SUGGESTED_QUESTIONS = [
  'Combien ai-je dépensé en santé cette année ?',
  'Quelles sont mes 5 plus grosses catégories de dépenses ?',
  'Quel est mon solde global ?',
  'Compare mes dépenses de ce mois avec le mois dernier',
  'Donne-moi un résumé de mes finances de cette année',
];

// --- AI Settings Modal ---
interface AISettingsModalProps {
  onClose: () => void;
}

const AISettingsModal: React.FC<AISettingsModalProps> = ({ onClose }) => {
  const navigate = useNavigate();

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Paramètres IA"
      subtitle="Assistant & Intelligence"
      size="md"
      variant="centered"
    >
      <div className="p-8 space-y-8">
        <AISettingsForm onSave={onClose} showTitle={false} />

        <div className="pt-6 border-t border-separator">
          <button
            onClick={() => {
              onClose();
              navigate('/advanced?tab=api');
            }}
            className="flex items-center gap-2 text-caption font-semibold text-label/20 hover:text-gold transition-colors"
          >
            <ExternalLink size={12} />
            Accéder au laboratoire complet
          </button>
        </div>
      </div>
    </Modal>
  );
};

// --- Message bubble ---
const MessageBubble: React.FC<{ msg: ChatMessage }> = ({ msg }) => {
  const isUser = msg.role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[85%] px-4 py-4 rounded-card text-sm leading-relaxed ${
          isUser
            ? 'bg-gold text-bg rounded-br-none font-medium'
            : 'bg-white/5 border border-separator text-white rounded-bl-none'
        }`}
        dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
      />
    </motion.div>
  );
};

// --- Typing indicator ---
const TypingIndicator: React.FC = () => (
  <div className="flex justify-start">
    <div className="bg-white/5 border border-separator rounded-card rounded-bl-none px-4 py-4 flex gap-2 items-center">
      {[0, 200, 400].map((delay) => (
        <span
          key={delay}
          className="w-1.5 h-1.5 rounded-full bg-gold"
          style={{ animation: `qa-typing 1.4s ${delay}ms infinite both` }}
        />
      ))}
    </div>
  </div>
);

// --- Welcome message ---
const WelcomeMessage: React.FC<{ onSuggestion: (q: string) => void }> = ({ onSuggestion }) => (
  <div className="flex justify-start">
    <div className="max-w-[90%] bg-white/5 border border-separator rounded-card rounded-bl-none px-4 py-4 space-y-4">
      <p className="text-sm text-white/80 leading-relaxed">
        Pose-moi des questions sur tes finances. Par exemple :
      </p>
      <div className="flex flex-wrap gap-2">
        {SUGGESTED_QUESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => onSuggestion(q)}
            className="px-4 py-2 rounded-control text-caption bg-white/5 border border-separator text-label-secondary hover:border-gold hover:text-white transition-all"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  </div>
);

// --- Main component ---
export const FinanceQASection: React.FC = () => {
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
  const [input, setInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    hideLoader();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = useCallback(() => {
    const q = input.trim();
    if (!q || loading) return;
    setInput('');
    send(q);
  }, [input, loading, send]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestion = (q: string) => {
    setInput('');
    send(q);
    inputRef.current?.focus();
  };

  return (
    <>
      <div className="flex flex-col pt-0 h-[calc(100vh-84px)]">
        <PageHeader
          title="Assistant IA"
          subtitle="Analyse financière"
          icon={<BotMessageSquare size={20} />}
          rightActions={
            <>
              <Button
                variant="icon"
                size="sm"
                onClick={() => setShowHistory((h) => !h)}
                className={showHistory ? 'text-gold' : 'text-label-secondary'}
                title="Historique des conversations"
              >
                <History size={18} />
              </Button>
              {messages.length > 0 && (
                <Button
                  variant="icon"
                  size="sm"
                  onClick={clearChat}
                  title="Effacer la conversation"
                >
                  <Trash2 size={18} />
                </Button>
              )}
              <Button
                variant="icon"
                size="sm"
                onClick={() => setShowSettings(true)}
                title="Paramètres IA"
              >
                <Settings size={18} />
              </Button>
            </>
          }
        />

        {/* Content area: Sidebar + Chat */}
        <div className="flex-1 flex overflow-hidden pt-4 pb-safe mb-2 gap-4">
          {showHistory && (
            <ConversationHistoryPanel
              sessions={sessions}
              activeSessionId={activeSessionId}
              onSelectSession={selectSession}
              onStartNewSession={startNewSession}
              onDeleteSession={deleteSession}
            />
          )}
          <Card variant="subtle" padding="none" className="flex-1 flex flex-col overflow-hidden">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 md:p-4 space-y-4">
              {messages.length === 0 && <WelcomeMessage onSuggestion={handleSuggestion} />}
              <AnimatePresence initial={false}>
                {messages.map((msg, idx) => (
                  <MessageBubble key={idx} msg={msg} />
                ))}
              </AnimatePresence>
              {loading && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="shrink-0 p-4 border-t border-separator bg-surface flex items-center gap-4">
              <button
                onClick={() => setShowSettings(true)}
                className="shrink-0 text-gold/70 hover:text-gold transition-colors p-1"
                title="Paramètres IA"
              >
                <Settings size={18} />
              </button>

              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Posez une question sur vos finances..."
                disabled={loading}
                className="flex-1 bg-bg border border-separator rounded-control px-4 py-4 text-sm text-white placeholder:text-label-tertiary outline-none focus:border-gold transition-colors disabled:opacity-50"
              />

              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="shrink-0 text-gold disabled:text-label-tertiary hover:scale-110 transition-all p-1 disabled:cursor-not-allowed"
                title="Envoyer"
              >
                <Send size={20} />
              </button>
            </div>
          </Card>
        </div>
      </div>

      {/* Settings modal */}
      <AnimatePresence>
        {showSettings && <AISettingsModal onClose={() => setShowSettings(false)} />}
      </AnimatePresence>

      {/* Typing animation keyframes */}
      <style>{`
        @keyframes qa-typing {
          0%, 80%, 100% { transform: scale(0); opacity: 0.3; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </>
  );
};

export default FinanceQASection;
