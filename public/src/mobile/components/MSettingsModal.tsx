import React, { useState } from 'react';
import {
  RefreshCcw,
  Trash2,
  LogOut,
  CloudDownload,
  BrainCircuit,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { usePWAUpdate } from '../../hooks/usePWAUpdate';
import { usePreferences } from '../../hooks/usePreferences';
import { useSyncTransactions } from '../../hooks/useSyncTransactions';
import { GitHubSettingsForm } from '../../components/settings/GitHubSettingsForm';
import { MAIConfigSheet } from './MAIConfigSheet';
import { configuredProviders, PROVIDER_META, readAISettings } from '../../utils/aiConfig';
import {
  Card,
  List,
  ListItem,
  Section,
  SegmentedControl,
  Sheet,
  Stack,
  Text,
  Tile,
} from '../../ui';

interface MSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DENSITIES = [
  { value: 'comfortable', label: 'Confort' },
  { value: 'compact', label: 'Compact' },
] as const;

export const MSettingsModal: React.FC<MSettingsModalProps> = ({ isOpen, onClose }) => {
  const { signOut } = useAuth();
  const { isRefreshing, refreshApp } = usePWAUpdate();
  const { density, setDensity } = usePreferences();
  const { sync, isSyncing } = useSyncTransactions();
  const [isClearing, setIsClearing] = useState(false);
  const [isSigning, setIsSigning] = useState(false);

  const [isAIConfigOpen, setIsAIConfigOpen] = useState(false);
  const aiProviders = configuredProviders(readAISettings());

  const handleClearCache = async () => {
    setIsClearing(true);
    try {
      const keysToKeep = ['auth_token', 'user_preferences'];
      Object.keys(localStorage).forEach((key) => {
        if (!keysToKeep.includes(key)) {
          localStorage.removeItem(key);
        }
      });

      const databases = await indexedDB.databases();
      for (const db of databases) {
        if (db.name) indexedDB.deleteDatabase(db.name);
      }

      if ('caches' in window) {
        const cacheNames = await caches.keys();
        for (const cacheName of cacheNames) {
          await caches.delete(cacheName);
        }
      }

      window.location.reload();
    } catch (err) {
      console.error('Erreur lors du nettoyage du cache:', err);
    } finally {
      setIsClearing(false);
    }
  };

  const handleSignOut = async () => {
    setIsSigning(true);
    try {
      await signOut();
      window.location.href = '/';
    } catch (err) {
      console.error('Erreur lors de la déconnexion:', err);
      setIsSigning(false);
    }
  };

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="Paramètres" size="sm">
      <Sheet.Body>
        <Stack gap="lg" className="pb-safe-md">
          <Section title="Affichage">
            <SegmentedControl
              label="Densité d'affichage"
              segments={DENSITIES}
              value={density}
              onChange={setDensity}
              block
            />
          </Section>

          <Section title="Assistant IA">
            <List>
              <ListItem
                leading={
                  <Tile>
                    <BrainCircuit size={18} />
                  </Tile>
                }
                title="Configuration IA"
                subtitle={
                  aiProviders.length
                    ? aiProviders.map((p) => PROVIDER_META[p].label).join(' → ')
                    : 'Aucun fournisseur configuré'
                }
                trailing={
                  <ChevronRight size={16} className="text-label-tertiary" aria-hidden="true" />
                }
                onClick={() => setIsAIConfigOpen(true)}
              />
            </List>
          </Section>

          <Section title="Source des données">
            <Card>
              <GitHubSettingsForm />
            </Card>
          </Section>

          {/* Les quatre actions étaient quatre cartes-boutons au markup identique. */}
          <Section title="Actions">
            <List>
              <ListItem
                leading={
                  <Tile>
                    <CloudDownload size={18} />
                  </Tile>
                }
                title={isSyncing ? 'Synchronisation…' : 'Synchroniser'}
                subtitle={isSyncing ? 'Import en cours…' : 'Importer les nouvelles transactions'}
                onClick={isSyncing ? undefined : sync}
              />
              <ListItem
                leading={
                  <Tile>
                    <RefreshCcw size={18} />
                  </Tile>
                }
                title={isRefreshing ? 'Mise à jour…' : "Mettre à jour l'application"}
                subtitle={isRefreshing ? 'Veuillez patienter…' : 'Télécharger la dernière version'}
                onClick={isRefreshing ? undefined : refreshApp}
              />
              <ListItem
                leading={
                  <Tile>
                    <Trash2 size={18} />
                  </Tile>
                }
                title={isClearing ? 'Nettoyage…' : 'Vider le cache'}
                subtitle={isClearing ? 'En cours…' : "Libérer de l'espace local"}
                onClick={isClearing ? undefined : handleClearCache}
              />
              <ListItem
                leading={
                  <Tile>
                    <LogOut size={18} className="text-negative" />
                  </Tile>
                }
                title={
                  <Text variant="headline" tone="negative">
                    {isSigning ? 'Déconnexion…' : 'Se déconnecter'}
                  </Text>
                }
                subtitle={isSigning ? 'En cours…' : 'Quitter votre compte'}
                onClick={isSigning ? undefined : handleSignOut}
              />
            </List>
          </Section>
        </Stack>
      </Sheet.Body>
      {isAIConfigOpen && (
        <MAIConfigSheet closeOnSave={false} onClose={() => setIsAIConfigOpen(false)} />
      )}
    </Sheet>
  );
};
