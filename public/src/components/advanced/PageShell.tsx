import React from 'react';
import { ChevronLeft } from 'lucide-react';

export const PageShell: React.FC<{
  title: string;
  description?: string;
  children: React.ReactNode;
}> = ({ title, description, children }) => (
  <div className="flex flex-col gap-6 py-8">
    <div className="mb-8 flex items-start justify-between gap-6">
      <div>
        <h1 className="text-3xl font-semibold text-white tracking-tight">{title}</h1>
        {description && <p className="mt-4 text-sm text-label/70 max-w-2xl">{description}</p>}
      </div>
    </div>
    {children}
  </div>
);

export const BackButton: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <button
    type="button"
    onClick={onBack}
    className="inline-flex items-center gap-2 px-4 py-4 rounded-lg bg-white/5 border border-separator text-sm font-semibold text-label hover:bg-white/10 transition"
  >
    <ChevronLeft size={18} /> Retour
  </button>
);
