import React from 'react';
import { motion } from 'framer-motion';
import { LayoutDashboard } from 'lucide-react';
import type { AnalyseTab } from './analyseTypes';

export type { AnalyseTab } from './analyseTypes';

interface Props {
  activeTab: AnalyseTab;
  onChange: (tab: AnalyseTab) => void;
}

export const AnalyseTabs: React.FC<Props> = ({ activeTab, onChange }) => {
  const tabs: Array<{ id: AnalyseTab; label: string; icon?: React.ReactNode }> = [
    { id: 'overview', label: '', icon: <LayoutDashboard size={16} /> },
    { id: 'entrees', label: 'Entrées' },
    { id: 'sorties', label: 'Sorties' },
  ];

  return (
    <div className="flex p-1 gap-1 bg-surface border border-separator rounded-lg">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={[
            'relative py-2 text-caption font-bold rounded-xl transition-colors duration-300',
            tab.id === 'overview' ? 'px-4' : 'flex-1',
            activeTab === tab.id
              ? 'text-bg'
              : 'text-label-tertiary hover:text-label-secondary hover:bg-white/5',
          ].join(' ')}
          aria-label={tab.label || "Vue d'ensemble"}
        >
          {activeTab === tab.id && (
            <motion.div
              layoutId="activeTabIndicator"
              className="absolute inset-0 bg-gold rounded-xl shadow-lg shadow-gold/20"
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            />
          )}
          <span className="relative z-10 flex items-center justify-center gap-1">
            {tab.icon}
            {tab.label}
          </span>
        </button>
      ))}
    </div>
  );
};
