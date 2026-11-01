import type { WorkBook } from '@e965/xlsx';
import { importActivite } from './importCalculateursActivite';
import { importFiscal } from './importCalculateursFiscal';
import { creerLecteur, ongletsManquants } from './importCalculateursReader';
import { importRetraite } from './importCalculateursRetraite';
import { recognized, warn, type ImportContext } from './importContext';

/**
 * Lit les paramètres des trois calculateurs (fiscal, retraite, activité) par libellé dans les onglets
 * de saisie. Les calculateurs restent inactifs (`actif: false`) : l'utilisateur les active ensuite.
 */
export function importCalculateurs(wb: WorkBook, ctx: ImportContext): void {
  const manquants = ongletsManquants(wb);
  if (manquants.length > 0) {
    warn(
      ctx,
      `Calculateurs : onglets introuvables (${manquants.join(', ')}), paramètres des calculateurs conservés.`,
    );
    return;
  }
  const l = creerLecteur(wb, ctx);
  const [p1, p2] = ctx.params.personnes;
  ctx.params.calculateurs = {
    actif: ctx.params.calculateurs?.actif ?? false,
    fiscal: importFiscal(l),
    retraite: importRetraite(l, [p1?.id ?? 'p1', p2?.id]),
    activite: importActivite(l, ctx.params.personnes),
  };
  recognized(ctx, 'Calculateurs : fiscal, retraite et activité');
}
