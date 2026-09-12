import React from 'react';
import { Upload } from 'lucide-react';

interface AuditImportButtonProps {
  onClick: () => void;
}

export const AuditImportButton: React.FC<AuditImportButtonProps> = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gold/10 border border-gold/20 text-gold text-caption font-semibold hover:bg-gold/20 transition-all"
      title="Importer un audit patrimonial en Excel"
    >
      <Upload size={12} />
      Import Audit
    </button>
  );
};
