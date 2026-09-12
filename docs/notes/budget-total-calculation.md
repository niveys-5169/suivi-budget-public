# Calcul du « Budget total » (écran Budget)

Le montant affiché dans la carte **Budget** (ex. `11 995,03 €`) est calculé côté front depuis les consommations :

1. On calcule une consommation par budget actif (`computeConsumption`).
2. On exclut les budgets considérés comme revenus (`isIncome === true`).
3. On somme les montants budgétés (`montant`) des catégories de dépense.

Formule (Bankin v2):

```ts
const expenses = consumptions.filter((c) => !c.isIncome);
const budgetTotal = expenses.reduce((s, c) => s + c.montant, 0);
```

Donc `11 995,03 €` = somme des `montant` de toutes les enveloppes de dépenses actives pour la période affichée (avril 2026 sur la capture), **sans** les revenus.

Références de code:

- `public/src/components/budgets-v2/BankinBudgetPage.tsx`
- `public/src/api/consumption.js`
