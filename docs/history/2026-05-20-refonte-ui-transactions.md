# Design : Refonte de l'interface de la liste des transactions

Date : 2026-05-20

## Objectif

Améliorer l'ergonomie et l'esthétique de la liste des transactions. L'interface actuelle est probablement une simple table HTML. L'objectif est de la transformer en un outil interactif, moderne et plus dense en informations utiles, tout en étant plus agréable à utiliser.

## Problèmes de l'interface actuelle (Hypothèses)

- **Manque d'interactivité** : Pas de tri, de recherche ou de filtres dynamiques.
- **Lisibilité** : Les informations ne sont pas hiérarchisées, les montants positifs/négatifs ne sont pas visuellement distincts.
- **Densité** : Trop ou pas assez d'informations visibles, pas de pagination.
- **Esthétique datée** : Utilisation de styles par défaut du navigateur, manque d'aération.
- **Pas d'édition rapide** : Pour changer une catégorie ou pointer une transaction, il faut probablement passer par un modal complexe ou éditer en base de données.

## Nouveau design

La nouvelle interface s'articulera autour d'un tableau de données enrichi, inspiré des applications modernes de gestion.

### 1. Zone de Contrôles (Filtres et Actions)

Au-dessus du tableau, une barre de contrôles permettra :

- **Champ de recherche** : Un `<input type="text">` pour filtrer par libellé ou commentaire en temps réel.
- **Filtres déroulants** :
  - **Comptes** : Un `<select multiple>` pour choisir un ou plusieurs comptes.
  - **Catégories** : Un `<select multiple>` pour filtrer par catégories.
  - **Période** : Un sélecteur de dates (par exemple, `react-datepicker`) pour choisir une plage de dates.
  - **Statut "Pointé"** : Des boutons pour voir les transactions "Pointées", "Non pointées", ou "Toutes".
- **Bouton d'action** : Un bouton `+ Ajouter une transaction` pour ouvrir un modal de saisie manuelle.

### 2. Le Tableau des Transactions (`TransactionTable`)

Le tableau sera modernisé pour une meilleure lisibilité.

- **Style** :
  - Lignes avec couleurs alternées (`bg-gray-50` sur les lignes paires).
  - Espacement et `padding` généreux.
  - Effet `hover` sur les lignes pour indiquer l'interactivité.

- **Colonnes** :
  - **Date** : Format court (ex: `25/05/26`).
  - **Libellé** : Texte principal. Le commentaire pourrait être affiché dans une infobulle au survol.
  - **Catégorie** : Affichée sous forme de "badge" ou "tag" coloré pour une identification rapide.
  - **Compte** : Nom du compte.
  - **Montant** :
    - **Couleur** : Rouge pour les débits (`-`), vert pour les crédits (`+`).
    - **Alignement à droite** pour faciliter la lecture des chiffres.
  - **Pointé** : Une simple icône (coche ou cercle) cliquable pour basculer l'état `pointe`.
  - **Actions** : Une colonne avec des icônes pour "Éditer" et "Supprimer".

### 3. Comportement Dynamique

- **Édition en ligne (Inline Editing)** : Cliquer sur une cellule (ex: catégorie) la transforme en `<select>` pour une modification rapide sans recharger la page.
- **Tri** : Cliquer sur les en-têtes de colonnes (Date, Montant) trie le tableau.
- **Pagination** : Gérer les grands volumes de données avec des contrôles "Précédent" / "Suivant".

### 4. Structure des Composants React (Proposition)

Pour implémenter cela, l'architecture pourrait être :

- `pages/TransactionsPage.tsx` : Le conteneur principal qui gère l'état (filtres, données chargées).
- `components/transactions/TransactionFilters.tsx` : La barre de contrôles (recherche, filtres).
- `components/transactions/TransactionTable.tsx` : Le tableau qui reçoit les données filtrées.
- `components/transactions/TransactionRow.tsx` : Le composant pour une seule ligne, gérant l'affichage et les actions (pointage, édition).
- `components/transactions/EditTransactionModal.tsx` : Un modal pour l'édition complète ou l'ajout.

### Exemple visuel d'une ligne de transaction

```
| 25/05/26 | Achat Amazon.fr | [Shopping] | BforBank | -42,99 € | (✓) | [✎] [🗑] |
```

Où `[Shopping]` est un badge coloré, `(✓)` une icône de pointage, et `[✎] [🗑]` des icônes d'action.

## Points d'implémentation

1.  **Créer la structure des composants** React comme suggéré ci-dessus.
2.  **Utiliser un hook `useTransactions`** qui récupère les données depuis Firestore et les met à jour en temps réel.
3.  **Gérer l'état des filtres** dans le composant `TransactionsPage` avec `useState`.
4.  **Appliquer la logique de filtrage et de tri** en JavaScript sur les données reçues avant de les passer au `TransactionTable`.
5.  **Implémenter les fonctions de mise à jour Firestore** pour le pointage, l'édition et la suppression, à appeler depuis `TransactionRow`.
6.  (Optionnel) Utiliser une librairie de tableau comme `react-table` ou `ag-grid` pour obtenir beaucoup de ces fonctionnalités (tri, filtre, pagination) prêtes à l'emploi.

## Alternatives Évaluées

1.  **Tableau enrichi custom (recommandé)** : Contrôle total sur le design et le comportement. C'est plus de travail mais le résultat est parfaitement intégré.
2.  **Utiliser une librairie de composants UI (ex: MUI, Ant Design)** : Leurs composants `DataTable` sont très puissants mais peuvent imposer un style visuel qui détonne avec le reste de l'application.
3.  **Utiliser une librairie "headless" (ex: TanStack Table)** : Fournit la logique (tri, filtre, pagination) sans imposer le style. Excellent compromis entre custom et tout-en-un.

---

Cette refonte transformera la simple consultation de données en une véritable expérience d'analyse et de gestion.
