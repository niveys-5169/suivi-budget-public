# Spécification : Réorganisation des tuiles Budget par Glisser-Déposer

Permettre aux utilisateurs de personnaliser l'ordre des catégories dans l'onglet Budget par un glisser-déposer (Drag & Drop), avec un support spécifique pour le "long-press" sur mobile.

## 1. Objectifs

- Améliorer l'ergonomie en permettant de mettre en avant les catégories les plus importantes pour l'utilisateur.
- Garantir une expérience fluide sur ordinateur (souris) et mobile (toucher).
- Persister l'ordre choisi localement sur le navigateur.

## 2. Architecture Technique

### 2.1 Bibliothèque : `@dnd-kit`

Utilisation de la suite modulaire `@dnd-kit` pour React :

- `@dnd-kit/core` : Logique de base et capteurs.
- `@dnd-kit/sortable` : Gestion des listes ordonnables.
- `@dnd-kit/utilities` : Fonctions utilitaires pour les transformations CSS.

### 2.2 Persistance

- **Stockage** : `localStorage` sous la clé `budget_category_order`.
- **Format** : Tableau de chaînes de caractères (`string[]`) contenant les IDs des catégories (ex: `["Alimentation", "Loisirs", ...]`).

### 2.3 Logique de Tri (Algorithme)

L'ordre final affiché sera calculé comme suit :

1. Charger `customOrder` depuis le `localStorage`.
2. Pour chaque catégorie calculée par le moteur de budget :
   - Si elle est présente dans `customOrder`, utiliser son index.
   - Sinon, la placer à la fin selon le tri par défaut actuel (budget > 0, puis montant dépensé).
3. Lors d'un déplacement réussi (`onDragEnd`), mettre à jour `customOrder` et sauvegarder dans le `localStorage`.

## 3. Composants UI

### 3.1 `BudgetDashboard` (Conteneur)

- Enveloppe la grille de catégories avec `<DndContext>` et `<SortableContext>`.
- Définit les capteurs (`PointerSensor`, `TouchSensor`) pour gérer le délai de 250ms sur mobile.
- Gère l'événement `handleDragEnd` pour mettre à jour l'état local et persistant.

### 3.2 `SortableCategoryTile` (Tuile)

- Utilise le hook `useSortable` de `@dnd-kit`.
- Applique les styles de transformation (CSS `translate`) pendant le drag.
- Gère le feedback visuel :
  - `opacity: 0.5` pour la tuile "fantôme" (celle qui reste à sa place d'origine).
  - Style accentué pour la tuile en cours de déplacement.
  - Curseur `grabbing` sur ordinateur.

## 4. Expérience Mobile (Long-press)

- **Déclencheur** : Appui n'importe où sur la tuile pendant 250ms.
- **Conflit de Scroll** : Le délai de 250ms permet de distinguer un appui pour scroller la page d'un appui pour déplacer une tuile. Si le doigt bouge de plus de 5px avant la fin du délai, le drag est annulé au profit du scroll natif.

## 5. Tests et Validation

- Vérifier que l'ordre est conservé après un rafraîchissement de la page.
- Tester sur mobile que le scroll vertical fonctionne toujours normalement.
- Vérifier que les nouvelles catégories (non encore triées) s'ajoutent correctement à la fin de la liste.
