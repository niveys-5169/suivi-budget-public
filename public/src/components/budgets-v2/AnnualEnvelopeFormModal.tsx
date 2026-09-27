import React, { useState } from 'react';
import { Sheet, Field, Input, Select, Button, Text } from '../../ui';
import { useBudget } from '../../hooks/useBudget';
import { formatCurrency } from '../../lib/formatters';
import type { AnnualEnvelope } from '../../utils/annualEnvelope';
import { MonthPicker } from './MonthPicker';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Enveloppe à modifier ; absente = création. */
  envelope?: AnnualEnvelope;
  categories: string[];
  /** Conversion d'un budget mensuel : catégorie verrouillée et montant annuel proposé. */
  initialCategorie?: string;
  initialMontant?: number;
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
  initialCategorie,
  initialMontant,
}) => {
  const { saveEnvelope, removeBudgetCategory, convertToMonthly } = useBudget();
  const [categorie, setCategorie] = useState(envelope?.categorie ?? initialCategorie ?? '');
  const initial = envelope?.montant ?? initialMontant;
  const [montant, setMontant] = useState(initial ? String(initial) : '');
  const [mois, setMois] = useState<number | null>(envelope?.moisEcheance ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amount = parseFloat(montant.replace(',', '.'));
  const isAmountValid = Boolean(categorie) && Number.isFinite(amount) && amount > 0;

  const handleSave = async () => {
    if (!isAmountValid) return;
    if (mois === null) {
      setError("Choisis le mois de l'événement");
      return;
    }
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

  const runAction = async (action: () => Promise<void>, failure: string) => {
    setSaving(true);
    setError(null);
    try {
      await action();
      onClose();
    } catch {
      setError(failure);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () =>
    envelope &&
    runAction(
      () => removeBudgetCategory(envelope.categorie),
      "Impossible de supprimer l'enveloppe.",
    );

  const handleToMonthly = () =>
    envelope &&
    runAction(
      () => convertToMonthly(envelope.categorie, Math.round(envelope.montant / 12)),
      "Impossible de passer l'enveloppe en budget mensuel.",
    );

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
              disabled={Boolean(envelope || initialCategorie)}
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

        <MonthPicker
          value={mois}
          onChange={(m) => {
            setMois(m);
            setError(null);
          }}
          required
        />

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
        {envelope && (
          <Button variant="plain" size="sm" onClick={handleToMonthly} disabled={saving}>
            Passer en budget mensuel ({formatCurrency(Math.round(envelope.montant / 12))}/mois)
          </Button>
        )}
      </Sheet.Body>

      <Sheet.Footer>
        {envelope && (
          <Button variant="destructive" onClick={handleDelete} disabled={saving}>
            Supprimer
          </Button>
        )}
        <Button variant="primary" onClick={handleSave} disabled={!isAmountValid || saving}>
          Enregistrer
        </Button>
      </Sheet.Footer>
    </Sheet>
  );
};
