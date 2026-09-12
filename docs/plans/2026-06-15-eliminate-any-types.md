# Plan : Éliminer les 40 `@typescript-eslint/no-explicit-any`

> **Pour l'IA qui code.** Ce document est auto-suffisant. Exécute lot par lot
> (WP-A → WP-G), dans l'ordre proposé. Après **chaque lot** : `npm run typecheck`
> puis `npm run lint`. À la fin : `npm test` + `npm run build`.
> Branche de travail : `claude/elegant-brahmagupta-lvod2q`.

## Contexte & objectif

L'audit du codebase a ramené les warnings ESLint de 73 → 44. Il reste **40
warnings `no-explicit-any`** (et 4 `react-hooks/exhaustive-deps` hors scope ici).
Objectif : **0 `no-explicit-any`**, **sans changement de comportement**.

Règles (cf. `CLAUDE.md`) :

- **Surgical changes** : ne touche QUE ce qui est nécessaire à chaque `any`.
- Réutilise les types existants de `public/src/types/banking.types.ts`,
  `types/patrimoine.ts`, `types/balances.ts`. Ne crée un type que si aucun
  existant ne convient ; place les nouveaux types partagés dans `banking.types.ts`.
- **Interdit** : remplacer `any` par `unknown` SANS narrowing réel, ou par
  `// eslint-disable`. Si un cast est inévitable (typings tiers cassés),
  utilise le type le plus étroit possible et commente pourquoi.
- Zéro régression : `typecheck`, `lint`, `test`, `build` doivent rester verts.

### Inventaire des 40 occurrences (référence)

| Fichier                                                   | Lignes                 |
| --------------------------------------------------------- | ---------------------- |
| `hooks/usePortfolio.tsx`                                  | 55, 58, 61, 61, 62, 62 |
| `hooks/usePatrimoine.tsx`                                 | 135, 141, 142          |
| `utils/cleanupDuplicates.ts`                              | 42, 43                 |
| `components/advanced/AdvancedRoutes.tsx`                  | 38, 46, 55, 56         |
| `hooks/useRecurring.tsx`                                  | 49, 49, 50, 55         |
| `components/shared/DonutChart.tsx`                        | 148                    |
| `components/dashboard/v2/AurumWealthDetailedChart.tsx`    | 16, 48                 |
| `components/dashboard/v2/AurumWealthPositionsChart.tsx`   | 82                     |
| `components/PlacementFormModal.tsx`                       | 58, 59, 61, 62, 62     |
| `components/WealthPage.tsx`                               | 208, 545               |
| `components/analyse/AnalyseSection.tsx`                   | 352, 529               |
| `components/budgets-v2/bankin/BankinBudgetsContainer.tsx` | 69                     |
| `components/TransactionsSection.tsx`                      | 202                    |
| `hooks/useAuth.tsx`                                       | 13                     |
| `hooks/useGlobalSearch.tsx`                               | 23                     |
| `lib/formatters.ts`                                       | 13                     |
| `mobile/MobileShell.tsx`                                  | 7                      |
| `mobile/screens/HomeScreen.tsx`                           | 35                     |
| `utils/positionsHistoryExcel.ts`                          | 118                    |

> Les n° de ligne bougent au fil des edits : relance
> `npx eslint . 2>&1 | grep no-explicit-any` pour la liste à jour.

---

## WP-A — Normalisation des timestamps Firestore (≈ 13 `any`)

**Cause racine** : du code lit des champs date qui, selon la source (Firestore
`Timestamp`, `Date`, ISO string, objet `{seconds,nanoseconds}`), n'ont pas de type
unifié → cascade de `as any`.

### A.1 Créer un type + util partagés

Dans `public/src/types/banking.types.ts`, ajoute :

```ts
import type { Timestamp } from 'firebase/firestore';

/** Toute forme de date rencontrée selon la source (Firestore, JSON, legacy). */
export type FirestoreDateLike =
  | Timestamp
  | Date
  | { toMillis?: () => number; toDate?: () => Date; seconds?: number; nanoseconds?: number }
  | string
  | number
  | null
  | undefined;
```

