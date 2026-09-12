import React, { useMemo } from 'react';
import { Building2 } from 'lucide-react';
import { fmt } from '../../../utils/format';
import type { Transaction } from '../../../hooks/useTransactions';

interface Props {
  transactions: Transaction[];
  monthKey: string;
}

export const AccountsDrillDown: React.FC<Props> = ({ transactions, monthKey }) => {
  const accounts = useMemo(() => {
    const monthTx = transactions.filter((tx) => {
      const m = tx.moisAffectation || tx.date?.slice(0, 7);
      return m === monthKey;
    });

    const map: Record<string, { entrees: number; sorties: number; count: number }> = {};
    for (const tx of monthTx) {
      const compte = tx.compte || 'Compte inconnu';
      if (!map[compte]) map[compte] = { entrees: 0, sorties: 0, count: 0 };
      const amt = tx.montant || 0;
      if (amt >= 0) map[compte].entrees += amt;
      else map[compte].sorties += Math.abs(amt);
      map[compte].count += 1;
    }

    return Object.entries(map)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.sorties - a.sorties);
  }, [transactions, monthKey]);

  return (
    <div className="px-4 md:px-6 space-y-6 pt-6">
      <div className="p-4 text-center">
        <Building2 size={28} className="mx-auto text-label-tertiary mb-2" />
        <p className="font-bold text-label text-lg">
          {accounts.length} compte{accounts.length > 1 ? 's' : ''}
        </p>
        <p className="text-xs text-label-tertiary">actifs ce mois-ci</p>
      </div>

      <div className="divide-y divide-separator">
        {accounts.map((acc) => (
          <div key={acc.name} className="p-4 space-y-1">
            <p className="font-bold text-label text-sm truncate" title={acc.name}>
              {acc.name}
            </p>
            <p className="text-caption font-bold text-label-tertiary">
              {acc.count} transaction{acc.count > 1 ? 's' : ''}
            </p>
            <div className="flex justify-between text-xs pt-1">
              <span className="text-positive font-serif font-semibold">+{fmt(acc.entrees)}</span>
              <span className="text-negative font-serif font-semibold">−{fmt(acc.sorties)}</span>
            </div>
          </div>
        ))}
        {accounts.length === 0 && (
          <div className="py-12 text-center text-label-tertiary text-sm">Aucun compte</div>
        )}
      </div>
    </div>
  );
};
