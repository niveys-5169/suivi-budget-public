# Maintenance Plan & Application Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Simplify application maintenance by rewriting documentation, unifying backend logic, and transitioning the frontend to a modular React architecture.

**Architecture:**

- **Documentation:** A single comprehensive `README.md`.
- **Backend:** Firebase Functions (Python) as the primary parsing engine.
- **Frontend:** Gradual migration of monolithic JS files (`app.js`, `patrimoine.js`) into React components and hooks.

**Tech Stack:** React, TypeScript, Vite, Firebase (Firestore, Functions, Hosting), Python.

---

### Task 1: Comprehensive README.md Rewrite

**Files:**

- Modify: `README.md`

- [x] **Step 1: Rewrite README.md with the new structure**

````markdown
# Suivi Budget

Suivi Budget est un outil personnel de gestion de finance qui importe automatiquement les transactions Linxo depuis Gmail vers Firebase Firestore, puis les expose via un dashboard web hébergé sur Firebase Hosting.

## Architecture & Flux de Données

Le système suit un flux unidirectionnel :

1.  **Notification Gmail :** Linxo envoie un email de notification pour une nouvelle transaction ou un solde.
2.  **Import Automatique (GitHub Actions) :** Un job planifié lance `src/importer.py` (ou Firebase Functions).
3.  **Parsing & Normalisation :** Le parsing est effectué (priorité à `functions/transaction_parser.py`).
4.  **Stockage Firestore :** Les transactions et soldes sont dédupliqués et stockés.
5.  **Dashboard (Frontend) :** Une application React/Vite affiche les données en temps réel depuis Firestore.

## Composants du Système

### Backend (Python / Firebase Functions)

- `functions/main.py` : Point d'entrée des fonctions Firebase.
- `functions/transaction_parser.py` : Logique de parsing des emails Linxo (Source de vérité).
- `src/importer.py` : Script historique d'import (en cours de migration vers Functions).

### Apps Script (Google Sheets)

- `Code.gs` : Intégration optionnelle avec Google Sheets pour l'historique et le reporting.

### Frontend (React + Vite)

- `public/src/app.js` : Point d'entrée historique (en cours de migration).
- `public/src/components/` : Composants UI réutilisables (.tsx).
- `public/src/hooks/` : Logique d'état et de données (.tsx).
- `public/src/services/` : Interactions avec Firebase.

## Guide de Développement

### Prérequis

- Python 3.11+
- Node.js 20+
- Firebase CLI (`npm install -g firebase-tools`)

### Installation Locale

1.  **Backend :**
    ```bash
    cd functions
    python -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    ```
2.  **Frontend :**
    ```bash
    npm install
    npm run dev
    ```

### Gestion des Secrets

Les secrets sont gérés via GitHub Secrets pour le CI/CD et via un fichier `.env` pour le développement local (non versionné).

## Guide de Maintenance

### Mise à jour du Parsing Linxo

Si le format des emails Linxo change, modifiez `functions/transaction_parser.py`. Assurez-vous d'exécuter les tests unitaires associés.

### Roadmap de Maintenance

1.  **Migration React :** Décomposer `app.js` et `patrimoine.js` en composants.
2.  **Unification Backend :** Supprimer la logique de parsing de `Code.gs` et centraliser sur Firebase Functions.
````

- [x] **Step 2: Commit documentation changes**

```bash
git add README.md
git commit -m "docs: rewrite README.md for better architectural clarity"
```

---

### Task 2: Create useBalances Custom Hook

**Files:**

- Create: `public/src/hooks/useBalances.tsx`

- [x] **Step 1: Implement useBalances hook**

```typescript
import { useState, useEffect } from 'react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';

export interface AccountBalance {
  id: string;
  compte: string;
  solde: number;
  date: string;
  lastUpdated: any;
}

export const useBalances = () => {
  const [balances, setBalances] = useState<AccountBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'account_balances'));
    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const balanceData: AccountBalance[] = [];
        querySnapshot.forEach((doc) => {
          balanceData.push({ id: doc.id, ...doc.data() } as AccountBalance);
        });
        setBalances(balanceData);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching balances:', err);
        setError(err);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  return { balances, loading, error };
};
```

- [x] **Step 2: Commit hook implementation**

```bash
git add public/src/hooks/useBalances.tsx
git commit -m "feat: add useBalances hook for modular balance management"
```

---

### Task 3: Create BalanceCard React Component

**Files:**

- Create: `public/src/components/BalanceCard.tsx`

- [x] **Step 1: Implement BalanceCard component**

```tsx
import React from 'react';
import { AccountBalance } from '../hooks/useBalances';

interface BalanceCardProps {
  balance: AccountBalance;
}

export const BalanceCard: React.FC<BalanceCardProps> = ({ balance }) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  return (
    <div className="balance-card p-4 border rounded shadow-sm bg-white mb-2">
      <div className="text-sm text-gray-500">{balance.compte}</div>
      <div className={`text-xl font-bold ${balance.solde < 0 ? 'text-red-500' : 'text-green-600'}`}>
        {formatCurrency(balance.solde)}
      </div>
      <div className="text-xs text-gray-400">MàJ: {balance.date}</div>
    </div>
  );
};
```

- [x] **Step 2: Commit component implementation**

```bash
git add public/src/components/BalanceCard.tsx
git commit -m "feat: add BalanceCard component"
```

---

### Task 4: Integrate BalanceCard into app.js (Hybrid Approach)

**Files:**

- Modify: `public/src/app.js`

- [x] **Step 1: Prepare app.js for React rendering of balances**

Search for the current balance rendering logic in `app.js` and wrap it or replace it with a React mount point. Since `app.js` is vanilla, we can use `ReactDOM.render` (or `createRoot`) on a specific div.

- [x] **Step 2: Update index.html to include a mount point if needed**

Modify `public/index.html` to ensure there is a `<div id="balances-root"></div>`.

- [x] **Step 3: Commit hybrid integration**

```bash
git add public/src/app.js public/index.html
git commit -m "feat: integrate React BalanceCard into legacy app.js"
```
