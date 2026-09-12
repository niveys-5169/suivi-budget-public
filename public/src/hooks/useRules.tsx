import { useState, useEffect, useMemo } from 'react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  setDoc,
  deleteDoc,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { useTransactionContext } from '../context/TransactionContext';
import { computeRuleSuggestions, type RuleSuggestion } from '../utils/computeRuleSuggestions';
import { withRetry } from '../utils/withRetry';

export interface AutoRule {
  id: string;
  pattern: string;
  category: string;
  priority: number;
  isActive: boolean;
}

/** Charge et expose les règles de catégorisation automatique depuis Firestore. */
export const useRules = () => {
  const [rules, setRules] = useState<AutoRule[]>([]);
  const [loading, setLoading] = useState(true);
  const { transactions } = useTransactionContext();

  useEffect(() => {
    const q = query(collection(db, 'auto_categorization_rules'), orderBy('priority', 'asc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as AutoRule[];
      setRules(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const suggestions: RuleSuggestion[] = useMemo(
    () => computeRuleSuggestions(transactions, rules),
    [transactions, rules],
  );

  const saveRule = async (rule: Partial<AutoRule> & { id?: string }) => {
    if (rule.id) {
      const id = rule.id;
      await withRetry(() =>
        setDoc(
          doc(db, 'auto_categorization_rules', id),
          { ...rule, updatedAt: serverTimestamp() },
          { merge: true },
        ),
      );
    } else {
      await addDoc(collection(db, 'auto_categorization_rules'), {
        ...rule,
        isActive: true,
        priority: rules.length + 1,
        createdAt: serverTimestamp(),
      });
    }
  };

  const removeRule = async (id: string) => {
    await withRetry(() => deleteDoc(doc(db, 'auto_categorization_rules', id)));
  };

  return { rules, saveRule, removeRule, loading, suggestions };
};