Crée `public/src/utils/firestoreDate.ts` (extrait la logique déjà présente dans
`hooks/usePortfolio.tsx::portfolioTimestampMs`, qui devient l'implémentation de
référence — voir A.2) :

```ts
import { Timestamp } from 'firebase/firestore';
import type { FirestoreDateLike } from '../types/banking.types';

/** Convertit n'importe quelle forme de date en millisecondes epoch (0 si invalide). */
export function toMillis(value: FirestoreDateLike): number {
  if (!value) return 0;
  if (value instanceof Timestamp) return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'object') {
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (typeof value.seconds === 'number') {
      return value.seconds * 1000 + Math.floor((value.nanoseconds ?? 0) / 1e6);
    }
  }
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}
```

> Vérifie d'abord qu'aucun util équivalent n'existe déjà dans `utils/date.ts` ;
> si oui, étends-le plutôt que d'en créer un.

### A.2 `hooks/usePortfolio.tsx` (lignes 55, 58, 61, 61, 62, 62)

Remplace toute la fonction `portfolioTimestampMs(value: any)` (≈ lignes 55-67) par
un appel à `toMillis` importé de `utils/firestoreDate`. Supprime les `as any`
internes. Mets à jour les appelants de `portfolioTimestampMs` → `toMillis`.

### A.3 `hooks/usePatrimoine.tsx` (lignes 135, 141, 142)

Contexte : tri d'entrées par date.

```ts
if (typeof entry.createdAt === 'object' && 'toDate' in entry.createdAt) {
  return (entry.createdAt as any).toDate();   // 135
}
...
const dateA = new Date(getVal(a) as any).getTime();  // 141
const dateB = new Date(getVal(b) as any).getTime();  // 142
```

Refactor `getVal` pour qu'il retourne directement des **millisecondes** via
`toMillis(entry.date ?? entry.createdAt)`, puis compare les nombres
(`return toMillis(...) ` …). Cela supprime les 3 `any` et l'appel `new Date(...)`.
Type le paramètre `entry` comme l'entrée d'historique réelle (voir WP-C pour le
type `WealthHistoryEntry`).

### A.4 `utils/cleanupDuplicates.ts` (lignes 42, 43)

```ts
const timeA = a.createdAt ? (a.createdAt as any).toMillis?.() || 0 : 0;
```

→ `const timeA = toMillis(a.createdAt);` (idem `timeB`). Type le champ
`createdAt` de l'entrée comme `FirestoreDateLike`.

### A.5 `components/advanced/AdvancedRoutes.tsx` (lignes 38, 46, 55, 56)

Ce sont des **déclarations de champs** dans des interfaces locales :
`receivedAt?: any` (38), `createdAt?: any` (46), `addedAt?: any` (55),
`excludedAt?: any` (56). Remplace chaque `any` par `FirestoreDateLike`.
Si ces champs sont ensuite formatés en date, passe-les par `toMillis`.

---

## WP-B — Typage Recharts (tooltips & props) (4 `any`)

**Cause racine** : les composants de tooltip custom et certaines props Recharts
sont typés `any`.

### B.1 Type tooltip partagé

Dans `banking.types.ts` :

```ts
/** Props d'un tooltip Recharts custom. `T` = forme du datum sous-jacent. */
export interface ChartTooltipProps<T = Record<string, unknown>> {
  active?: boolean;
  payload?: Array<{ value: number; name?: string; color?: string; dataKey?: string; payload: T }>;
  label?: string | number;
}
```

### B.2 `AurumWealthDetailedChart.tsx` (lignes 16, 48)

- L.16 `const CustomTooltip = ({ active, payload }: any) =>` → type le datum.
  Le corps lit `payload[0].payload.fullDate` (et probablement d'autres champs
  série). Définis l'interface du datum de CE chart (ex. `WealthChartDatum` avec
  `fullDate: string` + les clés de séries) et utilise
  `ChartTooltipProps<WealthChartDatum>`.
