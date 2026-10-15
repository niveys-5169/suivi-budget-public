import React, { useState } from 'react';
import { Section, Button, Text, Stack, Select } from '../../ui';
import { useBankingData } from '../../hooks/useBankingData';
import { reconcileBanking } from '../../services/banking-api';
import type { BankSuggestion } from '../../types/banking.types';
import { toast } from '../../lib/toast';
import { BankObservationDates } from './BankObservationDates';

export const BankReconciliationPanel: React.FC = () => {
  const { reports } = useBankingData();
  const [busy, setBusy] = useState(false);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const apply = async (suggestion: BankSuggestion, action: 'confirm' | 'distinct' | 'unlink') => {
    setBusy(true);
    try {
      await reconcileBanking(suggestion, action, choices[suggestion.enableObservationId]);
      toast.success('Rapprochement mis à jour.');
    } catch {
      toast.error(
        'Rapprochement impossible. Vérifiez les modifications et résolvez tout rattachement à plusieurs récurrences dans la page Récurrences.',
      );
    } finally {
      setBusy(false);
    }
  };
  const reconciliation = reports.find((report) => report.id === 'reconciliation');
  return (
    <Section title="Vérification Linxo">
      <Text tone="secondary">
        Les correspondances incertaines ne sont pas fusionnées automatiquement. Le contrôle porte
        sur les notifications Linxo reçues.
      </Text>
      {(reconciliation?.suggestions ?? []).map((suggestion) => (
        <div
          className="space-y-2"
          key={`${suggestion.enableObservationId}:${suggestion.linxoObservationId}`}
        >
          <Text>
            {suggestion.compte} · {suggestion.montant} €
          </Text>
          <Text tone="secondary">
            Enable Banking : {suggestion.enableLabel} ·{' '}
            {suggestion.kind === 'transition' ? 'Opération provisoire antérieure' : 'Linxo'} :{' '}
            {suggestion.linxoLabel}
          </Text>
          <BankObservationDates details={suggestion} />
          {suggestion.canonicalRows && (
            <Stack gap="sm">
              <Text>
                Deux lignes existent. Choisissez les modifications à conserver ; l’autre ligne sera
                fusionnée avec une trace de cette décision.
              </Text>
              {suggestion.canonicalRows.map((row) => (
                <Text key={row.id} variant="caption">
                  {row.date} · {row.compte} · {row.montant} € · {row.libelle} · {row.categorie} ·{' '}
                  {row.commentaire} · {row.pointe ? 'Pointée' : 'Non pointée'} ·{' '}
                  {row.moisAffectation ?? 'Mois de l’opération'} ({row.id})
                </Text>
              ))}
              <Select
                aria-label="Modifications à conserver"
                value={choices[suggestion.enableObservationId] ?? ''}
                onChange={(event) =>
                  setChoices((old) => ({
                    ...old,
                    [suggestion.enableObservationId]: event.target.value,
                  }))
                }
              >
                <option value="">Choisir la ligne conservée</option>
                {suggestion.canonicalRows.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.libelle} · {row.categorie} · {row.id}
                  </option>
                ))}
              </Select>
            </Stack>
          )}
          <Stack direction="row" gap="sm">
            <Button
              disabled={
                busy || (!!suggestion.canonicalRows && !choices[suggestion.enableObservationId])
              }
              onClick={() => apply(suggestion, 'confirm')}
            >
              Confirmer
            </Button>
            <Button disabled={busy} variant="plain" onClick={() => apply(suggestion, 'distinct')}>
              Opérations distinctes
            </Button>
          </Stack>
        </div>
      ))}
      {(reconciliation?.matches ?? []).map((match) => (
        <div className="space-y-2" key={match.enableObservationId}>
          <Text>
            {match.compte} · {match.enableLabel} : retrouvé dans Linxo
          </Text>
          <BankObservationDates details={match} />
          <Button disabled={busy} variant="plain" onClick={() => apply(match, 'unlink')}>
            Délier
          </Button>
        </div>
      ))}
      {(reconciliation?.waiting ?? []).map((pending) => (
        <div className="space-y-2" key={pending.id}>
          <Text>
            {pending.compte} · {pending.libelle} · {pending.montant} € ·{' '}
            {pending.bankStatus === 'pending' ? 'Opération provisoire' : 'Comptabilisée'} · En
            attente de Linxo
          </Text>
          <BankObservationDates details={pending} />
        </div>
      ))}
      {(reconciliation?.missing ?? []).map((missing) => (
        <p key={missing.id}>
          {missing.compte} · {missing.libelle} : non retrouvée dans les notifications Linxo après 7
          jours.
        </p>
      ))}
    </Section>
  );
};
