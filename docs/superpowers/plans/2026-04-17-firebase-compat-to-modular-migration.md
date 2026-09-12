# Plan : Migration SDK Firebase compat → modulaire

**Date** : 2026-04-17  
**Auteur** : Claude Code  
**Branche cible** : `claude/investigate-issues-AfEU5`

---

## Goal

Supprimer toutes les dépendances au SDK Firebase compat (variable globale `firebase`) et les remplacer par le SDK Firebase v9 modulaire déjà utilisé dans `services/firebase.ts`, afin que l'app cesse d'afficher "Les scripts Firebase ne se sont pas chargés."

---

## Scope

**In scope**

- Remplacer le check `typeof firebase === 'undefined'` dans `app.js` par l'initialisation modulaire
- Migrer les 36+ appels compat dans `app.js`, `firebase-api.js`, `budget.js`, `patrimoine.js`
- Ajouter `authPortfolio` à `services/firebase.ts`
- Corriger les variables non définies `modularAuth`, `ModularGoogleAuthProvider`, `signInWithCredential` dans `app.js`
- Initialiser `state.db` depuis l'instance modulaire `db`

**Out of scope**

- Refactoring ou nettoyage au-delà de la migration Firebase
- Migration des Cloud Functions côté serveur
- Tests automatisés (pas de suite de tests existante)
- Changements de l'UI ou de la logique métier

---

## Implementation Steps

### Étape 1 — `services/firebase.ts` : ajouter `authPortfolio`

**Fichier** : `public/src/services/firebase.ts`

Ajouter l'export `authPortfolio = getAuth(appPortfolio)` pour remplacer les appels `state._portfolioApp.auth()`.

```ts
export const authPortfolio = getAuth(appPortfolio);
```

---

### Étape 2 — `firebase-api.js` : migrer vers le SDK modulaire

**Fichier** : `public/src/services/firebase-api.js`

Remplacer toutes les fonctions qui wrappent le SDK compat par des équivalents modulaires :

| Compat (actuel)                                      | Modulaire (cible)                              |
| ---------------------------------------------------- | ---------------------------------------------- |
| `db.collection(name)`                                | `collection(db, name)`                         |
| `db.collection(name).doc(id)`                        | `doc(db, name, id)`                            |
| `db.batch()`                                         | `writeBatch(db)`                               |
| `firebase.firestore.FieldValue.delete()`             | `deleteField()`                                |
| `firebase.app().functions(region).httpsCallable(fn)` | `httpsCallable(getFunctions(app, region), fn)` |

**Imports à ajouter** : `collection, doc, writeBatch, deleteField` from `firebase/firestore` ; `getFunctions, httpsCallable` from `firebase/functions` ; `app` from `./firebase.ts`.

**Impact** : Les fonctions `collectionRef`, `docRef`, `createBatch` retournent désormais des références modulaires. Leurs callers dans `app.js` utilisent déjà la syntaxe `.doc().set()` qui est valide sur les références modulaires (via `setDoc(docRef, ...)` → **voir Étape 3**).

---

### Étape 3 — `app.js` : corriger les appels Firestore compat sur les références retournées

**Fichier** : `public/src/app.js`

Les callers de `collectionRef` utilisent la syntaxe compat :

```js
collectionRef(state.db, 'foo').doc(id).set(data);
```

Avec le SDK modulaire, il faut :

```js
import { setDoc, getDoc, getDocs, deleteDoc, doc, query, orderBy, limit } from 'firebase/firestore';
setDoc(doc(state.db, 'foo', id), data);
```

Remplacer les ~30 occurrences. Également remplacer :

- `firebase.firestore.FieldValue.serverTimestamp()` → `serverTimestamp()` (import depuis `firebase/firestore`)

---

### Étape 4 — `app.js` : supprimer le bloc compat d'initialisation (lignes 317-509)

**Fichier** : `public/src/app.js`

Remplacer le bloc entier :

```js
if (typeof firebase === 'undefined') {
  // erreur
} else if (FIREBASE_CONFIG.apiKey === 'REPLACE_ME') {
  // erreur config
} else {
  // Tout le code d'init compat (firebase.initializeApp, firebase.auth().onAuthStateChanged, etc.)
}
```

Par :

```js
if (FIREBASE_CONFIG.apiKey === 'REPLACE_ME' || ...) {
  setLoaderMsg('...');
} else {
  // Init modulaire : setState('db', db) puis onAuthStateChanged(auth, callback)
}
```

**Détail des remplacements dans l'`else` :**

