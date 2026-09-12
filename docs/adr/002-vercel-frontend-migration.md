# 2. Migration du Déploiement Frontend vers Vercel

Date: 2026-05-18

## Statut

Accepté

## Contexte

Le projet "Suivi-Budget" comportait un frontend React/Vite déployé sur Firebase Hosting via un workflow GitHub Actions (`deploy-hosting.yml`).
Cependant, l'utilisation de GitHub Actions pour le build et le déploiement du frontend consommait un nombre important de minutes CI/CD.
Avec de nombreuses tâches lourdes en arrière-plan (import Linxo/Enable Banking, tests, Cloud Functions en Python), il est devenu nécessaire d'optimiser l'utilisation de GitHub Actions.

## Décision

Nous avons décidé de migrer l'hébergement et le build du frontend (React/Vite) vers **Vercel**.

- Vercel prend en charge nativement les builds de Vite et déploie le frontend sans frais de minutes CI/CD supplémentaires de GitHub Actions.
- Vercel fournit également des environnements de "Preview" pour chaque Pull Request de manière automatisée.
- L'infrastructure backend (Firebase Functions en Python), la base de données Firestore, ainsi que les tâches CRON complexes restent gérées par GitHub Actions et Google Cloud / Firebase.

## Conséquences

### Positives

- **Réduction des coûts / limites** : Économie drastique des minutes GitHub Actions.
- **Preview Deployments** : Aperçus gratuits générés automatiquement par Vercel pour chaque branche/PR.
- **Simplification CI/CD** : Suppression du workflow GitHub Action dédié à Firebase Hosting.

### Négatives / Contraintes

- **Variables d'environnement** : Les variables `VITE_*` (et celles associées à Firebase, Google Auth, etc.) doivent désormais être configurées et synchronisées manuellement via le tableau de bord Vercel.
- **Configuration éclatée** : La configuration globale de l'hébergement est scindée entre `firebase.json` (backend/firestore) et `vercel.json` (frontend/rewrites/headers).

## Actions entreprises

- Suppression de `.github/workflows/deploy-hosting.yml`.
- Retrait du bloc `"hosting"` du fichier `firebase.json`.
- Création du fichier `vercel.json` contenant les en-têtes de sécurité (CSP, etc.) et les `rewrites` pour les routes SPA et autres pages HTML.
- Rédaction d'un guide pas-à-pas de configuration Vercel (`docs/VERCEL_ENV_SETUP.md`).
