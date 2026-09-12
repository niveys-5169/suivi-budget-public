# Design : amélioration du modal de configuration des propriétaires

Date : 2026-04-13

## Objectif

Permettre de configurer les propriétaires de comptes et d'épargnes sans écrire du JSON.
L'utilisateur pourra gérer une liste globale d'owners, puis attribuer ces owners à des comptes et des épargnes via des menus déroulants.

## Contexte

Le modal actuel `owner-mapping` dans `public/src/patrimoine.js` affiche deux champs `textarea` contenant du JSON pour :

- `accounts`
- `savings_patterns`

Cela oblige l'utilisateur à écrire et valider manuellement du JSON, ce qui est lourd et source d'erreurs.

## Nouveau design

### Structure du modal

Le modal restera dans `public/src/patrimoine.js`, mais son interface sera restructurée en trois sections :

1. **Propriétaires**
   - Liste des owners existants
   - Bouton `Ajouter un propriétaire`
   - Édition/suppression d'un owner

2. **Comptes**
   - Tableau de lignes `Nom du compte` + `Propriétaire`
   - Chaque ligne a un `<select>` d'owners
   - Bouton `Ajouter un compte`

3. **Épargnes**
   - Tableau de lignes `Nom de l'épargne` + `Propriétaire`
   - Chaque ligne a un `<select>` d'owners
   - Bouton `Ajouter une épargne`

4. **Owner par défaut**
   - Sélecteur `<select>` lié à la liste globale des owners

### Format de stockage Firestore

Le document `metadata/account_owners_mapping` sera enregistré comme :

```json
{
  "owners": ["Nicolas", "Romane"],
  "accounts": {
    "BforBank": "Nicolas",
    "LCL": "Nicolas"
  },
  "savings_patterns": {
    "Livret Romane": "Romane"
  },
  "default_owner": "Nicolas"
}
```

### Chargement et sauvegarde

- `loadOwnerMappingConfig()` lit désormais `owners`, `accounts`, `savings_patterns`, `default_owner`
- `openOwnerMappingModal()` remplit les champs depuis ces valeurs
- `saveOwnerMappingConfig()` valide :
  - noms d'owners non vide et uniques
  - comptes/épargnes non vide
  - propriétaires sélectionnés existants dans la liste `owners`
- En cas d'erreur, afficher un message clair dans `#owner-mapping-status`

### Validation utilisateur

- Le modal ne devra plus accepter de JSON brut
- Le plus petit flux possible sera :
  1. Ajouter un owner
  2. Ajouter des comptes / épargnes et les associer
  3. Choisir un owner par défaut
  4. Sauvegarder

## Alternatives évaluées

1. **Sélecteur global + tableaux de relations** (recommandé)
   - UX claire
   - Validation forte
   - Maintenance simple

2. **Formulaire libre sans liste globale**
   - Implémentation plus simple
   - Risque d'owners incohérents ou doublons

3. **`<input list>` avec suggestions**
   - Permet création inline
   - Complexité de validation plus élevée

## Points d'implémentation

- Mise à jour de l'UI HTML du modal dans `public/src/patrimoine.js`
- Ajout de fonctions utilitaires pour :
  - créer/mettre à jour les lignes de compte/épargne
  - gérer la liste d'owners
  - valider les données avant enregistrement
- Conserver la compatibilité avec les données Firestore existantes si possible

## Vérification

- Affichage correct du modal avec owners, comptes et épargnes
- Sauvegarde réussie du document Firestore
- Gestion propre des erreurs de validation
- Lecture correcte des données lors de l'ouverture du modal

---

Spec écrite et prête à être revue.
