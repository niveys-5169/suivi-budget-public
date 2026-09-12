import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ArrowRightLeft, LayoutGrid, X, Hash, FileText } from 'lucide-react';
import { useGlobalSearch } from '../../../hooks/useGlobalSearch';
import type { SearchResult } from '../../../utils/searchGlobal';

import { formatCurrency } from '../../../lib/formatters';

const fmt = (n: number) => formatCurrency(n);

const TYPE_ICON: Record<SearchResult['type'], React.ReactNode> = {
  page: <LayoutGrid size={14} />,
  category: <Hash size={14} />,
  transaction: <ArrowRightLeft size={14} />,
};

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (tab: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ open, onClose, onNavigate }) => {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const results = useGlobalSearch(query);

  useEffect(() => {
    if (open) {
      setQuery('');
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setCursor(0);
  }, [results.length]);

  const handleSelect = useCallback(
    (r: SearchResult) => {
      if (r.tab) onNavigate(r.tab);
      onClose();
    },
    [onNavigate, onClose],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, results.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    }
    if (e.key === 'Enter' && results[cursor]) handleSelect(results[cursor]);
    if (e.key === 'Escape') onClose();
  };

  // Group results by type for display
  const pages = results.filter((r) => r.type === 'page');
  const categories = results.filter((r) => r.type === 'category');
  const transactions = results.filter((r) => r.type === 'transaction');
  const groups = [
    { label: 'Pages', items: pages },
    { label: 'Catégories', items: categories },
    { label: 'Transactions', items: transactions },
  ].filter((g) => g.items.length > 0);

  return (
    <AnimatePresence>
      {open && (
        /* Exception documentée au §6.6 de DESIGN_SYSTEM.md : palette de recherche
           alignée en haut, sans titre ni bouton fermer — le contrat header du
           composant shared/Modal ne s'y prête pas. Tokens (z-modal, backdrop,
           rounded-card) alignés sur le shell partagé. */
        <div
          className="fixed inset-0 z-modal flex items-start justify-center pt-[15vh] px-4"
          onClick={onClose}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onClose();
            if (e.key === 'Escape') onClose();
          }}
          role="button"
          tabIndex={0}
          aria-label="Fermer la modale"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-lg bg-bg border border-separator rounded-card overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleKeyDown}
          >
            {/* Input */}
            <div className="flex items-center gap-4 px-6 py-4 border-b border-separator">
              <Search size={18} className="text-white/30 flex-shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher une transaction, page, catégorie…"
                className="flex-1 bg-transparent text-sm font-medium text-white placeholder:text-label-tertiary outline-none"
                aria-label="Recherche globale"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="text-label-tertiary hover:text-white/50"
                >
                  <X size={16} />
                </button>
              )}
              <kbd className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 border border-separator text-caption font-semibold text-label-tertiary">
                Esc
              </kbd>
            </div>

            {/* Results */}
            {results.length > 0 && (
              <div className="py-4 max-h-[50vh] overflow-y-auto">
                {groups.map((group) => (
                  <div key={group.label}>
                    <p className="px-6 py-2 text-caption font-semibold text-label-tertiary">
                      {group.label}
                    </p>
                    {group.items.map((r) => {
                      const globalIdx = results.indexOf(r);
                      const isActive = globalIdx === cursor;
                      return (
                        <button
                          key={r.id}
                          onClick={() => handleSelect(r)}
                          onMouseEnter={() => setCursor(globalIdx)}
                          className={`w-full flex items-center gap-4 px-6 py-4 text-left transition-colors ${
                            isActive ? 'bg-gold/8' : 'hover:bg-surface'
                          }`}
                        >
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                              isActive ? 'bg-gold/15 text-gold' : 'bg-white/5 text-white/30'
                            }`}
                          >
                            {TYPE_ICON[r.type]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-sm font-bold truncate ${isActive ? 'text-white' : 'text-white/70'}`}
                            >
                              {r.label}
                            </p>
                            {r.sublabel && (
                              <p className="text-caption text-label-tertiary truncate">
                                {r.sublabel}
                              </p>
                            )}
                          </div>
                          {r.amount !== undefined && (
                            <span
                              className={`text-sm font-serif font-bold tabular-nums flex-shrink-0 ${r.amount < 0 ? 'text-negative' : 'text-positive'}`}
                            >
                              {fmt(r.amount)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}

            {query.length >= 2 && results.length === 0 && (
              <div className="py-12 text-center">
                <FileText size={28} className="mx-auto text-label-tertiary mb-4" />
                <p className="text-sm font-bold text-label-tertiary">
                  Aucun résultat pour « {query} »
                </p>
              </div>
            )}

            {/* Hint bar */}
            <div className="flex items-center gap-4 px-6 py-4 border-t border-separator">
              <span className="text-caption font-semibold text-label-tertiary flex items-center gap-2">
                <kbd className="px-2 py-1 rounded bg-white/5 border border-separator">↑↓</kbd>{' '}
                Naviguer
              </span>
              <span className="text-caption font-semibold text-label-tertiary flex items-center gap-2">
                <kbd className="px-2 py-1 rounded bg-white/5 border border-separator">↵</kbd> Ouvrir
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
