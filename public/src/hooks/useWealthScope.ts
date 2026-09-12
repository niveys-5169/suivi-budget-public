import { useState, useEffect } from 'react';

export type OwnerScope = 'all' | string[];
export type WealthTypeScope = 'all' | string[];

const STORAGE_KEYS = {
  OWNER_SCOPE: 'app_owner_scope',
  WEALTH_TYPE_SCOPE: 'app_wealth_type_scope',
};

/**
 * État de filtrage propre au module Patrimoine : portée par propriétaire
 * (`ownerScope`) et par type d'actif (`wealthTypeScope`). Persisté en
 * localStorage. Volontairement hors de `AppStateContext` : l'application
 * n'est pas multi-utilisateur, seul le Patrimoine est multi-propriétaire.
 */
export const useWealthScope = () => {
  const [ownerScope, setOwnerScope] = useState<OwnerScope>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.OWNER_SCOPE);
    return saved ? JSON.parse(saved) : 'all';
  });
  const [wealthTypeScope, setWealthTypeScope] = useState<WealthTypeScope>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.WEALTH_TYPE_SCOPE);
    if (saved) {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) || parsed === 'all' ? parsed : 'all';
    }
    return 'all';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.OWNER_SCOPE, JSON.stringify(ownerScope));
  }, [ownerScope]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.WEALTH_TYPE_SCOPE, JSON.stringify(wealthTypeScope));
  }, [wealthTypeScope]);

  return { ownerScope, setOwnerScope, wealthTypeScope, setWealthTypeScope };
};
