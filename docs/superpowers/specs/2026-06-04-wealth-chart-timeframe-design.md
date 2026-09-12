# Spécification Technique : Sélecteur de Période & Filtres Repliables du Graphique de Patrimoine

## 1. Objectif

Cette spécification décrit l'ajout d'un sélecteur de période (timeframe) et la refactorisation des filtres du graphique d'évolution du patrimoine (`WealthEvolutionBudgetChart`) dans un panneau repliable.

### Spécifications de la Période :

- **Période par défaut :** Du 1er février 2024 au jour J (date actuelle, dynamique).
- **Raccourcis prédéfinis :** `1M` (30 jours), `6M` (6 mois), `1A` (1 an), `Depuis fév. 24` (par défaut), `Tout` (toute l'histoire).
- **Mode personnalisé :** Option `Perso` qui dévoile deux sélecteurs de date (début et fin).
- **PWA & Parité mobile/desktop :** Le composant doit s'adapter de manière responsive et fluide.

---

## 2. Architecture & Design UI

Les filtres actuels du composant `WealthEvolutionBudgetChart` (Propriétaires, Types de positions) ainsi que le nouveau filtre de Période seront regroupés dans un tiroir ou panneau repliable à l'intérieur de la carte du graphique.

### Rendu visuel (Design System Gold / Ink) :

- **Bouton de contrôle (Filtres) :**
  - Placé en haut à droite de la carte, à côté du titre.
  - Utilise l'icône Lucide `SlidersHorizontal` (ou `Filter` s'il n'est pas disponible) avec le texte "Filtres".
  - Couleur : Accent `gold` quand le panneau est ouvert, bordure discrète `white/10` quand il est fermé.
- **Indicateur d'état replié :**
  - Un fil d'ariane ou résumé micro-texte est affiché discrètement sous le titre quand le panneau est replié pour rappeler la période active (ex: `Période : Fév 2024 - J`).
- **Panneau déplié :**
  - Fond `bg-white/[0.02]` avec bordure subtile.
  - Transition fluide (avec Framer Motion si possible, ou simple transition CSS de hauteur/opacité) pour une sensation premium.
  - Dispose les 3 lignes de contrôles de manière responsive.
- **Responsive PWA :**
  - Sur mobile, les contrôles s'empilent et se centrent avec des boutons de taille adaptée (hauteur minimum tactile de 44px).
  - Les champs de type `<input type="date">` utiliseront le sélecteur natif sur mobile pour une ergonomie optimale.

---

## 3. Gestion des Données et Règle d'Agrégation (Fill-Forward)

> [!IMPORTANT]
> Pour conserver la valeur consolidée exacte du patrimoine au début de la période choisie (par exemple le 1er février 2024), **l'agrégation temporelle (fill-forward) doit être calculée sur l'ensemble de l'historique d'abord**, puis les points résultants doivent être filtrés par date.
> Si on filtrait l'historique brut avant d'appeler `buildWealthTimeline`, le graphique commencerait à 0 € ou ignorerait les actifs n'ayant pas eu de mouvements après le 1er février 2024.

### Algorithme de filtrage :

1. Calculer la timeline complète :
   ```typescript
   const points = buildWealthTimeline(history, { ownerFilter: selectedOwners });
   ```
2. Filtrer le tableau de points en comparant les timestamps des dates :
   ```typescript
   const startTs = new Date(startDateStr).getTime();
   const endTs = new Date(endDateStr).getTime();
   const filteredPoints = points.filter((p) => p.timestamp >= startTs && p.timestamp <= endTs);
   ```
3. Utiliser `filteredPoints` pour alimenter le graphique AreaChart.

---

## 4. Plan de Vérification

### Tests Automatiques

- Vérifier que la sélection d'une période filtre correctement les points retournés par le graphique.
- S'assurer que le calcul du patrimoine de départ prend bien en compte l'historique antérieur (pas de chute à 0 €).

### Vérification Manuelle

- Tester le bouton "Filtres" sur Desktop et sur l'émulateur mobile/PWA pour s'assurer que le panneau s'ouvre de manière fluide.
- Sélectionner "Perso" et modifier les dates de début et de fin pour s'assurer que le graphique se met à jour immédiatement.
