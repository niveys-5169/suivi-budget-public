import React from 'react';
import { motion } from 'framer-motion';
import { Bell, AlertCircle, Info, CheckCircle2, ChevronRight, Zap, TrendingUp } from 'lucide-react';
import { useAlerts } from '../../../hooks/useAlerts';
import type { Alert } from '../../../types/banking.types';

const ICON_MAP: Record<Alert['type'], React.ReactNode> = {
  error: <AlertCircle size={20} />,
  warning: <Zap size={20} />,
  info: <Info size={20} />,
  success: <CheckCircle2 size={20} />,
};

const COLOR_MAP: Record<Alert['type'], string> = {
  error: 'bg-negative/10 text-negative',
  warning: 'bg-gold/10 text-gold',
  info: 'bg-blue-500/10 text-blue-400',
  success: 'bg-positive/10 text-positive',
};

interface Props {
  onBack: () => void;
  onNavigate?: (tab: string) => void;
}

export const AurumNotificationPage: React.FC<Props> = ({ onNavigate }) => {
  const { alerts } = useAlerts();

  return (
    <div className="min-h-screen bg-bg text-white font-sans overflow-x-hidden selection:bg-gold/30 pb-40">
      <div className="fixed top-[-10%] left-[-10%] w-[60%] h-[50%] bg-blue-600/5 blur-[120px] rounded-full -z-10" />

      <nav className="flex items-center justify-between px-6 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-8">
        <h1 className="text-3xl font-bold tracking-tighter text-white">Centre d&apos;Alertes</h1>
        <div className="w-12 h-12 rounded-lg bg-surface border border-separator flex items-center justify-center text-white/50">
          <Bell size={22} />
        </div>
      </nav>

      <main className="px-6 space-y-8">
        {alerts.length === 0 && (
          <div className="py-20 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-white/5 mx-auto flex items-center justify-center text-label-tertiary">
              <Bell size={32} />
            </div>
            <p className="text-sm font-bold text-label-tertiary">Aucune nouvelle alerte</p>
          </div>
        )}

        <div className="space-y-4">
          {alerts.map((alert, i) => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="relative group p-6 rounded-xl bg-surface border border-separator hover:bg-white/[0.04] transition-all flex items-start gap-6"
              onClick={() => alert.actionTab && onNavigate?.(alert.actionTab)}
              style={{ cursor: alert.actionTab ? 'pointer' : 'default' }}
            >
              <div
                className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 shadow-lg ${COLOR_MAP[alert.type]}`}
              >
                {ICON_MAP[alert.type]}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex justify-between items-start">
                  <p className="text-sm font-bold text-white tracking-tight">{alert.title}</p>
                  <span className="text-caption font-semibold text-label-tertiary">
                    {alert.time}
                  </span>
                </div>
                <p className="text-footnote text-white/40 leading-relaxed pr-4">{alert.desc}</p>
                {alert.actionTab && (
                  <p className="text-caption font-semibold text-gold/50 mt-1">Voir →</p>
                )}
              </div>
              <div className="self-center opacity-0 group-hover:opacity-100 transition-opacity">
                <ChevronRight size={18} className="text-label-tertiary" />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Optimisation Aurum card */}
        <section className="pt-10">
          <div className="rounded-xl p-8 bg-gradient-to-br from-white/[0.05] to-transparent border border-separator backdrop-blur-xl space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center text-gold">
                <TrendingUp size={20} />
              </div>
              <p className="text-sm font-bold text-white">Optimisation Aurum</p>
            </div>
            <p className="text-footnote text-white/50 leading-relaxed">
              Votre assistant IA analyse vos flux et peut détecter des anomalies dans vos frais
              bancaires.
            </p>
            <button
              onClick={() => onNavigate?.('ai')}
              className="w-full h-14 rounded-lg bg-surface border border-separator text-caption font-semibold hover:bg-white/10 transition-all"
            >
              Analyser avec l&apos;IA
            </button>
          </div>
        </section>
      </main>
    </div>
  );
};
