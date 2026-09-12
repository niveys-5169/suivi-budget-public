import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from './useAuth';

export interface GitHubSettings {
  github_owner: string;
  github_repo: string;
}

export interface TronityConfig {
  tarif_hp: number;
  tarif_hc: number;
  hc_plages: { start: string; end: string }[];
  network_loss_percent: number;
  import_scope: string;
}

export interface RAVConfig {
  revenu_mensuel_net: number;
  revenu_categories: string[];
  depense_categories: string[];
}

export interface OwnerMapping {
  owners: string[];
  accounts: Record<string, string>;
  savings_patterns: Record<string, string>;
  default_owner: string;
}

import { useGlobalData } from '../context/GlobalDataContext';
import { withRetry } from '../utils/withRetry';

/** Charge et persiste les réglages avancés de l'app (GitHub, Tronity, RAV config) depuis Firestore. */
export function useAdvancedSettings() {
  const { user } = useAuth();
  const { ravConfig: globalRavConfig, ownerMapping: globalOwnerMapping } = useGlobalData();
  const [githubSettings, setGithubSettings] = useState<GitHubSettings | null>(null);
  const [tronityConfig, setTronityConfig] = useState<TronityConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const ravConfig = globalRavConfig as RAVConfig | null;
  const ownerMapping = globalOwnerMapping as OwnerMapping | null;

  useEffect(() => {
    // Tronity Config (Global)
    const unsubTronity = onSnapshot(doc(db, 'config', 'tronity'), (docSnap) => {
      if (docSnap.exists()) {
        setTronityConfig(docSnap.data() as TronityConfig);
      } else {
        setTronityConfig({
          tarif_hp: 0.22,
          tarif_hc: 0.16,
          hc_plages: [{ start: '22:00', end: '06:00' }],
          network_loss_percent: 10,
          import_scope: 'home',
        });
      }
    });

    let unsubGithub = () => {};

    if (user) {
      // GitHub Settings (User specific)
      unsubGithub = onSnapshot(
        doc(db, 'user_settings', user.uid),
        (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setGithubSettings({
              github_owner: data.github_owner || '',
              github_repo: data.github_repo || '',
            });
          } else {
            setGithubSettings({ github_owner: '', github_repo: '' });
          }
          setLoading(false);
        },
        (err) => {
          console.error('>>> useAdvancedSettings: GitHub settings error:', err);
          setLoading(false);
        },
      );
    } else {
      setGithubSettings(null);
      setLoading(false);
    }

    return () => {
      unsubTronity();
      unsubGithub();
    };
  }, [user]);

  const updateGithubSettings = async (settings: Partial<GitHubSettings>) => {
    if (!user) return;
    await withRetry(() => setDoc(doc(db, 'user_settings', user.uid), settings, { merge: true }));
  };

  const updateTronityConfig = async (config: Partial<TronityConfig>) => {
    await withRetry(() => setDoc(doc(db, 'config', 'tronity'), config, { merge: true }));
  };

  const updateRavConfig = async (config: Partial<RAVConfig>) => {
    await withRetry(() => setDoc(doc(db, 'metadata', 'rav_config'), config, { merge: true }));
  };

  const updateOwnerMapping = async (mapping: Partial<OwnerMapping>) => {
    await withRetry(() =>
      setDoc(doc(db, 'metadata', 'account_owners_mapping'), mapping, { merge: true }),
    );
  };

  return {
    githubSettings,
    tronityConfig,
    ravConfig,
    ownerMapping,
    loading,
    updateGithubSettings,
    updateTronityConfig,
    updateRavConfig,
    updateOwnerMapping,
  };
}
