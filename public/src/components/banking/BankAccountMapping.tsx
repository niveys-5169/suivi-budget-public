import React, { useState } from 'react';
import { Button, Stack, Select, Text, Switch } from '../../ui';
import { useBalances } from '../../hooks/useBalances';
import { bankCall } from '../../services/banking-api';
import type { BankConnection } from '../../types/banking.types';
import { toast } from '../../lib/toast';

export const BankAccountMapping: React.FC<{ connection: BankConnection }> = ({ connection }) => {
  const { balances } = useBalances();
  const [accounts, setAccounts] = useState(connection.accounts);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await bankCall('eb_save_mapping', {
        connectionId: connection.id,
        accounts: Object.fromEntries(
          accounts.map((a) => [a.stableId, { compte: a.compte, enabled: a.enabled }]),
        ),
      });
      toast.success(
        'Rattachement enregistré. Lancez une synchronisation pour vérifier les données.',
      );
    } catch {
      toast.error(
        'Rattachement impossible : vérifiez les comptes, la devise et les connexions déjà actives.',
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <Stack gap="md">
      {accounts.map((account, index) => (
        <div key={account.stableId} className="space-y-2">
          <Text>
            {account.name} ({account.currency})
          </Text>
          <Select
            aria-label={`Compte pour ${account.name}`}
            value={account.compte}
            onChange={(event) =>
              setAccounts((old) =>
                old.map((a, i) => (i === index ? { ...a, compte: event.target.value } : a)),
              )
            }
          >
            <option value="">Choisir un compte existant</option>
            {balances.map((balance) => (
              <option key={balance.id} value={balance.compte}>
                {balance.compte}
              </option>
            ))}
          </Select>
          <div className="flex items-center gap-2 text-footnote">
            <Switch
              label={`Enable Banking principal pour ${account.name}`}
              checked={account.enabled}
              disabled={!account.compte || account.currency !== 'EUR'}
              onChange={(enabled) =>
                setAccounts((old) => old.map((a, i) => (i === index ? { ...a, enabled } : a)))
              }
            />
            Enable Banking principal pour ce compte
          </div>
        </div>
      ))}
      <Button onClick={save} loading={saving}>
        Enregistrer les comptes
      </Button>
    </Stack>
  );
};
