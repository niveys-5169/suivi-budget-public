# Spécification de Conception : Simplification du Dashboard & Horizon de Trésorerie Dynamique

Ce document détaille la simplification de la page console (le tableau de bord principal) sur Desktop et Mobile/PWA, en retirant les éléments superflus pour ne conserver que les informations essentielles demandées par l'utilisateur.

## Objectifs

1. **Simplification de la Console (Dashboard) :**
   - Conserver uniquement la liste des comptes courants et leur solde global.
   - Conserver la section des transactions non pointées (avec la modale de pointage).
   - Conserver la projection de trésorerie avec un sélecteur d'horizon dynamique (30, 60, 90 jours).
   - Afficher les détails des prévisions prises en compte jusqu'au point bas de trésorerie.
   - Supprimer le score de santé financière (`AurumHealthScore`).
   - Supprimer les widgets secondaires non requis (comme les actions rapides sur Desktop et le bandeau budget / assistant IA sur Mobile) pour épurer la page.

2. **Évolutions de la projection de trésorerie (`AurumCashflowCard`) :**
   - Intégrer un état local `horizon` (30 | 60 | 90 jours), contrôlé par un `<select>` stylisé dans l'en-tête de la carte.
   - Calculer la liste chronologique des événements planifiés entre aujourd'hui et la date du point bas de trésorerie (`forecast.lowestPoint.date`).
   - Rendre cette liste défilable verticalement (`max-h-60 overflow-y-auto`) pour éviter d'étirer l'affichage de manière démesurée sur les horizons longs.

---

## Architecture & Modifications

### 1. Composant de Trésorerie : `public/src/components/dashboard/v2/AurumCashflowCard.tsx`

- **Horizon State :**
  ```typescript
  const [horizon, setHorizon] = useState<ForecastHorizon>(30);
  ```
- **Sélecteur d'horizon dans l'en-tête :**
  Remplacement de l'affichage textuel `"Trésorerie — 30 jours"` par `"Trésorerie — "` suivi d'un élément `<select>` stylisé en Gold/transparent avec une flèche personnalisée pour modifier l'état `horizon`.
- **Calcul des événements du point bas :**
  ```typescript
  const eventsBeforeLowest = useMemo(() => {
    if (!forecast.lowestPoint.date) return [];
    return forecast.days
      .filter((day) => day.date <= forecast.lowestPoint.date)
      .flatMap((day) => day.events);
  }, [forecast.days, forecast.lowestPoint.date]);
  ```
- **Rendu du détail :**
  Affichage des éléments de `eventsBeforeLowest` dans un conteneur avec la classe `max-h-60 overflow-y-auto pr-1` pour un défilement propre.

### 2. Layout Desktop : `public/src/components/dashboard/v2/AurumDashboard.tsx`

- Supprimer l'importation et l'usage de `<AurumHealthScore />`.
- Retirer la section des actions rapides (Virer, Demander, Budget, Intelligence) pour désencombrer le haut de page.

### 3. Layout Mobile : `public/src/mobile/screens/HomeScreen.tsx`

- Supprimer l'importation et l'usage de `<AurumHealthScore />`.
- Retirer la section "Budget mensuel" et le bouton de raccourci "Assistant IA" pour aligner le mobile sur la même simplicité fonctionnelle que le Desktop.

---

## Plan de Validation

### Tests Automatisés

- Lancement de `npm test` pour s'assurer qu'aucun test de régression n'est rompu.
- Lancement de `npm run typecheck` pour la validation TypeScript.
- Lancement de `npm run build` pour valider la production.

### Validation Manuelle

- Vérifier visuellement le style du menu déroulant de l'horizon de trésorerie sur Desktop et Mobile.
- S'assurer que le changement d'horizon met à jour le point bas ainsi que les prévisions affichées.
- Vérifier que la hauteur de la liste des prévisions reste bridée à `240px` (max-h-60) avec une barre de défilement discrète.
