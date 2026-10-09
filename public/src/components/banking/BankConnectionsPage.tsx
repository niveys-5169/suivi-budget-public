import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Screen, Section, Stack, Select, Text } from '../../ui';
import { useBankingData, bankDateMillis } from '../../hooks/useBankingData';
import { useSyncTransactions } from '../../hooks/useSyncTransactions';
import { bankCall } from '../../services/banking-api';
import { toast } from '../../lib/toast';
import { BankReconciliationPanel } from './BankReconciliationPanel';

import { BankAccountMapping } from './BankAccountMapping';

export const BankConnectionsPage: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { connections, loading, error } = useBankingData();
  const { sync, isSyncing } = useSyncTransactions();
  const [banks, setBanks] = useState<{ name: string; country: string }[]>([]);
  const [bank, setBank] = useState('');
  const [busy, setBusy] = useState(false);
  const authorize = async (name: string, connectionId?: string) => {
    setBusy(true);
    try {
      const result = await bankCall<{ url: string }>('eb_auth_start', { bank: name, connectionId });
      const target = new URL(result.url);
      if (target.protocol !== 'https:') throw new Error('Invalid auth URL');
      window.location.assign(target.href);
    } catch {
      toast.error('Connexion impossible. Vérifiez la configuration Enable Banking et réessayez.');
      setBusy(false);
    }
  };
  const loadBanks = async () => {
    setBusy(true);
    try {
      const result = await bankCall<{ banks: { name: string; country: string }[] }>(
        'eb_list_banks',
      );
      setBanks(result.banks);
      setBank(result.banks[0]?.name ?? '');
    } catch {
      toast.error('Banques indisponibles : configuration Enable Banking à vérifier.');
    } finally {
      setBusy(false);
    }
  };
  const date = (value: unknown) =>
    bankDateMillis(value) ? new Date(bankDateMillis(value)).toLocaleString('fr-FR') : 'Jamais';
  return (
    <Screen title="Connexions bancaires" onBack={() => navigate(-1)}>
      {params.get('auth') === 'success' && (
        <Section title="Connexion enregistrée">
          <Text>
            Rattachez les comptes puis lancez une synchronisation. Si la banque a ouvert un
            navigateur externe, vous pouvez maintenant revenir à votre application installée.
          </Text>
        </Section>
      )}
      <Section title="Synchronisation">
        <Text>
          {connections.some((c) => c.mode === 'active')
            ? 'Activation par compte'
            : 'Mode observation : Linxo continue d’alimenter vos finances tant que l’activation de production n’a pas été vérifiée.'}
        </Text>
        <Text tone="secondary">
          Chaque jour à 8 h, heure de Paris. Linxo vérifie les opérations reçues et continue de
          fonctionner en secours.
        </Text>
        <Button onClick={sync} loading={isSyncing}>
          Actualiser les banques et Linxo
        </Button>
        {error && <p role="alert">{error}</p>}
        {loading && <Text>Chargement…</Text>}
      </Section>
      <Section title="Connecter une banque">
        {banks.length === 0 ? (
          <Button onClick={loadBanks} loading={busy}>
            Choisir une banque
          </Button>
        ) : (
          <Stack gap="md">
            <Select
              aria-label="Banque à connecter"
              value={bank}
              onChange={(event) => setBank(event.target.value)}
            >
              {banks.map((item) => (
                <option key={item.name} value={item.name}>
                  {item.name}
                </option>
              ))}
            </Select>
            <Button disabled={!bank} loading={busy} onClick={() => authorize(bank)}>
              Se connecter auprès de la banque
            </Button>
          </Stack>
        )}
      </Section>
      {connections.map((connection) => (
        <Section key={connection.id} title={connection.bank}>
          <Text>
            État :{' '}
            {connection.status === 'active'
              ? 'Active'
              : connection.status === 'reconnect'
                ? 'À reconnecter'
                : 'Synchronisation en erreur'}
          </Text>
          <Text tone="secondary">
            Expiration : {date(connection.validUntil)} · Dernière réussite :{' '}
            {date(connection.lastSuccessAt)} · Dernière tentative : {date(connection.lastAttemptAt)}
          </Text>
          {connection.errorCode && (
            <Text tone="secondary">
              {connection.status === 'reconnect'
                ? 'Une nouvelle authentification auprès de votre banque est nécessaire.'
                : 'La synchronisation n’a pas abouti. Réessayez ou reconnectez le compte si le problème persiste.'}
            </Text>
          )}
          <Button loading={busy} onClick={() => authorize(connection.bank, connection.id)}>
            Reconnecter
          </Button>
          <BankAccountMapping
            key={`${connection.id}:${date(connection.validUntil)}`}
            connection={connection}
          />
        </Section>
      ))}
      <BankReconciliationPanel />
      <Text variant="caption" tone="secondary">
        Pour revenir à Linxo, désactivez Enable Banking pour les comptes concernés puis enregistrez.
        Les observations sont conservées.
      </Text>
    </Screen>
  );
};
