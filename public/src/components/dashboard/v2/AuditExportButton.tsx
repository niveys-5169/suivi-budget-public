import React from 'react';
import { Download } from 'lucide-react';
import { exportPlacementHistory } from '../../../utils/positionsHistoryExcel';
import type { WealthHistoryEntry } from '../../../types/patrimoine';

interface AuditExportButtonProps {
  placementHistory: WealthHistoryEntry[];
}

export const AuditExportButton: React.FC<AuditExportButtonProps> = ({ placementHistory }) => {
  return (
    <button
      onClick={() => exportPlacementHistory(placementHistory)}
      disabled={!placementHistory?.length}
      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gold/10 border border-gold/20 text-gold text-caption font-semibold hover:bg-gold/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
      title="Exporter l'audit patrimonial en Excel"
    >
      <Download size={12} />
      Export Audit
    </button>
  );
};