| Compat                                                      | Modulaire                                              |
| ----------------------------------------------------------- | ------------------------------------------------------ |
| `firebase.initializeApp(FIREBASE_CONFIG)`                   | Supprimer (déjà fait dans `services/firebase.ts`)      |
| `new firebase.auth.GoogleAuthProvider()`                    | `googleProvider` (déjà importé)                        |
| `firebase.app('portfolio')` + `firebase.initializeApp(...)` | Supprimer (déjà fait dans `services/firebase.ts`)      |
| `state._portfolioApp.firestore()`                           | `dbPortfolio` (déjà importé)                           |
| `state._portfolioApp.auth().onAuthStateChanged(cb)`         | `onAuthStateChanged(authPortfolio, cb)`                |
| `firebase.auth().onAuthStateChanged(cb)`                    | `onAuthStateChanged(auth, cb)`                         |
| `firebase.auth().signOut()`                                 | `signOut(auth)` — déjà importé comme `modularSignOut`  |
| `setState('db', firebase.firestore())`                      | `setState('db', db)`                                   |
| `firebase.auth().signInWithPopup(googleProvider)`           | `signInWithPopup(auth, googleProvider)`                |
| `ModularGoogleAuthProvider`                                 | `GoogleAuthProvider` (déjà importé)                    |
| `modularAuth`                                               | `auth` (déjà importé)                                  |
| `signInWithCredential(modularAuth, ...)`                    | `signInWithCredential(auth, ...)` + **ajouter import** |
| `state._portfolioApp.auth().signInWithCredential(...)`      | `signInWithCredential(authPortfolio, ...)`             |
| `new firebase.auth.GoogleAuthProvider()` (portfolio)        | `new GoogleAuthProvider()`                             |
| `state._portfolioApp.auth().signInWithPopup(p)`             | `signInWithPopup(authPortfolio, p)`                    |
| `state._portfolioApp.auth().signOut()`                      | `signOut(authPortfolio)`                               |
| `firebase.auth().signOut()` (doSignOut)                     | `signOut(auth)`                                        |
| `modularSignOut(modularAuth)`                               | `modularSignOut(auth)`                                 |

**Imports à ajouter** : `signInWithCredential` from `firebase/auth` ; `authPortfolio` from `./services/firebase.ts`.

---

### Étape 5 — `app.js` : initialiser `state.db` et `state._portfolioDb` tôt

**Fichier** : `public/src/app.js`

Juste avant le bloc `if (FIREBASE_CONFIG.apiKey === 'REPLACE_ME')`, ajouter :

```js
setState('db', db);
setState('_portfolioDb', dbPortfolio);
```

Cela garantit que `state.db` est disponible pour les callers Firestore même avant le callback d'auth.

---

### Étape 6 — `budget.js` : remplacer `firebase.firestore.FieldValue.serverTimestamp()`

**Fichier** : `public/src/budget.js`  
**Lignes** : 708, 731

Ajouter import `serverTimestamp` et remplacer les appels.

---

### Étape 7 — `patrimoine.js` : remplacer les appels compat

**Fichier** : `public/src/patrimoine.js`  
**Lignes** : 651, 697, 746, 762, 778, 797, 1186, 1252

- `firebase.firestore.FieldValue.serverTimestamp()` → `serverTimestamp()`
- `new firebase.auth.GoogleAuthProvider()` → `new GoogleAuthProvider()` + import

---

### Étape 8 — `firebase-setup.js` : nettoyer les appels compat résiduels

**Fichier** : `public/src/firebase-setup.js`  
**Lignes** : 44, 47, 58

Les appels `window.appState._portfolioApp.auth()` sont des vestiges compat. Les remplacer par `signInWithCredential(authPortfolio, ...)` et `signOut(authPortfolio)`.

---

### Étape 9 — Vérification et commit

1. Vérifier que le check `typeof firebase` a disparu
2. Vérifier qu'aucune référence à `firebase.` globale ne subsiste (grep)
3. Builder localement si possible (`npm run build`)
4. Commiter et pousser sur `claude/investigate-issues-AfEU5`

---

## Files to create or modify

| Fichier                               | Action   | Raison                                                           |
| ------------------------------------- | -------- | ---------------------------------------------------------------- |
| `public/src/services/firebase.ts`     | Modifier | Ajouter `authPortfolio`                                          |
| `public/src/services/firebase-api.js` | Modifier | Migration complète vers SDK modulaire                            |
| `public/src/app.js`                   | Modifier | Supprimer bloc compat, corriger appels Firestore/Auth            |
| `public/src/budget.js`                | Modifier | Remplacer `FieldValue.serverTimestamp()`                         |
| `public/src/patrimoine.js`            | Modifier | Remplacer `FieldValue.serverTimestamp()` et `GoogleAuthProvider` |
| `public/src/firebase-setup.js`        | Modifier | Nettoyer appels compat résiduels                                 |

---

## Risks and Mitigations

| Risque                                                                  | Probabilité | Mitigation                                                             |
| ----------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------- |
| Signature API modulaire différente (ex. `setDoc` vs `.set()`)           | Haute       | Lire doc Firebase v9 pour chaque appel remplacé                        |
| `state._portfolioApp` utilisé ailleurs dans le code                     | Moyenne     | Grep complet avant/après ; remplacer par `authPortfolio`/`dbPortfolio` |
| `result.credential` null sur certains navigateurs (bridge auth)         | Faible      | Le try/catch existant suffit                                           |
| `collection().doc().set()` syntaxe compat utilisée par des libs tierces | Faible      | Uniquement code interne                                                |
| Cloud Functions nécessitent une config de région précise                | Faible      | La région `europe-west1` est déjà codée en dur                         |

---

## Open Questions

1. **`state._portfolioApp`** : d'autres modules que `app.js` l'utilisent-ils ? → Grep à confirmer avant l'étape 4.
2. **Cloud Functions** : faut-il importer `app` depuis `services/firebase.ts` dans `firebase-api.js` ou réexporter depuis `firebase-setup.js` ?
3. **`firebase-setup.js`** vs `services/firebase.ts`\*\* : ces deux fichiers font la même chose. La déduplication est hors scope mais à noter pour un futur ticket.
4. **`collectionRef` / `docRef` / `createBatch`** : faut-il garder ces helpers (en les faisant pointer vers les refs modulaires) ou inliner les calls modulaires directement ? Les helpers sont pratiques mais changent de signature.

---

## Awaiting Approval

Ce plan est soumis pour approbation avant toute modification du code.
