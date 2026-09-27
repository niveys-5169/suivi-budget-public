import React, { useEffect, useState } from 'react';
import { getGitHubSettings, saveGitHubSettings } from '../../services/firebase-api';
import { toast } from '../../lib/toast';
import { Button, Field, Input, Stack } from '../../ui';

/**
 * Dépôt GitHub qui exécute l'import (GitHub Actions). Enregistré dans
 * Firestore, donc partagé par tous les appareils — la version mobile
 * précédente n'écrivait que dans le localStorage.
 */
export const GitHubSettingsForm: React.FC = () => {
  const [owner, setOwner] = useState('');
  const [repo, setRepo] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getGitHubSettings()
      .then((settings) => {
        if (!settings) return;
        setOwner(settings.owner);
        setRepo(settings.repo);
      })
      .catch((err) => console.warn('Paramètres GitHub indisponibles :', err));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveGitHubSettings(owner.trim(), repo.trim());
      toast.success('Dépôt GitHub enregistré');
    } catch (err) {
      console.error('Erreur GitHub :', err);
      toast.error("Échec de l'enregistrement. Vérifiez votre connexion.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack gap="md">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Propriétaire">
          {(p) => (
            <Input
              {...p}
              value={owner}
              placeholder="niveys-5169"
              autoComplete="off"
              onChange={(e) => setOwner(e.target.value)}
            />
          )}
        </Field>
        <Field label="Dépôt">
          {(p) => (
            <Input
              {...p}
              value={repo}
              placeholder="Suivi-Budget"
              autoComplete="off"
              onChange={(e) => setRepo(e.target.value)}
            />
          )}
        </Field>
      </div>
      <Button variant="primary" block onClick={handleSave} loading={saving}>
        Enregistrer
      </Button>
    </Stack>
  );
};
