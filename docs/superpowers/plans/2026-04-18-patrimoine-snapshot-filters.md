# Plan : Filtres propriétaire sur l'évolution du patrimoine

**Date :** 2026-04-18  
**Branche :** `claude/patrimoine-snapshot-filters-h9fXT`

---

## Goal

Permettre à l'utilisateur de filtrer le graphique d'évolution historique du patrimoine par propriétaire, avec un graphique empilé (stacked area) affichant une série par propriétaire.

---

## Scope

**In scope :**

- Chips de filtre cliquables par propriétaire dans `PatrimoineSummary`
- Graphique d'évolution empilé (stacked area) par propriétaire dans `PatrimoineCharts`
- Calcul de l'évolution mensuelle agrégée depuis `placementHistory` brut (groupé par `monthKey` + `owner`)
- Comportement "aucun filtre = tous les propriétaires affichés (chacun sa série)"

**Out of scope :**

- Modification du système vanilla JS (`patrimoine.js`) — priorité au React
- Filtre par propriétaire sur le graphique de répartition (doughnut)
- Sauvegarde du filtre sélectionné entre sessions
- Filtrage des tableaux (Courants, Épargne, Placements) par owner — c'est un autre ticket

---

## Implementation steps

### Étape 1 — `PatrimoineSummary.tsx` : chips cliquables

1. Ajouter `onToggleOwner: (owner: string) => void` au type `PatrimoineSummaryProps`
2. Transformer le bloc `ownerBreakdown` en chips cliquables avec style actif/inactif (s'inspirer du pattern `.cat-chip` de `CategoryFilterChips.tsx`)
3. Un clic sur un chip appelle `onToggleOwner(owner)` — la logique toggle reste dans le parent (`PatrimoineSection`)

### Étape 2 — `PatrimoineSection.tsx` : câbler les chips

1. Passer `onToggleOwner` à `<PatrimoineSummary>` :
   ```tsx
   onToggleOwner={(owner) => setSelectedOwners(prev =>
     prev.includes(owner) ? prev.filter(o => o !== owner) : [...prev, owner]
   )}
   ```
2. Passer `selectedOwners`, `allOwners` (= `ownerMapping.owners`) et `history` (= `placementHistory`) à `<PatrimoineCharts>`

### Étape 3 — `PatrimoineCharts.tsx` : graphique empilé

1. Ajouter les props : `selectedOwners: string[]`, `allOwners: string[]`
2. Calculer via `useMemo` les données agrégées depuis `history` :
   - Grouper par `monthKey` (tri asc)
   - Pour chaque mois, sommer `montant` par `owner`
   - Liste des owners à afficher = `selectedOwners.length > 0 ? selectedOwners : allOwners`
3. Palette de couleurs fixe par index d'owner (ex: `['#8b5cf6', '#10b981', '#06b6d4', '#f59e0b', '#ec4899', '#6366f1']`)
4. Remplacer le graphique line actuel par un `type: 'line'` avec :
   - `fill: true` (area)
   - `stacked: true` sur l'axe Y
   - Un `dataset` par owner
5. Mettre à jour l'effet `useEffect` pour dépendre de `selectedOwners` et des données calculées
6. Le titre du graphique affiche le filtre actif si pertinent

---

## Files to create or modify

| File                                          | Action | Purpose                                                     |
| --------------------------------------------- | ------ | ----------------------------------------------------------- |
| `public/src/components/PatrimoineSummary.tsx` | modify | Ajouter prop `onToggleOwner`, rendre les chips cliquables   |
| `public/src/components/PatrimoineSection.tsx` | modify | Câbler toggle owner, passer props à PatrimoineCharts        |
| `public/src/components/PatrimoineCharts.tsx`  | modify | Graphique empilé par owner avec `useMemo` pour l'agrégation |

---

## Risks and mitigations

| Risque                                                                                                        | Mitigation                                                                                   |
| ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Anciens snapshots sans champ `owner`                                                                          | Fallback sur `ownerMapping.default_owner` ou `'(sans propriétaire)'`                         |
| `placementHistory` contient des doublons par type pour un même mois (ex: plusieurs entrées courant + épargne) | L'agrégation par `monthKey + owner` somme tous les `montant` — c'est le comportement attendu |
| `allOwners` de `ownerMapping` ne couvre pas tous les owners dans l'historique                                 | Dériver la liste des owners depuis `history` (union avec `ownerMapping.owners`)              |
| Graphique vide si aucun historique                                                                            | Conserver le guard `history.length > 0` existant                                             |

---

## Open questions

_Aucune — l'approche a été validée avec l'utilisateur : priorité React, graphique empilé._
