import React, { useState } from 'react';
import { Zap, Wallet, Users, Plus, Trash2, Clock, Info, Cloud, RefreshCw } from 'lucide-react';
import { useAdvancedSettings } from '../../../hooks/useAdvancedSettings';
import { useBalances } from '../../../hooks/useBalances';
import { usePWAUpdate } from '../../../hooks/usePWAUpdate';
import {
  Badge,
  Button,
  Card,
  Chip,
  Field,
  IconButton,
  Input,
  List,
  ListItem,
  Screen,
  Section,
  Select,
  Skeleton,
  Stack,
  Text,
  Tile,
} from '../../../ui';

type SettingsSection = 'api' | 'energy' | 'treasury' | 'attribution' | 'maintenance';

const SECTIONS: { id: SettingsSection; label: string; icon: React.ReactNode }[] = [
  { id: 'api', label: 'APIs & GitHub', icon: <Cloud size={16} /> },
  { id: 'energy', label: 'Énergie', icon: <Zap size={16} /> },
  { id: 'treasury', label: 'Trésorerie', icon: <Wallet size={16} /> },
  { id: 'attribution', label: 'Attribution', icon: <Users size={16} /> },
  { id: 'maintenance', label: 'Maintenance', icon: <RefreshCw size={16} /> },
];

/** En-tête de bloc : tuile d'icône + titre + description. */
const BlockHeader: React.FC<{ icon: React.ReactNode; title: string; description: string }> = ({
  icon,
  title,
  description,
}) => (
  <Stack direction="row" gap="md" align="center">
    <Tile tone="accent">{icon}</Tile>
    <Stack gap="none" className="min-w-0">
      <Text variant="title3">{title}</Text>
      <Text variant="footnote" tone="tertiary">
        {description}
      </Text>
    </Stack>
  </Stack>
);

