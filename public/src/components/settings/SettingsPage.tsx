import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import {
  ArrowRightLeft,
  Bell,
  BrainCircuit,
  Car,
  ChevronRight,
  Link2,
  Mail,
  MailX,
  RefreshCcw,
} from 'lucide-react';
import { usePreferences } from '../../hooks/usePreferences';
import { usePWAUpdate } from '../../hooks/usePWAUpdate';
import { useAdvancedSettings } from '../../hooks/useAdvancedSettings';
import { useBalances } from '../../hooks/useBalances';
import { functions } from '../../services/firebase';
import { toast } from '../../lib/toast';
import { CategoryIconEditor } from '../CategoryIconEditor';
import { AISettingsForm } from './AISettingsForm';
import { GitHubSettingsForm } from './GitHubSettingsForm';
import {
  Button,
  Card,
  Chip,
  List,
  ListItem,
  Screen,
  Section,
  SegmentedControl,
  Select,
  Stack,
  Text,
  Tile,
} from '../../ui';

export type SettingsSection = 'general' | 'ia' | 'categories' | 'import';

const SECTIONS: { id: SettingsSection; label: string }[] = [
  { id: 'general', label: 'Général' },
  { id: 'ia', label: 'Assistant IA' },
  { id: 'categories', label: 'Catégories & comptes' },
  { id: 'import', label: 'Import des données' },
];

const DENSITIES = [
  { value: 'comfortable', label: 'Confort' },
  { value: 'compact', label: 'Compact' },
] as const;

/** Ligne de navigation vers une sous-page de réglage. */
const LinkRow: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  to: string;
}> = ({ icon, title, subtitle, to }) => {
  const navigate = useNavigate();
  return (
    <ListItem
      leading={<Tile>{icon}</Tile>}
      title={title}
      subtitle={subtitle}
      trailing={<ChevronRight size={16} className="text-label-tertiary" aria-hidden="true" />}
      onClick={() => navigate(to)}
    />
  );
};

const GeneralSection: React.FC = () => {
  const { density, setDensity } = usePreferences();
  const { isRefreshing, refreshApp } = usePWAUpdate();

  return (
    <>
      <Section title="Affichage">
        <SegmentedControl
          label="Densité d'affichage"
          segments={DENSITIES}
          value={density}
          onChange={setDensity}
          block
        />
      </Section>
      <Section title="Application">
        <List>
          <ListItem
            leading={
              <Tile>
                <RefreshCcw size={18} className={isRefreshing ? 'animate-spin' : ''} />
              </Tile>
            }
            title={isRefreshing ? 'Mise à jour…' : "Mettre à jour l'application"}
            subtitle="Vide le cache et recharge la dernière version"
            onClick={isRefreshing ? undefined : refreshApp}
          />
        </List>
      </Section>
    </>
  );
};

const AccountOwnersList: React.FC = () => {
  const { ownerMapping, updateOwnerMapping } = useAdvancedSettings();
  const { balances } = useBalances();

  if (!ownerMapping) return null;

  return (
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
              onChange={(e) =>
                updateOwnerMapping({
                  accounts: { ...ownerMapping.accounts, [b.compte]: e.target.value },
                }).catch((err) => {
                  console.error(err);
                  toast.error("Échec de l'enregistrement du propriétaire");
                })
              }
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
  );
};

const CategoriesSection: React.FC = () => (
  <>
    <Section title="Catégorisation">
      <List>
        <LinkRow
          icon={<BrainCircuit size={18} />}
          title="Règles automatiques"
          subtitle="Catégoriser les transactions selon leur libellé"
          to="/rules"
        />
        <LinkRow
          icon={<ArrowRightLeft size={18} />}
          title="Fusion de catégories"
          subtitle="Regrouper plusieurs catégories en une seule"
          to="/fusion"
        />
        <LinkRow
          icon={<Link2 size={18} />}
          title="Correspondances Linxo"
          subtitle="Associer les catégories Linxo aux vôtres"
          to="/mappings"
        />
      </List>
    </Section>
    <Section title="Propriété des comptes">
      <Text variant="footnote" tone="tertiary" className="px-1">
        Détermine à qui sont attribués les flux et les soldes de chaque compte.
      </Text>
      <AccountOwnersList />
    </Section>
    <Card>
      <CategoryIconEditor />
    </Card>
  </>
);

