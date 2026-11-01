import React, { useRef, useState } from 'react';
import { FileUp } from 'lucide-react';
import { Button, Input } from '../../../ui';
import { toast } from '../../../lib/toast';
import { importSimulationXlsx } from '../../../utils/projection/importSimulationXlsx';
import type { ProjectionImportResult, ProjectionParams } from '../../../types/banking.types';
import { ImportPreviewSheet } from './ImportPreviewSheet';

interface Props {
  /** Brouillon courant : l'import part de lui et conserve ce qu'il ne reconnaît pas. */
  base: ProjectionParams;
  onApply: (params: ProjectionParams) => void;
}

/** Import d'un classeur .xlsx de simulation. Lu localement dans le navigateur, jamais envoyé. */
export const ImportXlsxButton: React.FC<Props> = ({ base, onApply }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ProjectionImportResult | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      setResult(await importSimulationXlsx(await file.arrayBuffer(), base));
    } catch (err) {
      console.error('Error importing simulation workbook:', err);
      toast.error('Import impossible : fichier illisible ou format inattendu');
    } finally {
      setBusy(false);
    }
  };

  const apply = () => {
    if (!result) return;
    onApply(result.params);
    setResult(null);
    toast.info('Import appliqué au brouillon : pensez à enregistrer');
  };

  return (
    <>
      <Input
        ref={inputRef}
        type="file"
        accept=".xlsx"
        className="hidden"
        aria-label="Fichier de simulation (.xlsx)"
        onChange={handleFile}
      />
      <Button loading={busy} onClick={() => inputRef.current?.click()}>
        <FileUp size={18} aria-hidden="true" />
        Importer un classeur Excel
      </Button>
      <ImportPreviewSheet result={result} onApply={apply} onCancel={() => setResult(null)} />
    </>
  );
};
