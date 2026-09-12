import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Send, Sparkles, Settings, Trash2, HelpCircle } from 'lucide-react';
import { usePersistentFinanceQA as useFinanceQA } from '../../../hooks/usePersistentFinanceQA';
import { useNavigate } from 'react-router-dom';

// --- Markdown renderer (minimal for v2) ---
function renderMarkdown(text: string): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

export const AurumAIPage: React.FC = () => {
  const navigate = useNavigate();
  const { messages, loading, send, clearChat } = useFinanceQA();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (text: string = input) => {
    const q = text.trim();
    if (!q || loading) return;
    setInput('');
    await send(q);
  };

  const suggestions = [
    'Quel est mon solde global ?',
    'Évolution de mon épargne sur 30 jours par propriétaire',
    'Top 5 catégories de dépenses',
    'Répartition de mon patrimoine, retraite à part',
  ];

  return (
    <div className="min-h-screen bg-bg text-white font-sans overflow-hidden flex flex-col selection:bg-gold/30">
      {/* Background Ambience */}
      <div className="fixed top-[-10%] left-[-10%] w-[60%] h-[50%] bg-gold/5 blur-[120px] rounded-full -z-10" />

      {/* Header */}
      <nav className="flex items-center justify-between px-6 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-6 bg-bg/80 backdrop-blur-xl border-b border-separator">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center text-gold">
            <Sparkles size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Aurum Intelligence</h1>
            <p className="text-caption font-semibold text-label-tertiary">Private Assistant</p>
          </div>
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => navigate('/advanced?tab=api')}
            className="w-11 h-11 rounded-xl bg-surface border border-separator flex items-center justify-center text-white/40 hover:text-white transition-all"
          >
            <Settings size={20} />
          </button>
          <button
            onClick={clearChat}
            className="w-11 h-11 rounded-xl bg-surface border border-separator flex items-center justify-center text-white/40 hover:text-negative transition-all"
          >
            <Trash2 size={20} />
          </button>
        </div>
      </nav>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto px-6 py-10 space-y-8 no-scrollbar pb-40">
        {messages.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-10 pt-10"
          >
            <div className="space-y-4">
              <h2 className="text-3xl font-bold tracking-tighter">Comment puis-je vous aider ?</h2>
              <p className="text-sm text-white/40 leading-relaxed max-w-[280px]">
                Posez des questions complexes sur vos flux, vos budgets ou votre patrimoine.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(s)}
                  className="w-full p-6 rounded-lg bg-surface border border-separator text-left hover:bg-white/[0.04] hover:border-gold/20 transition-all group flex items-center justify-between"
                >
                  <span className="text-sm font-semibold text-white/70 group-hover:text-white">
                    {s}
                  </span>
                  <HelpCircle
                    size={16}
                    className="text-label-tertiary group-hover:text-gold transition-colors"
                  />
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
            animate={{ opacity: 1, x: 0 }}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-xl p-6 ${msg.role === 'user' ? 'bg-white/[0.04] border border-separator text-white' : 'bg-gold/5 border border-gold/10 text-gold/90'}`}
            >
              <p
                className="text-footnote leading-relaxed font-medium"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
              />
            </div>
          </motion.div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-surface border border-separator rounded-xl p-6 flex gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-gold/40 animate-bounce" />
              <div className="w-1.5 h-1.5 rounded-full bg-gold/40 animate-bounce [animation-delay:0.2s]" />
              <div className="w-1.5 h-1.5 rounded-full bg-gold/40 animate-bounce [animation-delay:0.4s]" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Input Area */}
      <div className="fixed bottom-[calc(7rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 w-[88%] max-w-lg px-2">
        <div className="relative group">
          <div className="absolute -inset-1 bg-gold/20 blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Posez votre question..."
            className="relative w-full h-18 rounded-xl bg-[#121622] border border-separator pl-8 pr-20 text-sm font-semibold text-white focus:outline-none focus:border-gold/40 transition-all"
          />
          <button
            onClick={() => handleSend()}
            className="absolute right-3 top-2 w-14 h-14 rounded-lg bg-gold text-bg flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg shadow-gold/20"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};