export const AurumSettingsPage: React.FC<{
  onBack: () => void;
  initialSection?: SettingsSection;
}> = ({ onBack, initialSection = 'api' }) => {
  const {
    githubSettings,
    tronityConfig,
    ravConfig,
    ownerMapping,
    loading,
    updateGithubSettings,
    updateTronityConfig,
    updateRavConfig,
    updateOwnerMapping,
  } = useAdvancedSettings();
  const { balances } = useBalances();
  const { isRefreshing, refreshApp } = usePWAUpdate();

  const [activeSection, setActiveSection] = useState<SettingsSection>(initialSection);
  const [saving, setSaving] = useState(false);

  const [syncedSection, setSyncedSection] = useState(initialSection);
  if (initialSection !== syncedSection) {
    setSyncedSection(initialSection);
    setActiveSection(initialSection);
  }

  const handleSave = async (fn: () => Promise<void>) => {
    setSaving(true);
    try {
      await fn();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !tronityConfig || !ravConfig || !ownerMapping || !githubSettings) {
    return (
      <Screen title="Réglages avancés" onBack={onBack}>
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-48 w-full" />
      </Screen>
    );
  }

  return (
    <Screen
      title="Réglages avancés"
      onBack={onBack}
      actions={
        <Badge tone={saving ? 'positive' : 'neutral'} dot={saving}>
          {saving ? 'Synchronisation…' : 'Config cloud active'}
        </Badge>
      }
    >
      <div className="no-scrollbar -mx-4 overflow-x-auto px-4 md:-mx-6 md:px-6">
        <Stack direction="row" gap="sm" className="w-max">
          {SECTIONS.map((s) => (
            <Chip
              key={s.id}
              selected={activeSection === s.id}
              onClick={() => setActiveSection(s.id)}
            >
              {s.icon}
              {s.label}
            </Chip>
          ))}
        </Stack>
      </div>

      {activeSection === 'api' && (
        <Card>
          <Stack gap="lg">
            <BlockHeader
              icon={<Cloud size={18} />}
              title="GitHub Workflow"
              description="Import via GitHub Actions"
            />
            <Field label="Propriétaire du dépôt">
              {(p) => (
                <Input
                  {...p}
                  value={githubSettings.github_owner}
                  autoComplete="off"
                  onChange={(e) =>
                    handleSave(() => updateGithubSettings({ github_owner: e.target.value }))
                  }
                />
              )}
            </Field>
            <Field label="Nom du dépôt">
              {(p) => (
                <Input
                  {...p}
                  value={githubSettings.github_repo}
                  autoComplete="off"
                  onChange={(e) =>
                    handleSave(() => updateGithubSettings({ github_repo: e.target.value }))
                  }
                />
              )}
            </Field>
          </Stack>
        </Card>
      )}

      {activeSection === 'energy' && (
        <>
          <Card>
            <Stack gap="lg">
              <BlockHeader
                icon={<Zap size={18} />}
                title="Tarification électrique"
                description="Calcul du coût de recharge du véhicule"
              />
              <div className="grid grid-cols-2 gap-4">
                <Field label="Tarif HP (€/kWh)">
                  {(p) => (
                    <Input
                      {...p}
                      type="number"
                      step="0.0001"
                      inputMode="decimal"
                      value={tronityConfig.tarif_hp}
                      onChange={(e) =>
                        handleSave(() =>
                          updateTronityConfig({ tarif_hp: parseFloat(e.target.value) }),
                        )
                      }
                    />
                  )}
                </Field>
                <Field label="Tarif HC (€/kWh)">
                  {(p) => (
                    <Input
                      {...p}
                      type="number"
                      step="0.0001"
                      inputMode="decimal"
                      value={tronityConfig.tarif_hc}
                      onChange={(e) =>
                        handleSave(() =>
                          updateTronityConfig({ tarif_hc: parseFloat(e.target.value) }),
                        )
                      }
                    />
                  )}
                </Field>
              </div>
            </Stack>
          </Card>

          <Section
            title="Heures creuses"
            action={
              <Button
                variant="plain"
                size="sm"
                onClick={() =>
                  handleSave(() =>
                    updateTronityConfig({
                      hc_plages: [...tronityConfig.hc_plages, { start: '22:00', end: '06:00' }],
                    }),
                  )
                }
              >
                <Plus size={16} aria-hidden="true" /> Ajouter
              </Button>
            }
          >
            <List>
              {tronityConfig.hc_plages.map((plage: { start: string; end: string }, idx: number) => (
                <ListItem
                  key={idx}
                  leading={
                    <Tile>
                      <Clock size={16} />
                    </Tile>
                  }
                  title={
                    <Stack direction="row" gap="sm" align="center">
                      <Input
                        aria-label={`Début de la plage ${idx + 1}`}
                        value={plage.start}
                        className="w-24 text-center"
                        onChange={(e) => {
                          const next = [...tronityConfig.hc_plages];
                          next[idx] = { ...plage, start: e.target.value };
                          handleSave(() => updateTronityConfig({ hc_plages: next }));
                        }}
                      />
                      <Text tone="tertiary" aria-hidden="true">
                        →
                      </Text>
                      <Input
                        aria-label={`Fin de la plage ${idx + 1}`}
                        value={plage.end}
                        className="w-24 text-center"
                        onChange={(e) => {
                          const next = [...tronityConfig.hc_plages];
                          next[idx] = { ...plage, end: e.target.value };
                          handleSave(() => updateTronityConfig({ hc_plages: next }));
                        }}
                      />
                    </Stack>
                  }
                  trailing={
                    <IconButton
                      label={`Supprimer la plage ${plage.start} – ${plage.end}`}
                      variant="plain"
                      size="sm"
                      className="text-negative"
                      onClick={() =>
                        handleSave(() =>
                          updateTronityConfig({
                            hc_plages: tronityConfig.hc_plages.filter(
                              (_: unknown, i: number) => i !== idx,
                            ),
                          }),
                        )
                      }
                    >
                      <Trash2 size={16} />
                    </IconButton>
                  }
                />
              ))}
            </List>
          </Section>
        </>
      )}

      {activeSection === 'treasury' && (
        <Card>
          <Stack gap="lg">
            <BlockHeader
              icon={<Wallet size={18} />}
              title="Consommation et reste à vivre"
              description="Configuration du calcul du RAV"
            />
            <Field label="Revenu net mensuel fixe (€)">
              {(p) => (
                <Input
                  {...p}
                  type="number"
                  inputMode="decimal"
                  value={ravConfig.revenu_mensuel_net || ''}
                  onChange={(e) =>
                    handleSave(() =>
                      updateRavConfig({ revenu_mensuel_net: parseFloat(e.target.value) || 0 }),
                    )
                  }
                />
              )}
            </Field>
            <Field label="Catégories de revenus" hint="Séparées par des virgules.">
              {(p) => (
                <Input
                  {...p}
                  value={ravConfig.revenu_categories?.join(', ') || ''}
                  placeholder="Salaire, Dividendes, Loyer…"
                  onChange={(e) =>
                    handleSave(() =>
                      updateRavConfig({
                        revenu_categories: e.target.value
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      }),
                    )
                  }
                />
              )}
            </Field>
            <Field label="Catégories de dépenses du RAV" hint="Séparées par des virgules.">
              {(p) => (
                <Input
                  {...p}
                  value={ravConfig.depense_categories?.join(', ') || ''}
                  placeholder="Courses, Carburant, Loisirs…"
                  onChange={(e) =>
                    handleSave(() =>
                      updateRavConfig({
                        depense_categories: e.target.value
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      }),
                    )
                  }
                />
              )}
            </Field>
          </Stack>
        </Card>
      )}

      {activeSection === 'attribution' && (
        <Section title="Propriété des comptes">
          <Text variant="footnote" tone="tertiary" className="px-1">
            Détermine à qui sont attribués les flux et les soldes de chaque compte.
          </Text>
          <List>
            {balances?.map((b) => (
              <ListItem
                key={b.id}
                title={b.compte}
                trailing={
                  <Select
                    aria-label={`Propriétaire de ${b.compte}`}
                    value={ownerMapping.accounts[b.compte] || ownerMapping.default_owner}
                    className="w-40"
                    onChange={(e) => {
                      const next = { ...ownerMapping.accounts, [b.compte]: e.target.value };
                      handleSave(() => updateOwnerMapping({ accounts: next }));
                    }}
                  >
                    {ownerMapping.owners.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                    <option value="Commun">Commun</option>
                  </Select>
                }
              />
            ))}
          </List>
        </Section>
      )}

      {activeSection === 'maintenance' && (
        <Card>
          <Stack gap="lg">
            <BlockHeader
              icon={<RefreshCw size={18} />}
              title="Maintenance de l'application"
              description="Nettoyage du cache et rafraîchissement"
            />
            <Text variant="footnote" tone="secondary">
              Vide le cache et recharge la dernière version. Utile pour mettre à jour
              l&apos;application sans la désinstaller.
            </Text>
            <Button variant="secondary" block onClick={refreshApp} loading={isRefreshing}>
              {!isRefreshing && <RefreshCw size={18} aria-hidden="true" />}
              {isRefreshing ? 'Rafraîchissement…' : "Rafraîchir l'application"}
            </Button>
          </Stack>
        </Card>
      )}

      <Card>
        <Stack direction="row" gap="md">
          <Tile tone="accent">
            <Info size={18} />
          </Tile>
          <Text variant="footnote" tone="secondary">
            Ces réglages sont enregistrés sur votre instance Firestore et s&apos;appliquent
            immédiatement à tous vos appareils synchronisés. Certains changements demandent de
            relancer l&apos;import GitHub pour être visibles.
          </Text>
        </Stack>
      </Card>
    </Screen>
  );
};