- L.48 `buildWealthTimeline(placementHistory as any[])` → voir **WP-C** (corrige à
  la source). Une fois `placementHistory` correctement typé, retire `as any[]`.

### B.3 `AurumWealthPositionsChart.tsx` (ligne 82)

`buildWealthTimeline(placementHistory as any[])` → idem WP-C, retire le cast.

### B.4 `shared/DonutChart.tsx` (ligne 148)

```tsx
{...({ activeIndex, activeShape, inactiveShape } as any)}
```

Typings Recharts `<Pie>` incomplets pour ces props. Remplace `any` par un type
explicite minimal, p.ex. :

```ts
type PieActiveShapeProps = {
  activeIndex?: number;
  activeShape?: (props: unknown) => JSX.Element;
  inactiveShape?: (props: unknown) => JSX.Element;
};
```

et cast l'objet en `PieActiveShapeProps`. Garde le commentaire expliquant que
c'est dû à un trou de typage de Recharts.

---

## WP-C — Modèle de données Patrimoine / Wealth (≈ 11 `any`) — le cœur

**Cause racine** : `types/patrimoine.ts::PlacementHistoryEntry` (`{ montant, date:
Date, placementId }`) est **plus étroit que la donnée réelle** manipulée par
`usePatrimoine`/`WealthPage` (qui contient aussi `owner`, `type`, `createdAt`,
`assetId`, etc.). Et il existe **deux** types `Placement` divergents
(`hooks/usePlacements.tsx` et `hooks/usePatrimoine.tsx`).

### C.1 Définir le vrai type d'entrée d'historique

Inspecte ce que `usePatrimoine` met réellement dans `placementHistory` (cherche
les `push`/`map` qui le construisent). Définis dans `types/patrimoine.ts` un type
fidèle, p.ex. :

```ts
export interface WealthHistoryEntry {
  placementId?: string;
  assetId?: string;
  date: string; // ISO — aligne avec RawHistoryEntry (utils/wealthTimeline.ts)
  montant?: number;
  owner?: string;
  type?: string;
  createdAt?: FirestoreDateLike;
}
```

**Important** : `utils/wealthTimeline.ts::RawHistoryEntry` attend `date: string`.
Assure-toi que `WealthHistoryEntry` est **assignable** à `RawHistoryEntry`
(même clé `date: string`, `montant?: number|string`). Si la donnée réelle a
`date: Date`, normalise-la en string AU MOMENT de la construction dans
`usePatrimoine` (pas via cast).

### C.2 Supprimer les `as any[]` sur `buildWealthTimeline`

Dans `AurumWealthPositionsChart.tsx:82` et `AurumWealthDetailedChart.tsx:48`,
type `placementHistory` comme `WealthHistoryEntry[]` (via le type retourné par le
hook) et passe-le directement : `buildWealthTimeline(placementHistory)`.

### C.3 `WealthPage.tsx` (lignes 208, 545)

- L.208 `placementHistory.map((h) => (h as any).owner || …)` → `h: WealthHistoryEntry`,
  donc `h.owner` sans cast.
- L.545 `placement={selectedAsset as any}` : le state `selectedAsset`
  (`WealthPage.tsx:87`, type objet inline) doit être aligné sur le type
  `placement?: Placement` attendu par `PlacementFormModal`. Deux options :
  1. Type `selectedAsset` directement comme `Placement` (de `usePlacements`).
  2. Si les formes diffèrent légitimement, élargis la prop de `PlacementFormModal`
     (voir C.4). Choisis l'option qui n'altère pas le runtime ; documente.

### C.4 `PlacementFormModal.tsx` (lignes 58, 59, 61, 62, 62)

Le composant lit des **alias legacy** absents du type `Placement` :
`name`, `ownerId`, `balance`, `compte`, `account`.

```ts
nom: placement?.nom || (placement as any)?.name || '',
owner: placement?.owner || (placement as any)?.ownerId || 'Nicolas',
montant: placement?.montant || (placement as any)?.balance || 0,
compte: (placement as any)?.compte || (placement as any)?.account || '',
```

