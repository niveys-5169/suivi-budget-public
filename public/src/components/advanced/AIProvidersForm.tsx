import React from 'react';
import { useAISettingsForm } from '../../hooks/useAISettingsForm';
import { AI_FALLBACK_ORDER, PROVIDER_META, type AIProvider } from '../../utils/aiConfig';
import { Button, Field, Input, SegmentedControl, Stack, Text } from '../../ui';

interface AIProvidersFormProps {
  /** Appelé après un enregistrement réussi (au moins en local). */
  onSaved?: () => void;
}

const STATUS_TEXT = {
  idle: null,
  saving: 'Enregistrement…',
  saved: 'Enregistré et synchronisé.',
  'local-only': null,
  invalid: null,
} as const;

/**
 * Réglages IA : clé, modèle et URL par fournisseur, plus la clé Brave Search.
 * Les fournisseurs configurés sont essayés dans l'ordre de secours affiché.
 */
export const AIProvidersForm: React.FC<AIProvidersFormProps> = ({ onSaved }) => {
  const form = useAISettingsForm();
  const { settings, provider } = form;
  const current = settings.providers[provider];
  const meta = PROVIDER_META[provider];

  const segments = AI_FALLBACK_ORDER.map((p: AIProvider) => ({
    value: p,
    label: `${PROVIDER_META[p].label}${settings.providers[p].apiKey ? ' ✓' : ''}`,
  }));

  const handleSave = async () => {
    if (await form.save()) onSaved?.();
  };

  const statusText =
    form.status === 'local-only'
      ? `Enregistré sur cet appareil uniquement : ${form.syncError}`
      : form.status === 'invalid'
        ? `URL invalide à corriger : ${form.invalidUrls.map((p) => PROVIDER_META[p].label).join(', ')}.`
        : STATUS_TEXT[form.status];

  return (
    <Stack gap="md">
      <Text variant="footnote" tone="secondary">
        Ordre de secours : {AI_FALLBACK_ORDER.map((p) => PROVIDER_META[p].label).join(' → ')}. Seuls
        les fournisseurs avec une clé sont utilisés.
      </Text>

      <SegmentedControl
        label="Fournisseur à configurer"
        segments={segments}
        value={provider}
        onChange={form.setProvider}
        block
      />

      <Field label={`Clé API ${meta.label}`} hint={meta.keyHint}>
        {(p) => (
          <Input
            {...p}
            type="password"
            autoComplete="off"
            value={current.apiKey}
            onChange={(e) => form.updateProvider(provider, 'apiKey', e.target.value)}
          />
        )}
      </Field>

      <Field label="Modèle" hint={`Par défaut : ${meta.defaultModel}`}>
        {(p) => (
          <Input
            {...p}
            autoComplete="off"
            placeholder={meta.defaultModel}
            value={current.model}
            onChange={(e) => form.updateProvider(provider, 'model', e.target.value)}
          />
        )}
      </Field>

      <Field
        label="URL de l’endpoint"
        hint={`Par défaut : ${meta.defaultBaseUrl}`}
        error={form.invalidUrls.includes(provider) ? 'URL invalide (http(s)://…).' : undefined}
      >
        {(p) => (
          <Input
            {...p}
            inputMode="url"
            autoComplete="off"
            placeholder={meta.defaultBaseUrl}
            value={current.baseUrl}
            onChange={(e) => form.updateProvider(provider, 'baseUrl', e.target.value)}
          />
        )}
      </Field>

      <Field
        label="Clé Brave Search"
        hint="Accès internet pour NVIDIA. Clé gratuite sur api-dashboard.search.brave.com."
      >
        {(p) => (
          <Input
            {...p}
            type="password"
            autoComplete="off"
            value={settings.searchApiKey}
            onChange={(e) => form.setSearchApiKey(e.target.value)}
          />
        )}
      </Field>

      <Button variant="primary" block onClick={handleSave} disabled={form.status === 'saving'}>
        Enregistrer
      </Button>
      {statusText && (
        <Text
          variant="footnote"
          tone={
            form.status === 'saved'
              ? 'positive'
              : form.status === 'saving'
                ? 'secondary'
                : form.status === 'local-only'
                  ? 'warning'
                  : 'negative'
          }
          role="status"
        >
          {statusText}
        </Text>
      )}
    </Stack>
  );
};
