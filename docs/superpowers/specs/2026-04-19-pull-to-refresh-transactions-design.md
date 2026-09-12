# Spécification Technique : Pull-to-Refresh (Transactions)

Cette spécification détaille l'ajout d'une fonctionnalité de "Pull-to-Refresh" (Tirer pour rafraîchir) pour l'onglet Transactions de l'application mobile Suivi Budget.

## 1. Objectif

Permettre aux utilisateurs mobiles de déclencher manuellement l'importation des nouveaux emails Linxo en tirant vers le bas le contenu de l'onglet Transactions, évitant ainsi de devoir chercher le bouton "Rafraîchir mails" dans le panneau des soldes.

## 2. Architecture et Composants

### 2.1. Structure HTML (`public/index.html`)

Ajout d'un conteneur d'indicateur au début du panneau `#tab-transactions` :

```html
<div id="ptr-indicator" class="ptr-indicator">
  <div class="ptr-content">
    <div class="ptr-spinner"></div>
    <span id="ptr-text">Tirez pour rafraîchir...</span>
  </div>
</div>
```

### 2.2. Styles CSS (`public/src/style.css`)

L'indicateur sera masqué par défaut (hauteur 0) et n'apparaîtra que sur mobile :

- `.ptr-indicator` : Hauteur initialement à `0`, `overflow: hidden`, transition sur `height`.
- `.ptr-indicator.active` : Affichage de l'état de traction.
- `.ptr-indicator.loading` : État figé à une hauteur fixe (60px) pendant l'import.
- `.ptr-spinner` : Utilisation d'une version réduite du spinner existant.

### 2.3. Logique JavaScript (`public/src/utils/pull-to-refresh.js`)

Un nouveau module sera créé pour gérer les événements tactiles :

- **Capture** : Détecte un `touchstart` uniquement si `window.scrollY === 0` et si l'onglet actif est `transactions`.
- **Calcul** : Suit le mouvement du doigt (`touchmove`) et applique une résistance (ex: distance / 2) pour la hauteur de l'indicateur.
- **Seuil** : Si la hauteur dépasse 70px, le texte devient "Relâchez pour rafraîchir".
- **Action** : Au `touchend`, si le seuil est atteint, appelle `refreshTransactionsFromEmails()`.
- **Nettoyage** : Une fois la promesse de `refreshTransactionsFromEmails()` résolue (succès ou erreur), l'indicateur se replie.

## 3. Flux de Données et Intégration

- L'action réutilise la fonction globale existante `refreshTransactionsFromEmails()` définie dans `public/src/app.js`.
- Le feedback utilisateur (succès/erreur) continuera d'utiliser le système de `toast` déjà en place.
- L'onglet Transactions sera automatiquement rechargé par la fonction existante après l'import.

## 4. Contraintes et Cas Limites

- **Desktop** : La fonctionnalité doit être désactivée (ou ignorée) sur les écrans larges (> 768px).
- **Défilement** : Ne doit pas interférer avec le défilement naturel vers le bas. On ne capture l'événement que si on tire vers le bas alors qu'on est déjà en haut de la page.
- **Multiples tirs** : L'action est bloquée si un import est déjà en cours (`loading` state).

## 5. Plan de Test

1. **Traction partielle** : Tirer moins de 70px et relâcher -> l'indicateur doit disparaître sans rien déclencher.
2. **Traction complète** : Tirer plus de 70px et relâcher -> l'import doit se lancer, le spinner s'afficher.
3. **Succès de l'import** : Vérifier que l'indicateur se replie et qu'un toast de succès apparaît.
4. **Erreur de l'import** : Vérifier que l'indicateur se replie et qu'un toast d'erreur apparaît.
5. **Desktop** : Vérifier que tirer vers le bas avec la souris ou sur un écran large ne déclenche rien d'inattendu.
