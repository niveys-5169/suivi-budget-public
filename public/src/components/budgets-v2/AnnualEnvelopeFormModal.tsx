import React, { useState } from 'react';
import { Sheet, Field, Input, Select, Chip, Button, Text } from '../../ui';
import { useBudget } from '../../hooks/useBudget';
import { formatCurrency } from '../../lib/formatters';
import type { AnnualEnvelope } from '../../utils/annualEnvelope';

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

const monthShort = (m: number) =>
  new Date(2026, m - 1).toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Enveloppe à modifier ; absente = création. */
  envelope?: AnnualEnvelope;
  categories: string[];
}

/**
 * Création / modification d'une enveloppe annuelle en trois champs :
 * catégorie, montant pour l'année, mois de l'événement.
 */
export const AnnualEnvelopeFormModal: React.FC<Props> = ({
  isOpen,
  onClose,
  envelope,
  categories,
}) => {
  const { saveEnvelope, removeBudgetCategory } = useBudget();
  const [categorie, setCategorie] = useState(envelope?.categorie ?? '');
  const [montant, setMontant] = useState(envelope ? String(envelope.montant) : '');
  const [mois, setMois] = useState<number | null>(envelope?.moisEcheance ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amount = parseFloat(montant.replace(',', '.'));
  const isValid = Boolean(categorie) && Number.isFinite(amount) && amount > 0 && mois !== null;

  const handleSave = async () => {
    if (!isValid || mois === null) return;
    setSaving(true);
    setError(null);
    try {
      await saveEnvelope(categorie, amount, mois);
      onClose();
    } catch {
      setError("Impossible d'enregistrer l'enveloppe.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!envelope) return;
    setSaving(true);
    setError(null);
    try {
      await removeBudgetCategory(envelope.categorie);
      onClose();
    } catch {
      setError("Impossible de supprimer l'enveloppe.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      fullHeight={false}
      title="Enveloppe annuelle"
      subtitle="Une dépense qui revient une fois par an"
    >
      <Sheet.Body className="flex flex-col gap-4">
        <Field label="Catégorie" required>
          {(p) => (
            <Select
              {...p}
              value={categorie}
              disabled={Boolean(envelope)}
              onChange={(e) => setCategorie(e.target.value)}
            >
              <option value="">Choisir…</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Montant pour l'année (€)" required>
          {(p) => (
            <Input
              {...p}
              inputMode="decimal"
              placeholder="3 000"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
            />
          )}
        </Field>

        <div className="flex flex-col gap-2" role="group" aria-label="Mois de l'événement">
          <Text variant="footnote" tone="secondary">
            Mois de l&apos;événement
          </Text>
          <div className="grid grid-cols-4 gap-2">
            {MONTHS.map((m) => (
              <Chip
                key={m}
                selected={mois === m}
                onClick={() => setMois(m)}
                className="justify-center"
              >
                {monthShort(m)}
              </Chip>
            ))}
          </div>
        </div>

        {Number.isFinite(amount) && amount > 0 && (
          <Text variant="footnote" tone="accent">
            {formatCurrency(amount / 12)}/mois à mettre de côté
          </Text>
        )}
        {error && (
          <Text variant="footnote" tone="negative" role="alert">
            {error}
          </Text>
        )}
      </Sheet.Body>

      <Sheet.Footer>
        {envelope && (
          <Button variant="destructive" onClick={handleDelete} disabled={saving}>
            Supprimer
          </Button>
        )}
        <Button variant="primary" onClick={handleSave} disabled={!isValid || saving}>
          Enregistrer
        </Button>
      </Sheet.Footer>
    </Sheet>
  );
};