Ajoute ces champs en **optionnels** sur le type accepté par le modal. Définis :

```ts
/** Champs legacy tolérés sur d'anciens documents placement. */
export interface LegacyPlacementFields {
  name?: string;
  ownerId?: string;
  balance?: number;
  compte?: string;
  account?: string;
}
```

et type la prop : `placement?: Placement & Partial<LegacyPlacementFields>`.
Supprime les `as any`. (Place `LegacyPlacementFields` près du type `Placement`
réutilisé, idéalement dans `hooks/usePlacements.tsx` à côté de `Placement`.)

> **Bonus recommandé (hors scope strict)** : unifier les deux `Placement`
> (`usePlacements` vs `usePatrimoine`). Ne le fais QUE si ça reste sûr et testé ;
> sinon laisse une note `// TODO: unify Placement types`.

---

## WP-D — Réglages récurrents : casts superflus (`useRecurring.tsx` 49, 49, 50, 55)

**`RecurringExpense` (banking.types.ts) possède DÉJÀ `customAmount?: number` et
`id?: string`.** Les casts sont donc inutiles. `setting` est typé
`RecurringExpense | undefined` (via `settingsLookup.byId/byAlias`).

Remplace simplement :

```ts
(setting as any)?.customAmount  →  setting?.customAmount
(setting as any).customAmount   →  setting.customAmount   // dans la branche déjà gardée
(setting as any)?.id            →  setting?.id
```

`typecheck` confirmera que rien d'autre n'est requis.

---

## WP-E — Filtres de transactions (`AnalyseSection.tsx:529`, `TransactionsSection.tsx:202`)

Même motif aux deux endroits :

```tsx
onFilterChange={(name, value) => updateFilters({ [name]: value } as any)}
```

La prop `onFilterChange` de `TransactionFilters` est
`(name: string, value: string) => void` (`components/TransactionFilters.tsx:16`).
Le `as any` masque que `{ [name]: value }` est un objet à clé string passé à
`updateFilters` (qui attend un `Partial<Filters>`).

Fix recommandé :

1. Identifie le type `Filters` consommé par `updateFilters` (depuis
   `TransactionContext`).
2. Restreins la signature : `onFilterChange: (name: keyof Filters, value: string) => void`
   dans `TransactionFilters.tsx`, et fais émettre `name` comme `keyof Filters`.
3. Aux call-sites, remplace `as any` par `as Partial<Filters>` :
   `updateFilters({ [name]: value } as Partial<Filters>)`.

Si élargir la signature s'avère trop invasif (beaucoup de call-sites), au minimum
remplace `as any` par `as Partial<Filters>` (étroit, pas `any`).

---

## WP-F — Lecture d'un global supprimé (`AnalyseSection.tsx:352`, `BankinBudgetsContainer.tsx:69`)

```ts
const winCats = (window as any).CATEGORIES;
const cats = winCats?.Revenus ? new Set<string>(winCats.Revenus) : new Set<string>();
```

