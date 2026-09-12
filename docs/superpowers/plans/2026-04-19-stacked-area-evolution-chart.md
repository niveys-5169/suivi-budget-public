# Plan : Stacked Area Chart — Évolution Patrimoine par catégorie

**Date** : 2026-04-19  
**Branche** : `claude/stacked-area-chart-b6rqD`

---

## Goal

Remplacer la ligne simple du graphique ÉVOLUTION (Patrimoine) par un stacked area chart Chart.js affichant 4 couches de catégories empilées dans le temps.

---

## Scope

**In scope :**

- Nouvelle fonction `getPatrimoineHistoryByCategory()` retournant les montants par date ET par catégorie
- Modification de `buildPatrimoineEvolutionChart()` pour produire 4 datasets empilés
- Affichage de la légende (cachée actuellement)
- Couleurs cohérentes avec le donut existant

**Out of scope :**

- Modification de `getPatrimoineHistoryByDate()` (encore utilisée par le tableau d'évolution)
- Modification du donut, du tableau, ou d'autres composants

---

## Catégories et couleurs

| Couche             | Filtre sur `_placementHistory`                 | Couleur   |
| ------------------ | ---------------------------------------------- | --------- |
| Comptes courants   | `category === 'courant'`                       | `#8b5cf6` |
| Épargne livrets    | `category === 'epargne_livret'`                | `#10b981` |
| Placements manuels | `category === 'placement'` et `type !== 'per'` | `#f59e0b` |
| Épargne supports   | `category === 'portefeuille'` (hors PER)       | `#06b6d4` |

---

## Implementation Steps

### 1. Ajouter `getPatrimoineHistoryByCategory()`

Dans `patrimoine.js`, après la fonction `getPatrimoineHistoryByDate()` (ligne 942).  
Retourne `{ dates: string[], series: { label, color, data }[] }` en respectant le filtre owner existant.

### 2. Modifier `buildPatrimoineEvolutionChart()`

- Appeler `getPatrimoineHistoryByCategory()` au lieu de `getPatrimoineHistoryByDate()`
- Créer 4 datasets avec `fill: true` et `stack: 'patrimoine'`
- Activer `stacked: true` sur l'axe Y
- Activer la légende (`display: true`)
- Adapter le tooltip pour afficher chaque catégorie + total

---

## Files to Modify

| File                       | Action | Purpose                                                           |
| -------------------------- | ------ | ----------------------------------------------------------------- |
| `public/src/patrimoine.js` | Modify | Ajouter la fonction de catégorisation + modifier le chart builder |

---

## Risks and Mitigations

| Risque                                                     | Mitigation                                                    |
| ---------------------------------------------------------- | ------------------------------------------------------------- |
| Dates absentes pour certaines catégories à une date donnée | Retourner 0 (ne pas interpoler)                               |
| `portefeuille` avec holdings filtrés par owner/account     | Réutiliser la même logique que `getPatrimoineHistoryByDate()` |
| Chart.js stacked area mal configuré                        | Utiliser `fill: 'origin'` + `scales.y.stacked: true`          |
