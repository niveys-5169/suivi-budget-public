import React, { useMemo } from 'react';
import { CHART_COLORS } from '../lib/colors';
import { motion } from 'framer-motion';
import { ChevronRight, Shield, TrendingUp, Wallet, PiggyBank, Briefcase } from 'lucide-react';

interface Account {
  id: string;
  name: string;
  ownerId: string;
  type: 'cash' | 'savings' | 'investissements' | 'retirement';
  balance: number;
}

interface WealthAccountsListProps {
  rows: Account[];
  onOpenAsset: (id: string) => void;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  cash: Wallet,
  savings: PiggyBank,
  investissements: TrendingUp,
  retirement: Shield,
};

const TYPE_LABELS: Record<string, string> = {
  cash: 'Liquidités',
  savings: 'Épargne',
  investissements: 'Investissements',
  retirement: 'Retraite',
};

export const OWNER_COLORS: Record<string, string> = {
  nicolas: CHART_COLORS.gold,
  sienna: '#8B5CF6',
  romane: '#EC4899',
  gwen: '#94A3B8',
  commun: '#E2E8F0',
};

export const WealthAccountsList: React.FC<WealthAccountsListProps> = ({ rows, onOpenAsset }) => {
  const grouped = useMemo(() => {
    const groups: Record<string, Account[]> = {
      cash: [],
      savings: [],
      investissements: [],
      retirement: [],
    };
    rows.forEach((row) => {
      if (groups[row.type]) groups[row.type]!.push(row);
      else groups.investissements!.push(row);
    });
    return groups;
  }, [rows]);

  const activeGroups = Object.entries(grouped).filter(([_, items]) => items.length > 0);

  return (
    <div className="space-y-12">
      {activeGroups.map(([type, items], groupIndex) => (
        <div key={type} className="space-y-6">
          <div className="flex items-center gap-4 px-2">
            <span className="text-caption font-semibold text-label/30">{TYPE_LABELS[type]}</span>
            <div className="h-px flex-1 bg-white/5" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {items.map((row, i) => {
              const Icon = TYPE_ICONS[row.type] || Briefcase;
              const ownerColor = OWNER_COLORS[row.ownerId] || '#888';

              return (
                <motion.button
                  key={row.id}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: groupIndex * 0.1 + i * 0.03 }}
                  onClick={() => onOpenAsset(row.id)}
                  className="w-full flex items-center justify-between p-6 md:p-8 rounded-xl bg-raised border border-separator hover:border-white/15 transition-all group"
                >
                  <div className="flex items-center gap-6">
                    <div className="w-14 h-14 rounded-lg flex items-center justify-center border border-separator bg-white/5 group-hover:scale-110 transition-transform">
                      <Icon
                        size={24}
                        className="text-label/40 group-hover:text-gold transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <p className="text-subhead font-bold text-white tracking-tight">{row.name}</p>
                      <div className="flex items-center gap-2">
                        <span
                          className="text-caption font-semibold px-2 py-1 rounded-md border border-current/20 bg-current/5"
                          style={{ color: ownerColor }}
                        >
                          {row.ownerId}
                        </span>
                        <span className="text-caption font-semibold text-label/20">{row.type}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <p className="text-lg font-bold text-white tabular-nums group-hover:text-gold transition-colors">
                      {row.balance.toLocaleString('fr-FR', {
                        style: 'currency',
                        currency: 'EUR',
                        maximumFractionDigits: 0,
                      })}
                    </p>
                    <ChevronRight
                      size={18}
                      className="text-label/10 group-hover:text-gold transition-colors"
                    />
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
