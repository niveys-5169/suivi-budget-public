import type { Alert, BankConnection, BankReconciliationReport } from '../types/banking.types';
import { bankDateMillis } from './bankDateMillis';

const DAY = 86_400_000;
export function computeBankingAlerts(
  connections: BankConnection[],
  reports: BankReconciliationReport[],
  now: number,
): Alert[] {
  const alerts: Alert[] = [];
  for (const connection of connections) {
    if (connection.mode === 'disabled') continue;
    const expiry = bankDateMillis(connection.validUntil);
    const base = {
      actionTab: '/connexions',
      time: 'Connexion bancaire',
      episodeKey: `${connection.id}:${connection.errorCode ?? 'expiry'}:${bankDateMillis(connection.errorSince) || expiry}`,
    };
    if (connection.status === 'reconnect' || (expiry > 0 && expiry <= now)) {
      alerts.push({
        ...base,
        id: `bank-auth-${connection.id}`,
        type: 'error',
        title: `${connection.bank} : reconnexion nécessaire`,
        desc: 'L’accès Enable Banking doit être renouvelé. Linxo continue de fonctionner.',
      });
    } else if (connection.status === 'technical_error' || connection.status === 'temporary_error') {
      alerts.push({
        ...base,
        id: `bank-error-${connection.id}`,
        type: connection.status === 'technical_error' ? 'error' : 'warning',
        title: 'Synchronisation bancaire échouée',
        desc: `${connection.bank} : réessayez la synchronisation. Si le problème persiste, vérifiez la connexion bancaire.`,
      });
    } else if (expiry > 0 && expiry - now <= 7 * DAY) {
      alerts.push({
        ...base,
        id: `bank-expiry-${connection.id}`,
        type: 'warning',
        title: 'Autorisation bancaire bientôt expirée',
        desc: `${connection.bank} : renouvelez l’accès dans les 7 prochains jours.`,
      });
    }
    const success =
      bankDateMillis(connection.lastSuccessAt) || bankDateMillis(connection.createdAt);
    if (connection.accounts.some((a) => a.enabled) && success && now - success >= 36 * 3_600_000) {
      alerts.push({
        ...base,
        episodeKey: `${connection.id}:stale:${success}`,
        id: `bank-stale-${connection.id}`,
        type: 'warning',
        title: 'Données bancaires non actualisées',
        desc: `${connection.bank} : aucune synchronisation réussie depuis 36 heures.`,
      });
    }
  }
  for (const report of reports) {
    if (report.monitoringEnabled === false) continue;
    for (const missing of report.missing ?? []) {
      alerts.push({
        id: `bank-missing-${missing.id}`,
        episodeKey: `${missing.id}:${bankDateMillis(missing.firstBookedAt)}`,
        type: 'warning',
        title: 'Opération non retrouvée dans les notifications Linxo',
        desc: `${missing.compte} : ${missing.libelle}. Le rapprochement reste actif.`,
        time: 'Plus de 7 jours',
        actionTab: '/connexions',
      });
    }
    const since = bankDateMillis(report.firstUnresolvedAt);
    if (
      since &&
      now - since >= 7 * DAY &&
      (report.status === 'waiting' || report.status === 'discrepancy')
    ) {
      alerts.push({
        id: `bank-balance-${report.id}`,
        episodeKey: `${report.id}:${since}`,
        type: 'warning',
        title:
          report.status === 'waiting'
            ? 'Vérification du solde impossible'
            : 'Écart de solde à vérifier',
        desc: `${report.compte} : contrôle non résolu depuis 7 jours.`,
        time: 'Solde bancaire',
        actionTab: '/connexions',
      });
    }
  }
  return alerts;
}