`window.CATEGORIES` a été **retiré** (cf. `constants/categories.js` :
« le preset legacy window.CATEGORIES n'existe plus » et `ARCH_STATE.md`). Cette
lecture renvoie donc toujours `undefined` → **branche morte**.

**Fix préféré (supprime le `any` ET du code mort)** : retire la lecture de
`window.CATEGORIES` et dérive `incomeCats` depuis la source canonique des
catégories (vérifie `constants/categories.js` / le contexte budget pour la liste
des catégories « Revenus »). Conserve un comportement identique (l'ensemble était
vide en pratique).

**Si tu n'es pas sûr de la source de remplacement** : ne devine pas. Replie-toi
sur un fix purement typant — déclare le global dans
`public/src/types/globals.d.ts` :

```ts
interface Window {
  CATEGORIES?: { Revenus?: string[]; [k: string]: string[] | undefined };
}
```

et remplace `(window as any).CATEGORIES` par `window.CATEGORIES`. Signale dans le
résumé que la branche reste morte (à nettoyer plus tard).

---

## WP-G — Cas isolés (6 `any`)

### G.1 `hooks/useAuth.tsx:13`

```ts
user: any; // Using any to avoid User import issues...
```

→ `import type { User } from 'firebase/auth';` puis `user: User | null;`.
Vérifie que `AuthContext` expose bien un `User | null` (sinon aligne le type).

### G.2 `hooks/useGlobalSearch.tsx:23`

```ts
searchGlobal(debouncedQuery, transactions as any[], NAVIGABLE_PAGES);
```

`searchGlobal` attend `TxLike[]` (`utils/searchGlobal.ts:10`,
`{ libelle: string; amount?: number; date?: string; ... }`). Vérifie que
`Transaction` (banking.types) satisfait `TxLike`. Si oui : retire le cast
(`transactions`). Sinon : `transactions as unknown as TxLike[]` n'est PAS
acceptable — adapte plutôt `TxLike` ou mappe. Idéal : exporte `TxLike` et fais
`Transaction extends`/satisfait `TxLike`.

### G.3 `lib/formatters.ts:13`

```ts
.map((k) => `${k}:${(options as any)[k]}`)
```

`options: Intl.NumberFormatOptions`. → `(options as Record<string, unknown>)[k]`
ou mieux `options[k as keyof Intl.NumberFormatOptions]`.

### G.4 `mobile/MobileShell.tsx:7`

```ts
(window.navigator as any).standalone;
```

`navigator.standalone` est non-standard (iOS Safari). →
`(window.navigator as Navigator & { standalone?: boolean }).standalone`.

### G.5 `mobile/screens/HomeScreen.tsx:35`

```ts
const [editingTx, setEditingTx] = useState<any>(null);
```

→ `import type { Transaction } from '../../types/banking.types';` puis
`useState<Transaction | null>(null)`. Corrige les usages si le typage révèle des
accès invalides.

### G.6 `utils/positionsHistoryExcel.ts:118`

```ts
return rows.map((row: any) => { ... });
```

`rows: unknown[]`. Une ligne de tableur = objet clé→cellule. Type :
`(row: Record<string, unknown>)` et accède aux colonnes via cast étroit par
cellule (`String(row['Colonne'] ?? '')`, `Number(...)`), ou définis un
`RawExcelRow = Record<string, string | number | undefined>`.

---

## Ordre d'exécution & vérification

1. **WP-A** (timestamps) → typecheck + lint
2. **WP-D** (récurrents, trivial) → typecheck + lint
3. **WP-G** (isolés) → typecheck + lint
4. **WP-E** (filtres) → typecheck + lint
5. **WP-B** (Recharts) → typecheck + lint
6. **WP-F** (global supprimé) → typecheck + lint
7. **WP-C** (patrimoine, le plus délicat — en dernier) → typecheck + lint

### Vérification finale (obligatoire, doit être verte)

```
npm run typecheck     # 0 erreur
npm run lint          # 0 erreur ; no-explicit-any == 0
npm test              # suite verte (≈ 548 tests)
npm run build         # build OK
```

Contrôle ciblé : `npx eslint . 2>&1 | grep -c no-explicit-any` doit afficher `0`.

### Commits

Un commit par WP (ou par groupe cohérent), message descriptif. Push sur
`claude/elegant-brahmagupta-lvod2q`. **Pas de PR** sauf demande explicite.

## Pièges connus

- Ne « corrige » pas un `any` en cascade : si typer une source révèle d'autres
  `any` non listés, c'est normal — traite-les ou note-les, ne les masque pas.
- `PlacementHistoryEntry.date` est `Date` mais `RawHistoryEntry.date` est `string` :
  normalise à la **construction** des données, jamais par cast (WP-C.1).
- `RecurringExpense` a déjà les champs : pour WP-D, **ne pas** redéclarer, juste
  retirer les casts.
- WP-F lit un global mort : préfère la suppression du code mort ; le fallback
  typant via `globals.d.ts` n'est qu'un repli si la source de remplacement est
  incertaine.
