# Spécification Technique — Optimisation UX/UI PWA sur iPhone

## 📌 Description du Projet

L'application **Suivi-Budget (AURUM)** dispose d'une interface mobile sous forme de PWA (Progressive Web App). Actuellement, la page **Audit** (Patrimoine) présente des défauts d'utilisabilité :

- Éléments trop denses et "fouillis".
- Cibles tactiles trop petites (zones de clic sous les 44x44px recommandés par Apple HIG).
- Menus et filtres de sélection de propriétaires et de catégories empilés, encombrant la vue.
- La barre de navigation du bas (`MobileBottomNav`) utilise un positionnement `fixed` qui masque une partie des éléments défilants.
- Sur iOS, l'activation des champs de saisie (inputs/selects/textareas) provoque un zoom automatique désagréable car la taille des polices de saisie est inférieure à 16px.

Cette spécification vise à restructurer la page **Audit** et à optimiser l'ensemble de l'interface mobile pour offrir une expérience de niveau "Private Banking" fluide, ergonomique et conforme aux standards iOS.

---

## 🛠 Approche Validée

### 1. Simplification de la page Audit (Patrimoine)

- **Déplacement des filtres :** Retirer les bulles de filtre (`MOwnerScopePills` et `MTypeScopePills`) du haut de la page. Les regrouper dans un bouton unique d'en-tête (icône de filtre) qui ouvre un tiroir coulissant depuis le bas (Bottom Sheet).
- **En-tête épuré :** Déplacer le bouton d'import/export Excel (icône `FileUp`) du corps de page vers le côté droit de l'en-tête, à côté du nouveau bouton de filtre.
- **Cibles tactiles conformes :** Rendre les boutons d'en-tête (`FileUp`, filtre), le bouton d'ajout de placement (`+`), et le bouton de rafraîchissement d'au moins **44x44px** de dimensions de clic réelles.
- **Graphiques plus grands :** Agrandir les filtres de période des graphiques (`6M`, `1Y`, `ALL`) de `text-[9px]` à `text-m-label` (12px) avec un rembourrage plus généreux pour les doigts.
- **Épuration des légendes :** Supprimer les boutons de point trop petits sur le graphique de positions et agrandir les légendes interactives sous le graphique.

### 2. Résolution des contraintes techniques PWA / iOS

- **Positionnement de la barre de navigation :** Modifier `MobileBottomNav` pour qu'elle soit positionnée de façon relative/statique au bas de la flexbox de `MobileShell` (avec `shrink-0`), assurant que la zone de scroll principale (`<main>`) s'arrête exactement au-dessus d'elle sans aucun chevauchement.
- **Anti-Zoom iOS :** Remplacer les classes de police `text-sm` (15px) ou `text-m-body` (15px) sur tous les formulaires et inputs mobiles par la classe `text-base` (16px) pour désactiver le zoom automatique d'iOS lors de la saisie de texte.
- **Respect de la limite de lisibilité (12px) :** Remplacer toutes les occurrences de polices de taille `text-[10px]`, `text-[9px]` ou `text-[8px]` dans les écrans mobiles par `text-m-label` (12px) ou `text-m-caption` (13px), conformément au plancher de lisibilité défini dans `DESIGN_SYSTEM.md`.

---

## 📂 Changements Proposés par Fichier

### [Composant Structurel]

#### [MODIFY] [MobileBottomNav.tsx](../../../public/src/mobile/MobileBottomNav.tsx)

- Remplacer `fixed bottom-0 left-0 right-0` par une disposition statique/relative dans le flexbox parent, avec `shrink-0`.
- Conserver le padding bottom pour la zone d'indicateur d'accueil d'iOS (`env(safe-area-inset-bottom)`).

### [Composants Audit / Graphiques]

#### [MODIFY] [PatrimoineScreen.tsx](../../../public/src/mobile/screens/PatrimoineScreen.tsx)

