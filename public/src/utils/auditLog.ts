import type {
  AuditAction,
  AuditChange,
  AuditDomain,
  AuditEntry,
  AuditValue,
} from '../types/banking.types';

type Doc = Record<string, unknown>;

const MAX_LENGTH = 300;
/** Champs techniques, sans intérêt pour le lecteur du journal. */
const IGNORED_FIELDS = new Set(['updatedAt', 'createdAt', 'importedAt']);
/** Champ portant le libellé lisible d'un document, par domaine. */
const LABEL_FIELD: Record<AuditDomain, string> = {
  transaction: 'libelle',
  budget: 'categorie',
  recurrence: 'label',
};

/** Sentinelle Firestore (`deleteField()`, `serverTimestamp()`, `arrayUnion()`…). */
const sentinelName = (value: unknown): string | null =>
  typeof value === 'object' && value !== null && '_methodName' in value
    ? String((value as { _methodName: unknown })._methodName)
    : null;

/** JSON aux clés d'objet triées : l'ordre des clés ne compte pas comme une modification. */
const stableStringify = (value: unknown): string =>
  JSON.stringify(value, (_key, v: unknown) =>
    typeof v === 'object' && v !== null && !Array.isArray(v)
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, (v as Doc)[k]]),
        )
      : v,
  );

/** Valeur simple complète, avant troncature (pour comparer). */
function toFullValue(value: unknown): AuditValue {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') {
    return value;
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return stableStringify(value);
}

const truncate = (value: AuditValue): AuditValue =>
  typeof value === 'string' ? value.slice(0, MAX_LENGTH) : value;

/** Réduit une valeur Firestore à une valeur simple, stockable et affichable. */
export const toAuditValue = (value: unknown): AuditValue => truncate(toFullValue(value));

const isEmpty = (value: AuditValue) => value === null || value === '';

/**
 * Champs du `patch` qui diffèrent de l'état précédent. Sans état précédent
 * connu (`before` absent), seule la nouvelle valeur est rapportée.
 */
export function diffChanges(before: Doc | undefined, patch: Doc): AuditChange[] {
  const changes: AuditChange[] = [];
  for (const [field, raw] of Object.entries(patch)) {
    if (IGNORED_FIELDS.has(field)) continue;
    const sentinel = sentinelName(raw);
    if (sentinel && sentinel !== 'deleteField') continue;
    // Comparaison sur les valeurs complètes ; seule la valeur stockée est tronquée.
    const to = sentinel ? null : toFullValue(raw);
    if (!before) {
      changes.push({ field, to: truncate(to) });
      continue;
    }
    const from = toFullValue(before[field]);
    if (from === to || (isEmpty(from) && isEmpty(to))) continue;
    changes.push({ field, from: truncate(from), to: truncate(to) });
  }
  return changes;
}

/** Libellé lisible du document : celui du patch, sinon celui de l'état précédent. */
export function auditLabel(domain: AuditDomain, before?: Doc, patch?: Doc): string {
  const field = LABEL_FIELD[domain];
  const value = patch?.[field] ?? before?.[field];
  return typeof value === 'string' ? value : '';
}

export const DOMAIN_LABELS: Record<AuditDomain, string> = {
  transaction: 'Transaction',
  budget: 'Budget',
  recurrence: 'Récurrence',
};

const ACTION_LABELS: Record<AuditAction, string> = {
  create: 'Création',
  update: 'Modification',
  delete: 'Suppression',
};

const FIELD_LABELS: Record<string, string> = {
  categorie: 'Catégorie',
  category: 'Catégorie',
  libelle: 'Libellé',
  label: 'Libellé',
  montant: 'Montant',
  annualMontant: 'Montant annuel',
  expectedAmount: 'Montant attendu',
  amountHistory: 'Historique des montants',
  date: 'Date',
  anchorDate: 'Date de référence',
  compte: 'Compte',
  commentaire: 'Commentaire',
  pointe: 'Pointage',
  moisAffectation: "Mois d'affectation",
  ventilation: 'Ventilation',
  type: 'Type',
  actif: 'Actif',
  active: 'Active',
  isIncome: 'Revenu',
  month: 'Mois',
  year: 'Année',
  moisAttendus: "Mois d'échéance",
  categories: 'Catégories exclues',
  skippedPeriod: 'Mois ignoré',
  linkedTx: 'Transaction liée',
  rejectedTx: 'Rattachement refusé',
};

const formatValue = (value: AuditValue | undefined): string => {
  if (value === true) return 'oui';
  if (value === false) return 'non';
  if (value === null || value === undefined || value === '') return '(vide)';
  return String(value);
};

/** « Catégorie : Divers → Courses ». */
export function describeChange({ field, from, to }: AuditChange): string {
  const label = FIELD_LABELS[field] ?? field;
  if (to === undefined) return `${label} : ${formatValue(from)} retiré`;
  if (from === undefined) return `${label} : ${formatValue(to)}`;
  return `${label} : ${formatValue(from)} → ${formatValue(to)}`;
}

/** Résumé d'une ligne : l'action (sauf simple modification), puis les champs. */
export function describeEntry(entry: AuditEntry): string {
  const parts = entry.changes.map(describeChange);
  if (entry.action !== 'update' || parts.length === 0) parts.unshift(ACTION_LABELS[entry.action]);
  return parts.join(' · ');
}

const DATE_FORMAT = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

/** « 14/11/2026 09:30 » ; l'horodatage serveur d'une ligne tout juste écrite est inconnu. */
export const formatAuditDate = (at: Date | null): string =>
  at ? DATE_FORMAT.format(at) : "À l'instant";
