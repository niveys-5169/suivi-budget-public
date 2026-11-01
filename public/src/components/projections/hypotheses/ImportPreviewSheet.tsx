import React from 'react';
import { Button, Modal, Sheet, Stack, Text, Badge } from '../../../ui';
import type { ProjectionImportResult } from '../../../types/banking.types';

interface Props {
  result: ProjectionImportResult | null;
  onApply: () => void;
  onCancel: () => void;
}

/** Aperçu de l'import : ce qui a été reconnu, les avertissements, puis application au brouillon. */
export const ImportPreviewSheet: React.FC<Props> = ({ result, onApply, onCancel }) => {
  const params = result?.params;
  const phases = params
    ? params.scenarios.reduce((n, s) => n + s.phases.length, params.revenusCommuns.phases.length)
    : 0;
  const lines: [string, number][] = params
    ? [
        ['Scénarios', params.scenarios.length],
        ['Phases de revenu', phases],
        ['Crédits', params.depenses.credits.length],
        ['Encaissements ponctuels', params.capital.encaissements.length],
      ]
    : [];

  return (
    <Modal
      isOpen={result !== null}
      onClose={onCancel}
      title="Aperçu de l'import"
      subtitle="Le fichier est lu dans votre navigateur et n'est jamais envoyé."
    >
      <Sheet.Body>
        <Stack gap="md">
          <Text variant="headline">{`${result?.reconnus.length ?? 0} paramètres reconnus`}</Text>
          {lines.map(([label, n]) => (
            <Stack key={label} direction="row" justify="between">
              <Text variant="callout" tone="secondary">
                {label}
              </Text>
              <Text variant="callout" numeric>
                {n}
              </Text>
            </Stack>
          ))}
          {result && result.avertissements.length > 0 && (
            <Stack gap="sm">
              <Badge tone="warning">{`${result.avertissements.length} avertissements`}</Badge>
              <ul className="flex max-h-48 flex-col gap-2 overflow-y-auto">
                {result.avertissements.map((message, i) => (
                  <li key={`${i}-${message}`}>
                    <Text variant="footnote" tone="secondary">
                      {message}
                    </Text>
                  </li>
                ))}
              </ul>
            </Stack>
          )}
        </Stack>
      </Sheet.Body>
      <Sheet.Footer>
        <Button onClick={onCancel}>Annuler</Button>
        <Button variant="primary" onClick={onApply}>
          Appliquer au brouillon
        </Button>
      </Sheet.Footer>
    </Modal>
  );
};