- Retirer les imports et l'affichage des filtres `MOwnerScopePills` et `MTypeScopePills` en haut de la page.
- Passer à `MScreenHeader` une `rightAction` contenant le bouton Excel (`FileUp`) et le bouton filtre.
- Ajouter un état local pour gérer l'ouverture du tiroir de filtrage.
- Importer et instancier le nouveau composant `MPatrimoineFilterModal` pour afficher le tiroir de filtrage.
- Remplacer les boutons de pointage trop étroits par des conteneurs de taille appropriée (ex: bouton "+" d'ajout de placement de `w-8 h-8` à `w-11 h-11`).
- Modifier les textes à `text-[10px]` en `text-m-caption` ou `text-m-label`.

#### [NEW] [MPatrimoineFilterModal.tsx](../../../public/src/mobile/components/MPatrimoineFilterModal.tsx)

- Créer ce composant sous forme de Bottom Sheet (tiroir remontant du bas).
- Proposer une liste de cases à cocher ou de sélections élégantes pour les propriétaires et les types d'actifs.
- Utiliser des cases à cocher/interrupteurs de dimensions généreuses (min 44px de hauteur par élément).

#### [MODIFY] [MPatrimoineChart.tsx](../../../public/src/mobile/components/MPatrimoineChart.tsx)

- Remplacer `text-[9px]` par `text-m-label` (12px) sur le sélecteur temporel.
- Ajuster les styles de boutons pour assurer une hauteur de clic suffisante.

#### [MODIFY] [MPositionsChart.tsx](../../../public/src/mobile/components/MPositionsChart.tsx)

- Supprimer le menu à base de micro-points de couleur en haut à droite.
- Augmenter la taille du sélecteur temporel (`6M/1Y/ALL`) à `text-m-label`.
- Agrandir les boutons de légende en bas de page pour les rendre facilement cliquables.

### [Composants Saisie / Anti-Zoom iOS]

#### [MODIFY] [QAScreen.tsx](../../../public/src/mobile/screens/QAScreen.tsx)

- Remplacer `text-sm` par `text-base` sur le textarea principal de saisie de question pour désactiver le zoom automatique iOS.

#### [MODIFY] [MAccountReconcileSheet.tsx](../../../public/src/mobile/components/MAccountReconcileSheet.tsx)

- Modifier l'input de montant pour utiliser `text-base` au lieu de `text-m-body` (15px).
- Remplacer toutes les classes `text-[8px]`, `text-[9px]` et `text-[10px]` par des classes autorisées (`text-m-label` ou `text-m-caption`).

#### [MODIFY] [MPlacementFormModal.tsx](../../../public/src/mobile/components/MPlacementFormModal.tsx)

- Modifier les inputs et selecteurs pour utiliser `text-base` au lieu de `text-m-body` ou `text-m-title`.

#### [MODIFY] [MBudgetFormModal.tsx](../../../public/src/mobile/components/MBudgetFormModal.tsx)

- Modifier l'input de montant pour utiliser `text-base`.

#### [MODIFY] [MTransactionFilterModal.tsx](../../../public/src/mobile/components/MTransactionFilterModal.tsx)

- Modifier les éléments de saisie/select pour utiliser `text-base`.

#### [MODIFY] [MAIConfigSheet.tsx](../../../public/src/mobile/components/MAIConfigSheet.tsx)

- Modifier les champs de clé d'API / configuration pour utiliser `text-base`.

#### [MODIFY] [MSettingsModal.tsx](../../../public/src/mobile/components/MSettingsModal.tsx)

- Modifier les formulaires de mot de passe/e-mail et autres paramètres pour utiliser `text-base`.

---

## 🧪 Plan de Vérification

### Vérification Manuelle (PWA iPhone)

1. **Validation du comportement de scroll :** Ouvrir l'application sur mobile, faire défiler la page de flux (transactions) et de patrimoine jusqu'au bout. Confirmer que le dernier élément est entièrement visible au-dessus de la barre de navigation et n'est pas coupé ou caché.
2. **Cibles tactiles :** Taper sur le bouton d'import/export Excel dans l'en-tête de la page Audit, sur le bouton de filtre, et sur les sélecteurs temporels des graphiques. Confirmer qu'ils réagissent immédiatement et sans nécessiter une précision millimétrique.
3. **Anti-Zoom iOS :** Se positionner sur un champ de texte (par exemple dans l'assistant IA ou lors de la modification d'un placement). Cliquer sur le champ, confirmer que le clavier s'ouvre mais que la page web ne subit aucun zoom ou décentrage automatique.
4. **Filtres de Patrimoine :** Cliquer sur le bouton filtre de la page patrimoine, sélectionner un propriétaire (ex: Nicolas) et un type d'actif. Valider que le tiroir se ferme et que les graphiques/totaux se mettent à jour correctement.
