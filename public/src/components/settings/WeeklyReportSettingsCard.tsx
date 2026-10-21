import React, { useState, useEffect } from 'react';
import { Mail, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import { useWeeklyReportSettings } from '../../hooks/useWeeklyReportSettings';
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  List,
  ListItem,
  Select,
  Stack,
  Switch,
  Text,
  Tile,
} from '../../ui';

const DAYS_OF_WEEK = [
  { value: 1, label: 'Lundi' },
  { value: 2, label: 'Mardi' },
  { value: 3, label: 'Mercredi' },
  { value: 4, label: 'Jeudi' },
  { value: 5, label: 'Vendredi' },
  { value: 6, label: 'Samedi' },
  { value: 7, label: 'Dimanche' },
];

const HOURS = [
  { value: 7, label: '07h00' },
  { value: 8, label: '08h00' },
  { value: 9, label: '09h00' },
  { value: 12, label: '12h00' },
  { value: 17, label: '17h00' },
  { value: 18, label: '18h00' },
  { value: 19, label: '19h00' },
  { value: 20, label: '20h00' },
  { value: 21, label: '21h00' },
  { value: 22, label: '22h00' },
];

const THRESHOLDS = [
  { value: 75, label: '75 % du budget' },
  { value: 80, label: '80 % du budget' },
  { value: 85, label: '85 % du budget' },
  { value: 90, label: '90 % du budget' },
];

