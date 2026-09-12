# Spécification Technique : Rapprochement Semi-Automatique des Récurrences

## 1. Objectif

Cette spécification décrit l'ajout d'un système de rapprochement semi-automatique des flux bancaires avec les récurrences de dépenses mensuelles dans le tableau de bord premium Aurum (V2).

L'objectif est d'aider l'utilisateur à rapprocher rapidement ses transactions réelles (ex: versement CAF, prélèvement Netflix, etc.) de ses récurrences prévues, directement depuis la page des Flux Bancaires et la vue de détail des transactions.

### Spécifications fonctionnelles :

- **Suggestions Inline :** Si une transaction non pointée matche une récurrence active attendue ce mois-ci, une bannière de suggestion s'affiche sous la transaction dans la liste.
- **Action de Liaison :** L'utilisateur peut cliquer sur "Lier". Cette action :
  1. Enregistre l'approbation de la récurrence pour le mois en cours (`approvedMonths.${monthKey}`) via Firestore.
  2. Marque automatiquement la transaction comme **Pointée** (`pointe: true`) dans Firestore.
- **Option Ignorer (Dismiss) :** L'utilisateur peut rejeter une suggestion. Elle est temporairement masquée de la vue pour la session actuelle (ou stockée localement).
- **Badge persistant :** Si une transaction est déjà liée à une récurrence, un badge persistant _"Lié à la récurrence : [Nom]"_ est affiché pour indiquer la liaison.
- **Intégration du panneau de détails :** La même suggestion de liaison/approbation est intégrée dans la modal de détail de la transaction (`AurumTransactionDetail`).

---

## 2. Architecture & Logique de Rapprochement

Nous utiliserons l'**Approche A** basée sur un hook client-side custom `useRecurrenceReconciliation` (ou une fonction utilitaire intégrée) qui tourne au niveau de la page des flux.

### Logique du matching :

La fonction utilitaire `findRecurrenceMatch` dans [matchRecurrence.ts](../../../public/src/utils/matchRecurrence.ts) est déjà présente et implémente les critères suivants :

1. Catégorie identique.
2. Montant à ±20%.
3. Jour du mois à ±4 jours.

### Algorithme de liaison (Hook ou sélecteur) :

Pour le `monthKey` sélectionné (ex: `"2026-06"`) et la liste complète des transactions et récurrences :

1. On identifie les récurrences déjà approuvées ce mois-ci :
   - On crée un dictionnaire `linkedTxToRecurrence` associant `txId -> Recurrence`.
2. Pour les récurrences non approuvées ce mois-ci, on cherche une transaction correspondante dans la liste des transactions du mois :
   - On filtre les transactions du mois pour exclure celles déjà pointées ou déjà liées.
   - Pour chaque récurrence attendue restante, on utilise `findRecurrenceMatch(recurrence, monthTransactions)`.
   - Si un candidat est trouvé, on l'ajoute dans un dictionnaire `candidateTxToRecurrence` associant `txId -> Recurrence`.
3. L'utilisateur peut masquer une suggestion :
   - On maintient un tableau local `ignoredTxIds` contenant les IDs des transactions pour lesquelles les suggestions ont été ignorées.

---

## 3. UI/UX (Design System Gold / Ink)

### Liste des transactions (`AurumTransactionsPage.tsx`) :

- Si `candidateTxToRecurrence[tx.id]` existe et que `tx.id` n'est pas dans `ignoredTxIds` :
  - Afficher une sous-carte animée (`motion.div`) sous le corps de la transaction.
  - Fond : `bg-gold/5` ou `rgba(212, 175, 55, 0.05)`, avec bordure pointillés `border-dashed border-gold/30`.
  - Contenu : _"🔗 Correspond à la récurrence CAF (prévue le 5, 152,25 €)"_
  - Actions : Bouton "Lier" (style or premium `bg-gold text-ink-deep`), bouton "Ignorer" (contour discret).
- Si `linkedTxToRecurrence[tx.id]` existe :
  - Afficher un badge vert élégant sous les détails de la transaction : _"✓ Lié à la récurrence : [Label]"_.

### Détail de la transaction (`AurumTransactionDetail.tsx`) :

- Intégrer un bloc similaire dans la modal de détail :
  - Si la transaction est un candidat de rapprochement, afficher le bandeau de suggestion avec les boutons d'action au-dessus des boutons Enregistrer/Supprimer.
  - Si déjà liée, afficher un indicateur persistant.

---

## 4. Plan de Vérification

### Tests Automatiques

- Écrire des tests unitaires dans `public/src/utils/__tests__/matchRecurrence.test.ts` pour s'assurer que l'utilitaire de matching identifie correctement les transactions et gère les priorités de score en cas de doublons.

### Manuel Verification

- Se connecter à l'application.
- Créer une récurrence fictive (ex: EDF, 80 € le 5 du mois).
- Importer ou créer une transaction similaire (EDF, 78 € le 7 du mois).
- Vérifier que la suggestion apparaît bien dans la liste des flux bancaires.
- Cliquer sur "Lier" : vérifier que la récurrence passe à l'état payé, et que la transaction est marquée comme pointée (`pointe: true`).
- Cliquer sur "Ignorer" : vérifier que la suggestion disparaît immédiatement.
