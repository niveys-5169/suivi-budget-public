import { useEffect } from 'react';
import { useCashflowForecast } from '../../../hooks/useCashflowForecast';

/**
 * Composant invisible : log la prévision de trésorerie dans l'onglet Console
 * du navigateur à chaque mise à jour des données.
 * Ne rend rien dans l'UI.
 */
export const DevConsoleLogger = () => {
  const forecast = useCashflowForecast(30);

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
  }, [forecast]);

  return null;
};