const ImportSection: React.FC = () => {
  const [isSettingUpWatch, setIsSettingUpWatch] = useState(false);

  const handleSetupGmailWatch = async () => {
    setIsSettingUpWatch(true);
    try {
      const setupWatch = httpsCallable<
        Record<string, never>,
        { historyId: string; expiration: string }
      >(functions, 'setup_gmail_watch');
      const result = await setupWatch({});
      // `expiration` est un epoch en millisecondes (chaîne) renvoyé par l'API
      // Gmail : l'afficher rend le watch vérifiable d'un coup d'œil — sans lui,
      // rien ne distingue « push armé » de « push mort » depuis l'interface.
      const expiration = Number(result.data.expiration);
      const expirationLabel =
        Number.isFinite(expiration) && expiration > 0
          ? new Date(expiration).toLocaleString('fr-FR')
          : 'inconnue';
      toast.success(
        `Gmail Watch activé jusqu'au ${expirationLabel} — historyId : ${result.data.historyId}`,
        8000,
      );
    } catch (err) {
      console.error('Erreur Gmail Watch:', err);
      toast.error(`Échec : ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSettingUpWatch(false);
    }
  };

  return (
    <>
      <Section title="Dépôt GitHub">
        <Text variant="footnote" tone="tertiary" className="px-1">
          Dépôt qui exécute l&apos;import des transactions via GitHub Actions.
        </Text>
        <Card>
          <GitHubSettingsForm />
        </Card>
      </Section>
      <Section title="Gmail">
        <List>
          <ListItem
            leading={
              <Tile>
                <Bell size={18} className={isSettingUpWatch ? 'animate-pulse' : ''} />
              </Tile>
            }
            title="Notifications push Gmail"
            subtitle="Import en temps réel des emails Linxo. Renouvelé chaque lundi."
            trailing={
              <Button size="sm" onClick={handleSetupGmailWatch} loading={isSettingUpWatch}>
                Activer
              </Button>
            }
          />
          <LinkRow
            icon={<Mail size={18} />}
            title="Reparse Gmail"
            subtitle="Relire les emails Linxo ou lancer un scan complet"
            to="/reparse"
          />
          <LinkRow
            icon={<MailX size={18} />}
            title="Emails exclus"
            subtitle="Messages ignorés par le reparse"
            to="/excluded"
          />
        </List>
      </Section>
      <Section title="Véhicule électrique">
        <List>
          <LinkRow
            icon={<Car size={18} />}
            title="Tronity"
            subtitle="Tarifs HP/HC et import des sessions de recharge"
            to="/tronity"
          />
        </List>
      </Section>
    </>
  );
};

export const SettingsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('section') as SettingsSection | null;
  const active = SECTIONS.some((s) => s.id === requested) ? requested! : 'general';

  return (
    <Screen title="Paramètres">
      <div className="no-scrollbar -mx-4 overflow-x-auto px-4 md:-mx-6 md:px-6">
        <Stack direction="row" gap="sm" className="w-max">
          {SECTIONS.map((s) => (
            <Chip
              key={s.id}
              selected={active === s.id}
              onClick={() => setSearchParams({ section: s.id }, { replace: true })}
            >
              {s.label}
            </Chip>
          ))}
        </Stack>
      </div>

      {active === 'general' && <GeneralSection />}
      {active === 'ia' && (
        <Section title="Assistant IA">
          <Text variant="footnote" tone="tertiary" className="px-1">
            Modèle utilisé par l&apos;assistant financier et la catégorisation automatique.
          </Text>
          <Card>
            <AISettingsForm />
          </Card>
        </Section>
      )}
      {active === 'categories' && <CategoriesSection />}
      {active === 'import' && <ImportSection />}
    </Screen>
  );
};
