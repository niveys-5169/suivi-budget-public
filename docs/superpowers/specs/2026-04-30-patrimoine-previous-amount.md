# Spec: Afficher le montant précédent dans le modal de modification du patrimoine

**Date:** 2026-04-30  
**Status:** Approved  
**Feature:** Afficher la valeur précédente d'un actif patrimoniaux lors de sa modification

---

## Contexte

Lorsqu'un utilisateur modifie la valeur d'un actif du patrimoine (placement manuel), il est utile de voir quelle était la valeur précédente pour prendre conscience du changement. Cette fonctionnalité permet une meilleure visibilité sur l'historique des modifications.

---

## Solution

### Approche sélectionnée

Afficher sous le champ "Valeur Actuelle (€)" une ligne informant de la dernière valeur connue et de sa date.

### Comportement

1. **Pour les placements manuels uniquement** (non-live portfolios)
   - Requêter la collection `placement_history` pour trouver le dernier snapshot
   - Afficher: `Précédent : X XXX € le JJ/MM/AAAA`
   - Si aucun historique disponible, ne rien afficher

2. **Pour les live portfolios** (prefix: `live_pf_` ou `portfolio`)
   - Ne pas afficher l'information (ces valeurs sont auto-synchronisées depuis SuiviPortefeuille)

---

## Implémentation

### Étape 1: Ajouter une fonction dans `usePlacements.tsx`

Créer une fonction `getLastPlacementSnapshot(placementId: string)` qui:

- Interroge la collection `placement_history`
- Filtre par `placementId` ou `id` (selon le schéma)
- Ordonne par `date` descendant
- Retourne le premier résultat `{ montant, date }`

### Étape 2: Modifier `WealthPage.tsx`

- Appeler `getLastPlacementSnapshot` quand un actif est sélectionné
- Passer `previousMontant` et `previousDate` au `PlacementFormModal`

### Étape 3: Modifier `PlacementFormModal.tsx`

- Ajouter des props optionnelles: `previousMontant?: number`, `previousDate?: Date`
- Sous le champ "Valeur Actuelle (€)", ajouter conditionnellement:
  ```tsx
  {
    !isLive && previousMontant !== undefined && (
      <p className="text-[10px] text-platinum/40">
        Précédent : {fmt(previousMontant)} € le {formatDate(previousDate)}
      </p>
    );
  }
  ```

---

## Format d'affichage

- Montant: Format français avec espaces (ex: `4 850 €`)
- Date: `DD/MM/YYYY` (ex: `15/04/2026`)

---

## Considérations

- **Performance:** La requête Firestore doit être légère (index sur `placementId` + tri par `date`)
- **Fallback:** Si l'historique est vide, ne rien afficher plutôt que "Précédent : 0 €"
- **Live portfolios:** Exclus de cette fonctionnalité

---

## Fichiers à modifier

1. `public/src/hooks/usePlacements.tsx` - Ajout de `getLastPlacementSnapshot`
2. `public/src/components/WealthPage.tsx` - Récupération de l'historique lors de la sélection
3. `public/src/components/PlacementFormModal.tsx` - Affichage conditionnel
