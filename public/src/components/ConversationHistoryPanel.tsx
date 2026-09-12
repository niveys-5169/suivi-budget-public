import React from 'react';
import { Plus, Trash2, MessageSquare } from 'lucide-react';
import { formatRelativeDate } from '../utils/formatRelativeDate';
import type { AISession } from '../hooks/useAISessions';
import { confirm } from '../lib/confirm';

interface ConversationHistoryPanelProps {
  sessions: AISession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onStartNewSession: () => void;
  onDeleteSession: (id: string) => void;
}

/** Panneau Desktop pour l'historique des conversations de l'assistant financier IA */
export const ConversationHistoryPanel: React.FC<ConversationHistoryPanelProps> = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onStartNewSession,
  onDeleteSession,
}) => {
  return (
    <div className="w-80 border-r border-separator bg-bg flex flex-col h-full overflow-hidden shrink-0">
      <div className="p-4 border-b border-separator">
        <button
          onClick={onStartNewSession}
          className="w-full flex items-center justify-center gap-2 bg-gold hover:bg-gold/90 text-bg font-bold px-4 py-2 rounded-control transition-colors text-sm tracking-tighter"
        >
          <Plus size={16} />
          Nouvelle conversation
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
        {sessions.length === 0 ? (
          <div className="text-center py-8 text-label-tertiary text-sm">Aucun historique</div>
        ) : (
          <div className="space-y-1">
            <div className="text-caption font-bold text-label-tertiary text-caption px-4 mb-2">
              Conversations Récentes
            </div>
            {sessions.map((session) => {
              const isActive = session.id === activeSessionId;
              return (
                <div
                  key={session.id}
                  className={`group relative flex items-center justify-between rounded-control p-4 transition-all ${
                    isActive
                      ? 'bg-white/10 text-gold border border-separator'
                      : 'text-label-secondary hover:bg-white/5 hover:text-white border border-transparent'
                  }`}
                >
                  <button
                    type="button"
                    className="flex-1 min-w-0 pr-6 text-left flex items-center gap-4 focus:outline-none"
                    onClick={() => onSelectSession(session.id)}
                  >
                    <MessageSquare
                      size={16}
                      className={isActive ? 'text-gold' : 'text-label-tertiary'}
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium truncate">
                        {session.title || 'Conversation sans titre'}
                      </span>
                      <span className="text-caption text-label-tertiary mt-1">
                        {formatRelativeDate(session.updatedAt)}
                      </span>
                    </div>
                  </button>

                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (
                        await confirm({ message: 'Supprimer cette conversation ?', danger: true })
                      ) {
                        onDeleteSession(session.id);
                      }
                    }}
                    className="absolute right-3 opacity-0 group-hover:opacity-100 p-1 hover:text-negative text-label-tertiary rounded transition-all"
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