export const WeeklyReportSettingsCard: React.FC = () => {
  const { config, loading, isSending, updateConfig, sendNow } = useWeeklyReportSettings();
  const [recipientsInput, setRecipientsInput] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (!loading) {
      setRecipientsInput(config.recipients?.join(', ') || '');
      setHasChanges(false);
    }
  }, [loading, config.recipients]);

  const handleToggle = (enabled: boolean) => {
    updateConfig({ enabled });
  };

  const handleSaveRecipients = () => {
    const list = recipientsInput
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean);
    updateConfig({ recipients: list });
    setHasChanges(false);
  };

  const dayLabel =
    DAYS_OF_WEEK.find((d) => d.value === (config.dayOfWeek ?? 5))?.label || 'Vendredi';
  const hourLabel = HOURS.find((h) => h.value === (config.sendHour ?? 18))?.label || '18h00';

  const lastSentFormatted = config.lastSentAt
    ? typeof config.lastSentAt === 'object' &&
      'toDate' in config.lastSentAt &&
      typeof config.lastSentAt.toDate === 'function'
      ? config.lastSentAt.toDate().toLocaleString('fr-FR', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : new Date(String(config.lastSentAt)).toLocaleString('fr-FR')
    : null;

  return (
    <Card>
      <Stack gap="lg">
        {/* En-tête principal avec Switch On/Off */}
        <Stack direction="row" gap="md" align="center" justify="between">
          <Stack direction="row" gap="md" align="center">
            <Tile tone="accent">
              <Mail size={18} />
            </Tile>
            <Stack gap="none" className="min-w-0">
              <Text variant="title3">Email récapitulatif hebdomadaire</Text>
              <Text variant="footnote" tone="tertiary">
                Chaque {dayLabel} à {hourLabel} • Soldes, dépenses & budgets
              </Text>
            </Stack>
          </Stack>
          <Switch
            label="Activer l'envoi hebdomadaire"
            checked={config.enabled}
            onChange={handleToggle}
            disabled={loading}
          />
        </Stack>

        {/* Planification : Jour et Heure */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Jour d'envoi">
            {(p) => (
              <Select
                {...p}
                value={config.dayOfWeek ?? 5}
                onChange={(e) => updateConfig({ dayOfWeek: parseInt(e.target.value, 10) })}
                disabled={loading || !config.enabled}
              >
                {DAYS_OF_WEEK.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Heure d'envoi (Europe/Paris)">
            {(p) => (
              <Select
                {...p}
                value={config.sendHour ?? 18}
                onChange={(e) => updateConfig({ sendHour: parseInt(e.target.value, 10) })}
                disabled={loading || !config.enabled}
              >
                {HOURS.map((h) => (
                  <option key={h.value} value={h.value}>
                    {h.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        {/* Contenu inclus dans l'email */}
        <Stack gap="sm">
          <Text variant="headline">Sections à inclure</Text>
          <List>
            <ListItem
              title="Soldes des comptes courants"
              subtitle="Soldes et statuts de rapprochement"
              trailing={
                <Switch
                  label="Inclure les soldes des comptes courants"
                  checked={config.includeCheckingBalances !== false}
                  onChange={(checked) => updateConfig({ includeCheckingBalances: checked })}
                  disabled={loading || !config.enabled}
                />
              }
            />
            <ListItem
              title="Soldes des livrets d'épargne"
              subtitle="Livret A, LDDS, PEL…"
              trailing={
                <Switch
                  label="Inclure les livrets d'épargne"
                  checked={config.includeSavingsBalances === true}
                  onChange={(checked) => updateConfig({ includeSavingsBalances: checked })}
                  disabled={loading || !config.enabled}
                />
              }
            />
            <ListItem
              title="Dépenses des 7 derniers jours"
              subtitle="Total dépensé, répartition par catégorie et top 5 des opérations"
              trailing={
                <Switch
                  label="Inclure les dépenses de la semaine"
                  checked={config.includeWeeklyExpenses !== false}
                  onChange={(checked) => updateConfig({ includeWeeklyExpenses: checked })}
                  disabled={loading || !config.enabled}
                />
              }
            />
            <ListItem
              title="Alertes budgets mensuels"
              subtitle="Budgets dépassés (> 100 %) et sous tension"
              trailing={
                <Switch
                  label="Inclure les alertes budgets"
                  checked={config.includeBudgetAlerts !== false}
                  onChange={(checked) => updateConfig({ includeBudgetAlerts: checked })}
                  disabled={loading || !config.enabled}
                />
              }
            />
          </List>
        </Stack>

        {/* Seuil d'alerte budget sous tension */}
        {config.includeBudgetAlerts !== false && (
          <Field
            label="Seuil d'alerte pour les budgets sous tension"
            hint="Pourcentage consommé à partir duquel un budget est signalé en avertissement."
          >
            {(p) => (
              <Select
                {...p}
                value={config.budgetWarningThreshold ?? 80}
                onChange={(e) =>
                  updateConfig({ budgetWarningThreshold: parseInt(e.target.value, 10) })
                }
                disabled={loading || !config.enabled}
              >
                {THRESHOLDS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}

        {/* Destinataires */}
        <Field
          label="Destinataires (optionnel)"
          hint="Laissez vide pour envoyer à votre adresse Gmail principale. Séparez plusieurs adresses par des virgules."
        >
          {(p) => (
            <Stack direction="row" gap="sm">
              <Input
                {...p}
                value={recipientsInput}
                placeholder="ex: nicolas@gmail.com, romane@gmail.com"
                onChange={(e) => {
                  setRecipientsInput(e.target.value);
                  setHasChanges(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSaveRecipients();
                  }
                }}
              />
              {hasChanges && (
                <Button size="sm" onClick={handleSaveRecipients}>
                  Enregistrer
                </Button>
              )}
            </Stack>
          )}
        </Field>

        {/* Dernier envoi & Bouton test */}
        <Stack direction="row" gap="md" align="center" justify="between" className="pt-2">
          <Stack gap="none">
            {lastSentFormatted ? (
              <Stack direction="row" gap="xs" align="center">
                {config.lastStatus === 'error' ? (
                  <Badge tone="negative">
                    <AlertCircle size={12} className="mr-1" /> Échec envoi
                  </Badge>
                ) : (
                  <Badge tone="positive">
                    <CheckCircle2 size={12} className="mr-1" /> Dernier envoi
                  </Badge>
                )}
                <Text variant="footnote" tone="secondary">
                  {lastSentFormatted}
                </Text>
              </Stack>
            ) : (
              <Text variant="footnote" tone="tertiary">
                Aucun envoi effectué pour l&apos;instant
              </Text>
            )}
          </Stack>

          <Button
            variant="secondary"
            size="sm"
            onClick={sendNow}
            loading={isSending}
            disabled={loading}
          >
            {!isSending && <Send size={14} className="mr-1" aria-hidden="true" />}
            {isSending ? 'Envoi…' : 'Envoyer maintenant'}
          </Button>
        </Stack>
      </Stack>
    </Card>
  );
};
