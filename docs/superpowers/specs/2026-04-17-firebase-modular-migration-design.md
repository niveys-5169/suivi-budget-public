# Firebase Modular Migration Design

## Objectif

Migration complète de l'application (Projets "Suivi-Budget" et "SuiviPortefeuille") du SDK Firebase Compat (CDN) vers le SDK Firebase Modular (npm).

## Architecture

1.  **Centralisation** : Les instances Firebase (App, Auth, Firestore) seront gérées exclusivement dans `public/src/services/firebase.ts`.
2.  **Double Instance** : Création de deux instances nommées distinctes (`appBudget`, `appPortfolio`) pour gérer la séparation des projets.
3.  **Unification Auth** : L'état d'authentification sera géré par une seule instance `auth` (principale), les composants se synchronisant sur cet état unique. Le pont `signInWithCredential` sera supprimé.
4.  **Dépendances** : Retrait des balises script `firebase-*-compat.js` dans `index.html`.

## Plan de migration

### 1. Services (firebase.ts)

Extension du service pour supporter deux instances :

```typescript
// public/src/services/firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const appBudget = initializeApp(FIREBASE_CONFIG);
const appPortfolio = initializeApp(PORTFOLIO_FIREBASE_CONFIG, 'portfolio');

export const auth = getAuth(appBudget);
export const db = getFirestore(appBudget);
export const dbPortfolio = getFirestore(appPortfolio);
```

### 2. UI / HTML

Suppression des balises `<script>` CDN dans `index.html`.

### 3. Logique (app.js et modules)

Remplacement systématique de `firebase.auth()` et `firebase.firestore()` par les fonctions modulaires importées de `firebase/auth` et `firebase/firestore`.

## Risques et atténuations

- **Perte de persistance auth** : Le SDK modulaire gère la persistance différemment, mais est généralement compatible. Les tests devront vérifier que `onAuthStateChanged` est bien déclenché à la reconnexion.
- **Conflits de noms** : Bien vérifier l'utilisation de `initializeApp` avec des noms d'apps distincts.
