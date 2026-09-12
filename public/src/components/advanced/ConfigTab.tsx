import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useIntl } from 'react-intl';
import {
  Settings2,
  ArrowRightLeft,
  ShieldCheck,
  BrainCircuit,
  AlertCircle,
  Mail,
} from 'lucide-react';
import { usePreferences } from '../../hooks/usePreferences';

export const ConfigTab: React.FC = () => {
  const navigate = useNavigate();
  const { density, setDensity } = usePreferences();
  const { formatMessage: t } = useIntl();

  return (
    <div className="space-y-10">
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-4">
          <Settings2 size={20} className="text-gold" />
          Affichage
        </h2>
        <p className="text-caption font-medium text-label/40 leading-relaxed max-w-2xl">
          Choisissez la densité d&apos;information à l&apos;écran. Le mode compact resserre les
          lignes, les cartes et le rythme vertical des écrans — idéal sur grands volumes de
          transactions.
        </p>
      </div>

      <fieldset
        className="p-6 rounded-lg bg-white/5 border border-separator space-y-4"
        aria-label={t({ id: 'settings.density.label' })}
      >
        <legend className="px-2 text-caption font-semibold text-label/40">
          {t({ id: 'settings.density.label' })}
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" role="radiogroup">
          {(
            [
              {
                value: 'comfortable',
                label: t({ id: 'settings.density.comfortable' }),
                hint: 'Espacement large',
              },
              {
                value: 'compact',
                label: t({ id: 'settings.density.compact' }),
                hint: 'Plus d’info à l’écran',
              },
            ] as const
          ).map((option) => {
            const selected = density === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setDensity(option.value)}
                className={`text-left p-4 rounded-xl border transition-all ${
                  selected
                    ? 'bg-gold/10 border-gold/40 text-gold'
                    : 'bg-white/5 border-separator text-label/60 hover:border-white/15 hover:text-label'
                }`}
              >
                <span className="block text-caption font-semibold">{option.label}</span>
                <span className="block mt-1 text-caption text-label/40 normal-case tracking-normal">
                  {option.hint}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-4">
          <Settings2 size={20} className="text-gold" />
          Configuration des Modules
        </h2>
        <p className="text-caption font-medium text-label/40 leading-relaxed max-w-2xl">
          Accédez aux interfaces de gestion héritées pour le paramétrage fin du système.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { label: 'Fusion de Catégories', target: 'fusion', icon: ArrowRightLeft },
          { label: 'Mapping des Comptes', target: 'mappings', icon: ShieldCheck },
          { label: 'Règles Automatiques', target: 'rules', icon: BrainCircuit },
          { label: 'Historique Gmail', target: 'reparse', icon: Mail },
          { label: 'Emails Exclus', target: 'excluded', icon: Mail },
        ].map((item) => (
          <button
            key={item.target}
            onClick={() => navigate(`/${item.target}`)}
            className="flex items-center justify-between p-6 rounded-lg bg-white/5 border border-separator hover:bg-white/10 hover:border-separator transition-all text-left"
          >
            <div className="flex items-center gap-4">
              <item.icon size={16} className="text-label/40" />
              <span className="text-caption font-bold text-white">{item.label}</span>
            </div>
            <AlertCircle size={14} className="text-gold/40" />
          </button>
        ))}
      </div>
    </div>
  );
};
