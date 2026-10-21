import React, { useState, useEffect } from 'react';
import { Mail, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import { useWeeklyReportSettings } from '../../hooks/useWeeklyReportSettings';
import { Badge, Button, Card, Field, Input, Stack, Switch, Text, Tile } from '../../ui';

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
        <Stack direction="row" gap="md" align="center" justify="between">
          <Stack direction="row" gap="md" align="center">
            <Tile tone="accent">
              <Mail size={18} />
            </Tile>
            <Stack gap="none" className="min-w-0">
              <Text variant="title3">Email récapitulatif hebdomadaire</Text>
              <Text variant="footnote" tone="tertiary">
                Chaque vendredi à 18h00 • Soldes, dépenses & budgets
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

        <Field
          label="Destinataires (optionnel)"
          hint="Laissez vide pour envoyer à votre adresse Gmail principale. Séparez par des virgules."
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
