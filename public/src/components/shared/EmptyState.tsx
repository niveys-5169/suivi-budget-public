import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

/** Composant d'état vide réutilisable avec icône, titre, description et CTA optionnel. */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = '',
}) => (
  <div className={`flex flex-col items-center justify-center py-16 px-8 text-center ${className}`}>
    {icon && (
      <div className="w-16 h-16 rounded-full bg-white/5 border border-separator flex items-center justify-center mb-6 text-label/30">
        {icon}
      </div>
    )}
    <p className="text-caption font-semibold text-label-tertiary mb-2">{title}</p>
    {description && (
      <p className="text-caption text-label-tertiary max-w-xs leading-relaxed">{description}</p>
    )}
    {action && (
      <button
        type="button"
        onClick={action.onClick}
        className="mt-6 h-10 px-6 rounded-xl bg-gold/10 border border-gold/30 text-gold text-caption font-semibold hover:bg-gold hover:text-bg transition-all"
      >
        {action.label}
      </button>
    )}
  </div>
);
