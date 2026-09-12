import { useEffect } from 'react';
import { useCashflowForecast } from '../../../hooks/useCashflowForecast';
import { useHealthScore } from '../../../hooks/useHealthScore';

/**
 * Composant invisible : log la prévision de trésorerie et le score de santé
 * financière dans l'onglet Console du navigateur à chaque mise à jour des données.
 * Ne rend rien dans l'UI.
 */
export const DevConsoleLogger = () => {
  const forecast = useCashflowForecast(30);
  const health = useHealthScore();

  useEffect(() => {
    console.group('%c💳 Prévision de trésorerie (30 jours)', 'color:#D4AF37;font-weight:bold');
    console.log(
      'Point bas projeté :',
      forecast.lowestPoint.balance.toFixed(2),
      '€',
      '—',
      forecast.lowestPoint.date,
    );
    console.log('Alerte découvert  :', forecast.belowZeroDate ?? 'aucune');
    console.log('Alerte seuil      :', forecast.breachDate ?? 'aucune');
    if (forecast.upcomingEvents.length > 0) {
      console.table(
        forecast.upcomingEvents.map((e) => ({
          date: e.date,
          label: e.label,
          montant: e.amount.toFixed(2) + ' €',
          type: e.type,
        })),
      );
    }
    console.groupEnd();

    console.group('%c🩺 Score de santé financière', 'color:#10B981;font-weight:bold');
    console.log('Score global :', health.score, '/ 100 — Grade', health.grade);
    health.subScores.forEach((s) => {
      console.log(`  ${s.label.padEnd(20)} ${s.score}/100  (${s.detail})`);
    });
    if (health.recommendations.length > 0) {
      console.log('Recommandations :');
      health.recommendations.forEach((r) =>
        console.log(`  [${r.severity.toUpperCase()}] ${r.title} — ${r.desc}`),
      );
    }
    console.groupEnd();
  }, [forecast, health]);

  return null;
};
