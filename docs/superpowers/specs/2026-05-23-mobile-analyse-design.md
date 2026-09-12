# Spec: Mobile Analyse Screen (Lot 5)

## 1. Objectif

Remplacer l'écran d'analyse desktop par une version mobile-first optimisée pour la visualisation rapide de la répartition des dépenses, revenus et récurrences par mois.

## 2. Architecture & Components

L'écran sera situé dans `public/src/mobile/screens/AnalyseScreen.tsx`.

### Composants à créer :

- **`MMonthNavigator`** : Navigation entre les mois (Précédent / Mois Courant / Suivant).
- **`MSegmentedControl`** : Switch entre 3 modes : "Sorties", "Entrées", "Récurrences".
- **`MDashboardSummary`** : Deux cartes côte à côte affichant le total des Entrées et le total des Sorties du mois.
- **`MCategoryDonut`** : Graphique en anneau (utilisant `recharts`) avec le montant total au centre.
- **`MCategoryRow`** : Ligne de liste affichant l'icône, le nom de la catégorie, le montant et une mini barre de progression.

## 3. Data Flow

- **Hooks consommés** :
  - `useTransactions` : Pour récupérer les transactions du mois sélectionné.
  - `useAppState` : Pour lire et modifier le `monthKey` (YYYY-MM).
  - `useGlobalData` : Pour les métadonnées de catégories (icônes/couleurs) et les réglages de récurrences.
- **Logique de calcul** :
  - Agrégation des transactions par catégorie selon le mode sélectionné.
  - Calcul du pourcentage de chaque catégorie par rapport au total du mode.

## 4. Design & Typography

- **Header** : `text-m-display` (22px).
- **KPI Dashboard** : Labels en `text-m-label`, montants en `text-m-title`.
- **Chart Center** : Montant principal en `text-m-hero` (ajusté si besoin pour tenir dans le donut).
- **Liste** : Libellés en `text-m-title`, montants en `text-m-title font-bold`.

## 5. Cas d'erreur & Edge cases

- **Zéro donnée** : Afficher un état vide ("Aucune donnée pour ce mois") si aucune transaction n'est trouvée.
- **Chargement** : Utiliser un skeleton ou un spinner pendant le calcul des agrégats.

## 6. Audit Success Criteria

- [ ] Le navigateur de mois met à jour les données instantanément.
- [ ] Le switch Sorties/Entrées/Récurrences change le graphique et la liste.
- [ ] Le dashboard récapitulatif affiche les bonnes valeurs globales du mois.
- [ ] Aucune regression sur les hooks existants.
