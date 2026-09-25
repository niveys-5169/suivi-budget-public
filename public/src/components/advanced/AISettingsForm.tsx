import React from 'react';
import { BrainCircuit } from 'lucide-react';
import { AIProvidersForm } from './AIProvidersForm';

interface AISettingsFormProps {
  onSave?: () => void;
  showTitle?: boolean;
}

export const AISettingsForm: React.FC<AISettingsFormProps> = ({ onSave, showTitle = true }) => (
  <div className="space-y-10">
    {showTitle && (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-4">
          <BrainCircuit size={20} className="text-gold" />
          Intelligence Artificielle
        </h2>
        <p className="text-caption font-medium text-label/40 leading-relaxed max-w-2xl">
          Configurez vos accès aux modèles de langage pour l&apos;assistant financier et la
          catégorisation automatique.
        </p>
      </div>
    )}
    <AIProvidersForm onSaved={onSave} />
  </div>
);
