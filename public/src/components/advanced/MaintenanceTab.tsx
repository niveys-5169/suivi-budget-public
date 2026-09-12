import React, { useState } from 'react';
import { RefreshCcw, ArrowRightLeft, ShieldCheck, Database, Trash2, Bell } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { usePWAUpdate } from '../../hooks/usePWAUpdate';
import { usePatrimoine } from '../../hooks/usePatrimoine';
import { resetPatrimoine } from '../../utils/resetPatrimoine';
import {
  migrateBackupJson,
  downloadMigratedBackup,
  importMigratedBackup,
  type PatrimoineBackup,
  type OwnersMapping,
  type MigrationSummary,
} from '../../utils/migrateBackup';
import { settingsToast as toast } from './settingsToast';
import { confirm } from '../../lib/confirm';
import { functions } from '../../services/firebase';
import { Button } from '../../ui';

export const MaintenanceTab: React.FC = () => {
  const { isRefreshing, refreshApp } = usePWAUpdate();
  const { cleanupDuplicates, ownerMapping } = usePatrimoine();
  const [isCleaningDuplicates, setIsCleaningDuplicates] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [isSettingUpWatch, setIsSettingUpWatch] = useState(false);
  const [migrationSummary, setMigrationSummary] = useState<MigrationSummary | null>(null);
  const [migratedBackup, setMigratedBackup] = useState<PatrimoineBackup | null>(null);

  const handleSetupGmailWatch = async () => {
    setIsSettingUpWatch(true);
    toast('loading', 'Activation du Gmail Watch en cours…');
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
      toast(
        'success',
        `✓ Gmail Watch activé jusqu'au ${expirationLabel} — historyId : ${result.data.historyId}`,
        8000,
      );
    } catch (err) {
      console.error('Erreur Gmail Watch:', err);
      toast('error', `Échec : ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSettingUpWatch(false);
    }
  };

  const handleCleanupDuplicates = async () => {
    if (
      await confirm({
        message:
          "Nettoyer les doublons de l'historique des placements ? Cette opération supprimera les entrées dupliquées (même actif, même date).",
        danger: true,
      })
    ) {
      setIsCleaningDuplicates(true);
      try {
        const result = await cleanupDuplicates();
        toast(
          'success',
          `✓ Nettoyage terminé : ${result.removed} supprimées, ${result.updated} fusionnées`,
        );
      } catch (err) {
        console.error('Erreur lors du nettoyage:', err);
        toast('error', 'Erreur lors du nettoyage des doublons');
      } finally {
        setIsCleaningDuplicates(false);
      }
    }
  };

  const handleResetPatrimoine = async () => {
    const answer = window.prompt(
      "⚠️ RÉINITIALISATION COMPLÈTE du patrimoine.\n\nSupprime TOUT : historique, placements manuels, soldes comptes & livrets, snapshots. La config des propriétaires est conservée. Un backup JSON est téléchargé d'abord.\n\nEnsuite : relance le backfill du portefeuille pour reconstruire la bourse.\n\nTape REINITIALISER pour confirmer :",
    );
    if (answer !== 'REINITIALISER') {
      if (answer !== null) toast('info', 'Réinitialisation annulée.');
      return;
    }
    setIsResetting(true);
    toast('loading', 'Sauvegarde puis réinitialisation en cours…');
    try {
      const deleted = await resetPatrimoine();
      const total = Object.values(deleted).reduce((s, n) => s + n, 0);
      toast(
        'success',
        `✓ Patrimoine réinitialisé : ${total} entrées supprimées. Relance le backfill du portefeuille.`,
        8000,
      );
    } catch (err) {
      console.error('Erreur lors de la réinitialisation:', err);
      toast(
        'error',
        `Échec de la réinitialisation : ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setIsResetting(false);
    }
  };

  const handleMigrateBackup = async (file: File) => {
    setIsMigrating(true);
    setMigrationSummary(null);
    setMigratedBackup(null);
    try {
      const text = await file.text();
      const raw: PatrimoineBackup = JSON.parse(text);
      const ownerMappingRaw = ownerMapping as unknown as OwnersMapping;
      const { backup, summary } = migrateBackupJson(raw, ownerMappingRaw);
      setMigratedBackup(backup);
      setMigrationSummary(summary);
      toast(
        'success',
        `✓ Migration calculée : ${summary.migrated} IDs migrés, ${summary.skipped} inchangés.`,
      );
    } catch (err) {
      toast('error', `Erreur migration : ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsMigrating(false);
    }
  };

  const handleDownloadMigrated = () => {
    if (migratedBackup) downloadMigratedBackup(migratedBackup);
  };

  const handleImportMigrated = async () => {
    if (!migratedBackup) return;
    const ok = await confirm({
      message: `Écrire ${migrationSummary?.migrated ?? '?'} entrées migrées dans Firestore ?\n\nSavings, comptes courants et historique seront recréés avec les nouveaux IDs.`,
    });
    if (!ok) return;
    setIsMigrating(true);
    try {
      const { db: firestoreDb } = await import('../../services/firebase');
      const written = await importMigratedBackup(migratedBackup, firestoreDb);
      const total = Object.values(written).reduce((s, n) => s + n, 0);
      toast('success', `✓ Réimport terminé : ${total} documents écrits.`, 6000);
      setMigratedBackup(null);
      setMigrationSummary(null);
    } catch (err) {
      toast('error', `Erreur réimport : ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <div className="space-y-10">
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-4">
          <RefreshCcw size={20} className="text-gold" />
          Maintenance Flux & Données
        </h2>
        <p className="text-caption font-medium text-label/40 leading-relaxed max-w-2xl">
          Outils de synchronisation forcée et nettoyage de la base de données.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <button
          onClick={() =>
            toast('info', 'Détection des doublons disponible depuis les insights du dashboard.')
          }
          className="p-8 rounded-xl bg-white/5 border border-separator hover:border-gold/20 hover:bg-gold/5 transition-all text-left group"
        >
          <div className="p-4 rounded-lg bg-gold/10 text-gold w-fit mb-6 group-hover:scale-110 transition-transform">
            <Database size={24} />
          </div>
          <h3 className="text-sm font-bold text-white mb-2">Détection Doublons</h3>
          <p className="text-caption font-medium text-label/40 leading-relaxed">
            Analyse intelligente pour identifier les transactions en double.
          </p>
        </button>

        <button
          onClick={handleCleanupDuplicates}
          disabled={isCleaningDuplicates}
          className="p-8 rounded-xl bg-white/5 border border-separator hover:border-gold/20 hover:bg-gold/5 transition-all text-left group disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <div className="p-4 rounded-lg bg-gold/10 text-gold w-fit mb-6 group-hover:scale-110 transition-transform">
            <RefreshCcw size={24} className={isCleaningDuplicates ? 'animate-spin' : ''} />
          </div>
          <h3 className="text-sm font-bold text-white mb-2">
            {isCleaningDuplicates ? 'Nettoyage...' : 'Nettoyer Doublons Patrimoine'}
          </h3>
          <p className="text-caption font-medium text-label/40 leading-relaxed">
            Supprime les doublons de l&apos;historique des investissements (même actif, même date).
          </p>
        </button>

        <button
          onClick={() => window.location.reload()}
          className="p-8 rounded-xl bg-white/5 border border-separator hover:border-gold/20 hover:bg-gold/5 transition-all text-left group"
        >
          <div className="p-4 rounded-lg bg-gold/10 text-gold w-fit mb-6 group-hover:scale-110 transition-transform">
            <ShieldCheck size={24} />
          </div>
          <h3 className="text-sm font-bold text-white mb-2">Nettoyer le Cache</h3>
          <p className="text-caption font-medium text-label/40 leading-relaxed">
            Vider le cache local et recharger toutes les données Firestore.
          </p>
        </button>

        <button
          onClick={refreshApp}
          disabled={isRefreshing}
          className="p-8 rounded-xl bg-white/5 border border-separator hover:border-gold/20 hover:bg-gold/5 transition-all text-left group disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <div className="p-4 rounded-lg bg-gold/10 text-gold w-fit mb-6 group-hover:scale-110 transition-transform">
            <RefreshCcw size={24} className={isRefreshing ? 'animate-spin' : ''} />
          </div>
          <h3 className="text-sm font-bold text-white mb-2">
            {isRefreshing ? 'Rafraîchissement...' : 'Rafraîchir PWA'}
          </h3>
          <p className="text-caption font-medium text-label/40 leading-relaxed">
            Rafraîchissez l&apos;application en supprimant le cache pour forcer la mise à jour sans
            désinstallation.
          </p>
        </button>

        <div className="p-8 rounded-xl bg-white/5 border border-separator md:col-span-2 space-y-4">
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-lg bg-gold/10 text-gold w-fit">
              <Bell size={24} className={isSettingUpWatch ? 'animate-pulse' : ''} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white mb-1">
                Gmail Watch (Push Notifications)
              </h3>
              <p className="text-caption font-medium text-label/40 leading-relaxed">
                Abonnement Gmail Push via Pub/Sub — les emails Linxo déclenchent l&apos;import en
                temps réel. Renouvellement auto chaque lundi. À relancer si le watch expire.
              </p>
            </div>
          </div>
          <Button
            onClick={handleSetupGmailWatch}
            disabled={isSettingUpWatch}
            loading={isSettingUpWatch}
          >
            {isSettingUpWatch ? 'Activation…' : 'Activer Gmail Watch'}
          </Button>
        </div>

        <button
          onClick={handleResetPatrimoine}
          disabled={isResetting}
          className="p-8 rounded-xl bg-negative/5 border border-negative/20 hover:border-negative hover:bg-negative/10 transition-all text-left group disabled:opacity-60 disabled:cursor-not-allowed md:col-span-2"
        >
          <div className="p-4 rounded-lg bg-negative/10 text-negative w-fit mb-6 group-hover:scale-110 transition-transform">
            <Trash2 size={24} className={isResetting ? 'animate-pulse' : ''} />
          </div>
          <h3 className="text-sm font-bold text-negative mb-2">
            {isResetting ? 'Réinitialisation...' : 'Réinitialiser le Patrimoine (Base saine)'}
          </h3>
          <p className="text-caption font-medium text-label/40 leading-relaxed">
            Supprime tout l&apos;historique, placements, soldes et snapshots. Backup JSON téléchargé
            d&apos;abord, config propriétaires conservée. Reconstruis ensuite la bourse via le
            backfill du portefeuille.
          </p>
        </button>

        {/* Migration backup → IDs lisibles */}
        <div className="p-8 rounded-xl bg-blue-500/5 border border-blue-400/20 text-left md:col-span-2 space-y-4">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-4 rounded-lg bg-blue-500/10 text-blue-400 w-fit">
              <ArrowRightLeft size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-blue-300">Migrer le backup → IDs lisibles</h3>
              <p className="text-caption font-medium text-label/40 leading-relaxed">
                Transforme les assetIds illisibles du backup en{' '}
                <span className="text-blue-300">owner_type_slug</span> avant réimport.
              </p>
            </div>
          </div>

          <label
            htmlFor="migrate-backup-input"
            className={`flex items-center justify-center gap-4 w-full h-14 rounded-lg border-2 border-dashed cursor-pointer transition-all ${isMigrating ? 'opacity-50 cursor-not-allowed border-blue-400/20' : 'border-blue-400/30 hover:border-blue-400/60 hover:bg-blue-500/10'}`}
          >
            <span className="text-caption font-semibold text-blue-400">
              {isMigrating ? 'Analyse en cours…' : 'Charger patrimoine-backup-*.json'}
            </span>
            <input
              id="migrate-backup-input"
              type="file"
              accept=".json"
              className="hidden"
              disabled={isMigrating}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleMigrateBackup(file);
                e.target.value = '';
              }}
            />
          </label>

          {migrationSummary && migratedBackup && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-400/20 text-caption text-blue-300 space-y-1">
                <p className="font-bold">Résumé de migration :</p>
                <p>
                  ✓ {migrationSummary.migrated} IDs migrés · {migrationSummary.skipped} inchangés
                </p>
                {Object.entries(migrationSummary.byCollection).map(([col, s]) => (
                  <p key={col} className="text-blue-300/70">
                    {col} : +{s.migrated} / ={s.skipped}
                  </p>
                ))}
              </div>
              <div className="flex gap-4">
                <button
                  onClick={handleDownloadMigrated}
                  className="flex-1 h-12 rounded-xl bg-blue-500/10 border border-blue-400/30 hover:bg-blue-500/20 text-caption font-bold text-blue-400 transition-all"
                >
                  Télécharger JSON migré
                </button>
                <button
                  onClick={handleImportMigrated}
                  disabled={isMigrating}
                  className="flex-1 h-12 rounded-xl bg-positive/10 border border-positive hover:bg-positive/20 text-caption font-bold text-positive transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isMigrating ? 'Écriture…' : 'Réimporter dans Firestore'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
