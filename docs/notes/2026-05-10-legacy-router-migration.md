# Notes de migration — 2026-05-10

## Contexte

Objectif : terminer la migration des pages avancées legacy vers des routes React Router natives et nettoyer les ponts DOM/legacy restants.

## Changements appliqués

### 1. Routes avancées React natives

- Ajout de `public/src/components/advanced/AdvancedRoutes.tsx`.
- Ce fichier contient les nouvelles pages avancées React suivantes :
  - `TronityPage`
  - `RAVConfigPage`
  - `RulesPage`
  - `MappingsPage`
  - `FusionPage`
  - `ReparsePage`
  - `ExcludedEmailsPage`

### 2. Mise à jour de `MainApp`

- Modification de `public/src/MainApp.tsx` pour remplacer les anciennes routes legacy bridgées par `LegacyPage`.
- Les routes suivantes pointent désormais vers des composants React natifs :
  - `/tronity`
  - `/mappings`
  - `/fusion`
  - `/rav-config`
  - `/reparse`
  - `/excluded`
  - `/rules`
- Un commentaire de route a également été mis à jour pour refléter qu’il s’agit maintenant de pages avancées natives React.

### 3. Nettoyage de la passerelle legacy

- Suppression de `public/src/components/LegacyPanel.tsx`.
- Suppression de `public/src/components/legacy/LegacyPage.tsx` (le dossier `public/src/components/legacy` est désormais vide).
- Aucun import restant vers `LegacyPage` ou `LegacyPanel` dans `public/src`.

### 4. Correction de l’import Firebase

- Correction de `public/src/app.js` : suppression de l’import invalide de `PORTFOLIO_FIREBASE_CONFIG` depuis `firebase-setup.js`.
- Ce code était la cause d’une erreur de build bloquante.

### 5. Ajustement de `AdvancedSettings`

- `public/src/components/AdvancedSettings.tsx` a été modifié pour utiliser la navigation React Router au lieu des anciens wrappers de navigation legacy.

## Résultat

- Le build frontend est validé avec `npm run build`.
- L’erreur d’import `PORTFOLIO_FIREBASE_CONFIG` est résolue.
- Les pages avancées legacy ne dépendent plus du pont DOM legacy pour le routing.

## Points restants / remarques

- Le build affiche encore des avertissements de chunking pour `AnalyseSection.tsx` et `PatrimoineSection.tsx`.
- Il reste possible de poursuivre le nettoyage en supprimant tout code legacy encore présent dans `public/src/app.js` si SPA `BOTTOMNAV_V2` devient le mode principal.
