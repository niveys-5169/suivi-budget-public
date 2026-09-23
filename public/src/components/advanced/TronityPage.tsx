import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Settings } from 'lucide-react';
import { useAdvancedSettings } from '../../hooks/useAdvancedSettings';
import { PageShell, BackButton } from './PageShell';

export const TronityPage: React.FC = () => {
  const navigate = useNavigate();
  const { tronityConfig, loading, updateTronityConfig } = useAdvancedSettings();
  const [draft, setDraft] = useState(tronityConfig);
  const [saving, setSaving] = useState(false);

  // Le brouillon repart de la config à chaque nouvelle valeur Firestore.
  const [syncedConfig, setSyncedConfig] = useState(tronityConfig);
  if (tronityConfig && tronityConfig !== syncedConfig) {
    setSyncedConfig(tronityConfig);
    setDraft(tronityConfig);
  }

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await updateTronityConfig(draft);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !draft) {
    return (
      <PageShell title="Tronity" description="Réglages du flux d'import Tronity.">
        <div className="py-20 flex justify-center">
          <div className="w-10 h-10 border-2 border-gold/10 border-t-gold rounded-full animate-spin" />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Tronity"
      description="Configurez les tarifs et options d'importation Tronity."
    >
      <BackButton onBack={() => navigate('/advanced')} />
      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div className="space-y-6 p-8 rounded-xl bg-white/5 border border-separator">
          <div className="flex items-center gap-4 text-gold">
            <Zap size={20} />
            <span className="text-sm font-semibold">Tarification</span>
          </div>
          <label htmlFor="tarif-hp" className="block text-sm text-label/70">
            Tarif Heures Pleines (€/kWh)
          </label>
          <input
            id="tarif-hp"
            type="number"
            step="0.0001"
            value={draft.tarif_hp}
            onChange={(event) =>
              setDraft({ ...draft, tarif_hp: parseFloat(event.target.value) || 0 })
            }
            className="w-full h-16 rounded-lg bg-white/5 border border-separator px-4 text-base text-white focus:border-gold/30 outline-none"
          />
          <label htmlFor="tarif-hc" className="block text-sm text-label/70">
            Tarif Heures Creuses (€/kWh)
          </label>
          <input
            id="tarif-hc"
            type="number"
            step="0.0001"
            value={draft.tarif_hc}
            onChange={(event) =>
              setDraft({ ...draft, tarif_hc: parseFloat(event.target.value) || 0 })
            }
            className="w-full h-16 rounded-lg bg-white/5 border border-separator px-4 text-base text-white focus:border-gold/30 outline-none"
          />
          <label htmlFor="network-loss" className="block text-sm text-label/70">
            Pertes réseau corrigées (%)
          </label>
          <input
            id="network-loss"
            type="number"
            step="0.1"
            value={draft.network_loss_percent}
            onChange={(event) =>
              setDraft({ ...draft, network_loss_percent: parseFloat(event.target.value) || 0 })
            }
            className="w-full h-16 rounded-lg bg-white/5 border border-separator px-4 text-base text-white focus:border-gold/30 outline-none"
          />
          <label htmlFor="import-scope" className="block text-sm text-label/70">
            Périmètre d&apos;import
          </label>
          <select
            id="import-scope"
            value={draft.import_scope}
            onChange={(event) => setDraft({ ...draft, import_scope: event.target.value })}
            className="w-full h-16 rounded-lg bg-white/5 border border-separator px-4 text-base text-white focus:border-gold/30 outline-none"
          >
            <option value="all">Tous</option>
            <option value="home">Domicile uniquement</option>
          </select>
        </div>
        <div className="space-y-6 p-8 rounded-xl bg-white/5 border border-separator">
          <div className="flex items-center gap-4 text-gold">
            <Settings size={20} />
            <span className="text-sm font-semibold">Actions</span>
          </div>
          <p className="text-sm leading-6 text-label/70">
            Les paramètres Tronity sont sauvegardés dans Firestore et appliqués immédiatement à vos
            imports.
          </p>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full h-16 rounded-lg bg-gold text-bg font-semibold hover:bg-gold-light transition"
          >
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        </div>
      </div>
    </PageShell>
  );
};
