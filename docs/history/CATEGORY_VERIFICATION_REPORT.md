# Rapport de Vérification des Catégories

## 📋 Résumé Exécutif

Vérification des deux points demandés :

1. ✅ **Montants positifs/négatifs** : Toutes les catégories acceptent bien les deux types
2. ✅ **Apparition dans les budgets** : Toutes les catégories apparaissent correctement mensuellement et annuellement

---

## 1️⃣ Vérification des Montants Positifs/Négatifs

### Configuration Technique

**Limites acceptées** (`src/importer.py`):

- Min: -50,000€
- Max: +50,000€

### Traitement du Code

#### A) Niveau Données (Firebase)

Les transactions acceptent tout montant entre -50,000€ et +50,000€ sans restriction de catégorie.

#### B) Niveau Dashboard (JavaScript)

**Logique de type de catégorie** (`public/index.html:4278-4291`):

```javascript
function isIncomeCategory(cat) {
  return (CATEGORIES['Revenus'] || []).includes(cat);
}

function isExpenseCategory(cat) {
  return (CATEGORIES['Dépenses'] || []).includes(cat);
}

function getBudgetCategoryKind(cat, incomeActual = 0, expenseActual = 0) {
  if (isIncomeCategory(cat)) return 'income';
  if (isExpenseCategory(cat)) return 'expense';
  // Fallback: déterminer par les montants observés
  if (incomeActual > 0 && expenseActual <= 0) return 'income';
  if (expenseActual > 0 && incomeActual <= 0) return 'expense';
  return incomeActual >= expenseActual ? 'income' : 'expense';
}
```

**Analyse** :

- Les catégories **Revenus** sont marquées comme type `'income'`
- Les catégories **Dépenses** sont marquées comme type `'expense'`
- ✅ **MAIS** : Le code budget n'impose **PAS** de restriction sur les montants possibles
  - Une catégorie "Salaire Nico" (Revenus) peut avoir des montants **négatifs** (remboursement, correction)
  - Une catégorie "Nourriture" (Dépenses) peut avoir des montants **positifs** (remboursement, facture créditée)

**Détermination du montant réel** (`public/index.html:4294-4306`):

```javascript
function buildBudgetActualMaps(transactions) {
  const incomeByCategory = {};
  const expenseByCategory = {};
  (transactions || []).forEach((t) => {
    const cat = t.categorie || 'A Catégoriser';
    if (t.montant > 0) {
      incomeByCategory[cat] = (incomeByCategory[cat] || 0) + t.montant;
    } else if (t.montant < 0) {
      expenseByCategory[cat] = (expenseByCategory[cat] || 0) + Math.abs(t.montant);
    }
  });
  return { incomeByCategory, expenseByCategory };
}
```

✅ **CORRECT** : Le code accumule les montants positifs et négatifs dans les bonnes maps, indépendamment de la catégorie.

### Conclusion Montants

**✅ ACCEPTATION CONFIRMÉE** :

- Toutes les catégories acceptent montants positifs ET négatifs
- Pas de validation au niveau catégorie
- Validation seulement sur la plage absolue: [-50k, +50k]

---

## 2️⃣ Vérification de l'Apparition dans les Budgets

### Catégories Définies

**Dans `public/index.html:3993-4054`** :

#### Dépenses (42 catégories)

```
A Catégoriser, Achats shopping autres, Apple Music, Assistance juridique,
Assurance crédit Maison Gwen, Assurance crédit Maison Nico,
Assurance Extension Gwen, Assurance Extension Nico, Assurance habitation,
Assurance voiture, Cantine + Alae + Centre, CFDT Nico, Crédit Extension,
Crédit Maison, Crédit Maison ProBTP, Crédit voiture, Eau, EDF,
Electricité voiture, Entretien Clim/Chauffage, Entretien voiture + Pneus,
Epargne, Extension, Fibre SFR, Frais bancaires, Habits, iCloud,
Impots fonciers, Kdo Anniversaire nous 4, Kdos Anniversaires,
Mobile Gwen, Mobile Nico, Netflix, Noel Famille, Noels nous 4,
Notes de frais, Nourriture, Prime, Renouvellement Electronique/electromenager,
Santé, Sorties, Sport, Travaux maison, Vacances Autres,
Vacances été (Bretagne), Vacances Noel (Bretagne), Vacances Novembre, Vacances ski
```

#### Revenus (8 catégories)

```
Autres revenus, CAF, Prime vacance, Remboursement,
Retrait Epargne, Salaire Gwen, Salaire Nico, Virements internes
```

### Collecte des Catégories dans le Budget Mensuel

**Code** (`public/index.html:4778-4788`):

```javascript
const allCats = new Set(
  AnnualBudgetLogic.collectBudgetCategories(
    {
      defaults: BUDGET_DEFAULTS,
      annualHistory: BUDGET_ANNUAL_HISTORY,
      monthly: BUDGET_MONTHLY,
    },
    [
      ...CATEGORIES['Dépenses'],
      ...CATEGORIES['Revenus'],
      ...Object.keys(expenseByCategory),
      ...Object.keys(incomeByCategory),
      ...Object.keys(BUDGET_CATEGORY_SELECTION),
    ],
  ),
);
```

