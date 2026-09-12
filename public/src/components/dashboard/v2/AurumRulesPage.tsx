import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Modal } from '../../shared/Modal';
import {
  ChevronLeft,
  Plus,
  Trash2,
  Target,
  ShieldCheck,
  ArrowRight,
  Activity,
  Lightbulb,
  Check,
  X,
} from 'lucide-react';
import { useRules } from '../../../hooks/useRules';
import { useTransactionContext } from '../../../context/TransactionContext';
import { CategoryAutocomplete } from '../../budgets-v2/CategoryAutocomplete';

export const AurumRulesPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { rules, saveRule, removeRule, loading, suggestions } = useRules();
  const { transactions } = useTransactionContext();
  const [showAdd, setShowAdd] = useState(false);
  const [newRule, setNewRule] = useState({ pattern: '', category: '' });
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());

  const allCategories = useMemo(() => {
    const cats = new Set(transactions.map((t) => t.categorie).filter(Boolean) as string[]);
    return Array.from(cats).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [transactions]);

  const visibleSuggestions = useMemo(
    () => suggestions.filter((s) => !dismissedSuggestions.has(s.pattern)),
    [suggestions, dismissedSuggestions],
  );

  // Real-time rule testing
  const matchCount = useMemo(() => {
    if (!newRule.pattern || newRule.pattern.length < 3) return 0;
    const p = newRule.pattern.toLowerCase();
    return transactions.filter((t) => (t.libelle || '').toLowerCase().includes(p)).length;
  }, [newRule.pattern, transactions]);

  const handleAcceptSuggestion = async (pattern: string, category: string) => {
    await saveRule({ pattern, category });
    setDismissedSuggestions((prev) => new Set(prev).add(pattern));
  };

  const handleDismissSuggestion = (pattern: string) => {
    setDismissedSuggestions((prev) => new Set(prev).add(pattern));
  };

  const handleAdd = async () => {
    if (!newRule.pattern || !newRule.category) return;
    await saveRule(newRule);
    setNewRule({ pattern: '', category: '' });
    setShowAdd(false);
  };

  const modalContent = (
    <Modal
      isOpen={showAdd}
      onClose={() => setShowAdd(false)}
      title="Nouveau Protocole"
      subtitle="Définissez un mot-clé pour automatiser le classement."
      variant="sheet"
      size="md"
    >
      <div className="p-8 space-y-8">
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center ml-2">
              <label htmlFor="pattern-input" className="text-caption font-semibold text-white/30">
                Mot-clé détecté (Pattern)
              </label>
              {matchCount > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-2 px-2 py-1 rounded-lg bg-gold/10 border border-gold/20 text-gold"
                >
                  <Activity size={10} />
                  <span className="text-caption font-bold">{matchCount} flux impactés</span>
                </motion.div>
              )}
            </div>
            <input
              id="pattern-input"
              value={newRule.pattern}
              onChange={(e) => setNewRule({ ...newRule, pattern: e.target.value })}
              placeholder="Ex: Netflix, Uber, Amazon..."
              className="w-full h-16 rounded-lg bg-surface border border-separator px-6 text-sm font-semibold text-white outline-none focus:border-gold/30"
            />
          </div>
          <div className="space-y-4">
            <span className="text-caption font-semibold text-white/30 ml-2">Catégorie cible</span>
            <CategoryAutocomplete
              value={newRule.category}
              onChange={(cat) => setNewRule({ ...newRule, category: cat })}
              categories={allCategories}
              placeholder="Ex: Loisirs, Transport..."
              className="w-full h-16 rounded-lg bg-surface border border-separator px-6 text-sm font-semibold text-white outline-none focus:border-gold/30"
            />
          </div>
        </div>

        <div className="flex gap-4 mb-safe pb-[env(safe-area-inset-bottom)]">
          <button
            onClick={() => setShowAdd(false)}
            className="flex-1 h-16 rounded-lg bg-white/5 border border-separator text-caption font-semibold text-white/40"
          >
            Annuler
          </button>
          <button
            onClick={handleAdd}
            className="flex-1 h-16 rounded-lg bg-gold text-bg text-caption font-semibold shadow-gold/20"
          >
            Sauvegarder
          </button>
        </div>
      </div>
    </Modal>
  );
  // ... (rest of render logic remains, but with matchCount display in modal)

  return (
    <div className="min-h-screen bg-bg text-white font-sans overflow-x-hidden selection:bg-gold/30 pb-40">
      {/* Background Ambience */}
      <div className="fixed top-[-10%] left-[-10%] w-[60%] h-[50%] bg-gold/5 blur-[120px] rounded-full -z-10" />

      {/* Header */}
      <nav className="flex items-center justify-between px-6 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="w-12 h-12 rounded-lg bg-surface border border-separator flex items-center justify-center text-white/40 hover:text-white transition-all"
          >
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-2xl font-bold tracking-tighter text-white">Automatisations</h1>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="w-12 h-12 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center text-gold hover:bg-gold/20 transition-all shadow-lg shadow-gold/10"
        >
          <Plus size={24} />
        </button>
      </nav>

      <main className="px-6 space-y-8">
        {/* Rules Summary Card */}
        <section className="rounded-xl p-8 bg-gradient-to-br from-white/[0.05] to-transparent border border-separator backdrop-blur-xl">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-10 h-10 rounded-full bg-positive/10 flex items-center justify-center text-positive">
              <ShieldCheck size={20} />
            </div>
            <p className="text-sm font-bold text-white">Moteur de Catégorisation</p>
          </div>
          <p className="text-footnote text-white/50 leading-relaxed">
            Le moteur Aurum analyse chaque flux importé et applique vos règles de priorité pour
            classer vos dépenses sans intervention manuelle.
          </p>
          <div className="mt-8 flex items-center justify-between text-caption font-semibold text-label-tertiary">
            <span>{rules.length} règles actives</span>
            <span className="text-positive">Statut : Opérationnel</span>
          </div>
        </section>

        {/* Suggestions section */}
        {visibleSuggestions.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center gap-4 px-1">
              <Lightbulb size={14} className="text-gold/60" />
              <span className="text-caption font-semibold text-gold/60">
                Suggestions automatiques ({visibleSuggestions.length})
              </span>
            </div>
            {visibleSuggestions.map((s, i) => (
              <motion.div
                key={s.pattern}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center justify-between p-4 rounded-xl bg-gold/[0.03] border border-gold/[0.12]"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center text-gold flex-shrink-0">
                    <Lightbulb size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">{s.pattern}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <ArrowRight size={10} className="text-label-tertiary" />
                      <span className="text-caption font-semibold text-gold">{s.category}</span>
                      <span className="text-caption text-label-tertiary">· {s.count}×</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                  <button
                    onClick={() => handleAcceptSuggestion(s.pattern, s.category)}
                    className="w-9 h-9 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center text-gold hover:bg-gold/20 transition-all"
                    title="Créer cette règle"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={() => handleDismissSuggestion(s.pattern)}
                    className="w-9 h-9 rounded-xl bg-white/5 border border-separator flex items-center justify-center text-label-tertiary hover:text-white/50 transition-all"
                    title="Ignorer"
                  >
                    <X size={14} />
                  </button>
                </div>
              </motion.div>
            ))}
          </section>
        )}

        {/* Rules List */}
        <section className="space-y-4">
          {loading ? (
            <div className="text-center py-10 text-label-tertiary animate-pulse text-caption font-semibold">
              Chargement des protocoles...
            </div>
          ) : (
            rules.map((rule, i) => (
              <motion.div
                key={rule.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="group p-6 rounded-xl bg-surface border border-separator hover:bg-white/[0.04] transition-all flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center text-label-tertiary group-hover:text-gold transition-colors">
                    <Target size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white tracking-tight">{rule.pattern}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-caption font-semibold text-label-tertiary">
                        Assigner à
                      </span>
                      <ArrowRight size={10} className="text-label-tertiary" />
                      <span className="text-caption font-semibold text-gold">{rule.category}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => removeRule(rule.id)}
                  className="w-10 h-10 rounded-xl bg-white/5 border border-separator flex items-center justify-center text-label-tertiary hover:text-negative hover:bg-negative/10 hover:border-negative/20 transition-all opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={16} />
                </button>
              </motion.div>
            ))
          )}
        </section>
      </main>

      {modalContent}
    </div>
  );
};
