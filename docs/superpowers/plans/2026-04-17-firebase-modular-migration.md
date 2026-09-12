# Firebase Modular Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrer l'application vers Firebase JS SDK Modular (npm v10+) et supprimer les dépendances CDN.

**Architecture:** Centralisation dans `services/firebase.ts`, instanciation nommée pour les deux projets, refactorisation des appels globaux `firebase.*`.

**Tech Stack:** Firebase Modular (npm), TypeScript/JavaScript.

---

### Task 1: Mise à jour du service Firebase

**Files:**

- Modify: `public/src/services/firebase.ts`

- [ ] **Step 1: Mettre à jour `firebase.ts` pour supporter deux instances**

```typescript
// public/src/services/firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export const FIREBASE_CONFIG = {
  apiKey: 'YOUR_FIREBASE_API_KEY',
  authDomain: 'suivi-budget-ab888.firebaseapp.com',
  projectId: 'suivi-budget-ab888',
  storageBucket: 'suivi-budget-ab888.appspot.com',
  messagingSenderId: '898723995931',
  appId: '1:898723995931:web:44b8af516df1b6ff8cb3be',
};

export const PORTFOLIO_FIREBASE_CONFIG = {
  apiKey: 'YOUR_PORTFOLIO_FIREBASE_API_KEY',
  authDomain: 'suivi-placements-nico.firebaseapp.com',
  projectId: 'suivi-placements-nico',
  storageBucket: 'suivi-placements-nico.firebasestorage.app',
  messagingSenderId: '925043813681',
  appId: '1:925043813681:web:927379daeeac33667dd410',
};

const appBudget = initializeApp(FIREBASE_CONFIG);
const appPortfolio = initializeApp(PORTFOLIO_FIREBASE_CONFIG, 'portfolio');

export const auth = getAuth(appBudget);
export const db = getFirestore(appBudget);
export const dbPortfolio = getFirestore(appPortfolio);
```

- [ ] **Step 2: Commit**

```bash
git add public/src/services/firebase.ts
git commit -m "refactor: update firebase service for dual-project modular access"
```

### Task 2: Nettoyage index.html

**Files:**

- Modify: `public/index.html`

- [ ] **Step 1: Supprimer les scripts CDN Firebase**

```html
<!-- Remove these lines -->
<!-- 
  <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-functions-compat.js"></script>
-->
```

- [ ] **Step 2: Commit**

```bash
git add public/index.html
git commit -m "chore: remove firebase compat cdn scripts"
```

### Task 3: Refactorisation app.js (Auth & Init)

**Files:**

- Modify: `public/src/app.js`

- [ ] **Step 1: Remplacer l'init globale par le service**

Modifier `app.js` pour importer `auth` et `db` depuis `./services/firebase.ts` au lieu de `firebase-setup.js`. Supprimer l'init globale `firebase.initializeApp`.

- [ ] **Step 2: Mettre à jour `onAuthStateChanged`**

Utiliser `onAuthStateChanged(auth, user => ...)` de `firebase/auth`.

- [ ] **Step 3: Commit**

```bash
git add public/src/app.js
git commit -m "refactor: migrate app.js authentication to modular sdk"
```

### Task 4: Mise à jour des autres modules

**Files:**

- Modify: `public/src/transactions.js`, `public/src/patrimoine.js`, `public/src/budget.js`

- [ ] **Step 1: Remplacer les appels aux fonctions compat par les équivalents modulaires**

Utiliser `doc`, `setDoc`, `updateDoc`, `getDoc` de `firebase/firestore`.

- [ ] **Step 2: Commit**

```bash
git add public/src/transactions.js public/src/patrimoine.js public/src/budget.js
git commit -m "refactor: finish migration of modules to modular firestore api"
```