### Collecte des Catégories dans le Budget Annuel

**Code** (`public/index.html:4929-4939`):

```javascript
const allCats = new Set(
  AnnualBudgetLogic.collectBudgetCategories(
    {
      defaults: BUDGET_DEFAULTS,
      annualHistory: BUDGET_ANNUAL_HISTORY,
      monthly: BUDGET_MONTHLY,
    },
    [
      ...CATEGORIES['Dépenses'],
      ...CATEGORIES['Revenus'],
      ...Object.keys(expenseByCategory),
      ...Object.keys(incomeByCategory),
      ...Object.keys(BUDGET_CATEGORY_SELECTION),
    ],
  ),
);
```

### Logique `AnnualBudgetLogic.collectBudgetCategories`

**Code** (`public/budget-annual.js:93-101`):

```javascript
function collectBudgetCategories(state, extraCategories = []) {
  const monthlyCategories = Object.values(state?.monthly || {}).flatMap((month) =>
    Object.keys(month || {}),
  );
  return [
    ...new Set([
      ...Object.keys(state?.defaults || {}),
      ...Object.keys(state?.annualHistory || {}),
      ...monthlyCategories,
      ...extraCategories,
    ]),
  ];
}
```

✅ **INCLUSION GARANTIE** :

- Via `extraCategories` : **toutes** les catégories de CATEGORIES sont incluées
- Via `state.defaults` : catégories avec budget par défaut
- Via `state.annualHistory` : catégories avec historique annuel
- Via `state.monthly` : catégories avec exceptions mensuelles
- Via `extraCategories` : catégories des transactions réelles

### Conclusion Budgets

**✅ APPARITION CONFIRMÉE** :

- **Mensuel** : Toutes les catégories CATEGORIES['Dépenses'] + CATEGORIES['Revenus'] sont TOUJOURS incluses
- **Annuel** : Même logique, toutes les catégories sont TOUJOURS incluses
- Aucune catégorie définie n'est exclue
- Des catégories orphelines (hors CATEGORIES mais dans les transactions) apparaissent aussi

---

## 🔍 Cas Particuliers Identifiés

### 1. Catégorie "A Catégoriser"

- ✅ Incluse dans CATEGORIES['Dépenses']
- ✅ Apparaît toujours dans les budgets
- ✅ Accepte montants positifs et négatifs

### 2. Montants Mixtes (positifs ET négatifs sur même catégorie)

**Exemple** : "Salaire Nico" avec:

- +3000€ (vrai salaire)
- -50€ (correction)

**Traitement** (`public/index.html:4298-4303`) :

```javascript
if (t.montant > 0) {
  incomeByCategory[cat] = (incomeByCategory[cat] || 0) + t.montant; // +3000
} else if (t.montant < 0) {
  expenseByCategory[cat] = (expenseByCategory[cat] || 0) + Math.abs(t.montant); // +50
}
```

**Type déterminé** (getBudgetCategoryKind):

- `isIncomeCategory("Salaire Nico")` → **true**
- Donc kind = **'income'**
- ✅ Correct, c'est un revenu malgré la correction

---

## ⚠️ Considérations Importantes

### Affichage Budget : Montants Négatifs

Quand une catégorie de dépense a un montant négatif, cela indique :

- Un remboursement fournisseur
- Une facture créditée
- Une correction de saisie

Le budget affiche correctement ce montant en **rouge** car c'est contre la logique (dépense négative = gain).

### Affichage Budget : Montants Positifs sur Dépenses

Quand une catégorie de revenu a un montant positif dans la section "dépenses", c'est une anomalie de saisie (catégorie mal assignée).

**Solution** : Utiliser le filtre `isIncomeCategory()` / `isExpenseCategory()` pour re-catégoriser manuellement depuis le dashboard.

---

## ✅ Recommandations

1. **Aucune restriction à ajouter** : Le système fonctionne correctement
2. **Documentation** : Clarifier que montants positifs/négatifs ne sont pas limités par catégorie
3. **Validation UI optionnelle** : Pourrait avertir si une dépense a montant > 0 et une revenu < 0 (mais pas obligatoire)

---

## 📊 Résumé Téchnique

| Aspect                 |   Montants Pos/Neg    |     Apparition Budget     |
| ---------------------- | :-------------------: | :-----------------------: |
| Dépenses               |  ✅ Accepte les deux  |   ✅ Toujours incluses    |
| Revenus                |  ✅ Accepte les deux  |   ✅ Toujours incluses    |
| Catégories orphelines  |     ✅ Acceptées      | ✅ Incluses dynamiquement |
| Validation niveau code | ✅ Aucune restriction |          ✅ N/A           |

---

**Vérification effectuée** : 2026-03-29
