# AURUM v3 — Design System

> Référence **exécutoire** de l'interface. Chaque règle de ce document est
> vérifiée par `npm run check:design` : ce n'est pas une intention, c'est un
> garde-fou.
>
> Source unique : `public/src/ui/`. Deux arbres d'écrans la consomment —
> `public/src/components/` (desktop) et `public/src/mobile/` (PWA).

---

## 1. Principes

| Principe                                     | Traduction concrète                                                                                                                     |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Plat, pas glassmorphique**                 | Le `backdrop-blur` et l'ombre sont réservés aux surfaces flottantes : nav, sheet, modale. Une carte est une surface opaque, sans ombre. |
| **Séparer par l'espace, pas par la bordure** | Une section = un titre + du vide. On retire une bordure avant d'en ajouter une.                                                         |
| **Zéro carte imbriquée**                     | Une `<Card>` ne contient jamais de `<Card>`. À l'intérieur : `<List>`/`<ListItem>`, ou `<Stack>` + `<Separator>`.                       |
| **Hiérarchie par la taille et le poids**     | Pas de majuscules pour hiérarchiser. Seul `<Text variant="overline">` en conserve.                                                      |
| **Grille de 8 px**                           | Sous-pas unique de 4 px, réservé aux gaps icône/texte.                                                                                  |

---

## 2. Tokens

Déclarés dans **`public/src/ui/tokens.css`** (bloc `@theme`), avec un miroir
TypeScript dans **`public/src/ui/tokens.ts`** pour les charts et les styles
inline. Aucun écran ne redéfinit une valeur qui vit là.

> Les échelles Tailwind par défaut (`rounded-*`, `text-*`, `shadow-*`,
> `zinc-*`) sont volontairement **écrasées** : du code écrit sans connaître le
> système tombe dedans au lieu de le contredire.

### Rayons — plafond 16 px

| Classe         | Valeur | Usage                                                      |
| -------------- | ------ | ---------------------------------------------------------- |
| `rounded-sm`   | 8 px   | Badges, chips, tuiles d'icône, barres de progression       |
| `rounded-md`   | 10 px  | Boutons, inputs, segmented control                         |
| `rounded-lg`   | 12 px  | Cartes, lignes de liste — **le défaut**                    |
| `rounded-xl`   | 16 px  | Sheets, modales — **plafond absolu**                       |
| `rounded-full` | —      | Avatars, pastilles, pills — jamais un conteneur de contenu |

**Règle du rayon imbriqué :** `radius_enfant ≤ radius_parent − padding_parent`.
Si un enfant doit épouser le coin, mettre `overflow-hidden` sur le parent —
c'est ce que fait `<List>`.

### Espacement — grille de 8 px

| Classe | px  | Usage                                    |
| ------ | --- | ---------------------------------------- |
| `-1`   | 4   | Gap icône/texte — seul sous-pas autorisé |
| `-2`   | 8   | Gap interne serré                        |
| `-4`   | 16  | Padding de carte, gap de liste           |
| `-6`   | 24  | Padding d'écran, gap entre cartes        |
| `-8`   | 32  | Gap entre sections                       |
| `-12`  | 48  | Respiration de bloc                      |
| `-16`  | 64  | Séparation majeure                       |

**Interdits :** `-3`, `-5`, `-7`, `-9`, `-11`, `-13`, `-14` et tous les pas
décimaux (`-1.5`, `-2.5`…).

### Hauteurs canoniques

`NavBar` 56 (48 en compact) · `TabBar` 56 · `ListItem` 56 (44 en compact) ·
`Button`/`Input` 44 (cible tactile Apple HIG) · `Button` sm 36 · lg 52.

### Densité

Réglages → Affichage bascule `<html data-density="compact">`. Les composants
s'y abonnent par une classe `density-*` ; toutes les valeurs vivent dans un
seul bloc de `tailwind.css`.

| Crochet                | Confortable      | Compact          |
| ---------------------- | ---------------- | ---------------- |
| `density-row`          | 56, py 8, gap 16 | 44, py 4, gap 8  |
| `density-row-icon`     | 40               | 28               |
| `density-nav`          | 44               | 40 (souris only) |
| `density-navbar`       | 56               | 48               |
| `density-toolbar`      | py 8             | py 4             |
| `density-screen`       | gap 24, pt 16    | gap 16, pt 8     |
| `density-card`         | 16               | 12               |
| `density-group-header` | py 8-16          | py 4             |

Deux limites : le compact ne touche **jamais** le padding horizontal (il
désalignerait les fonds de swipe et les en-têtes collants qui ne portent pas la
classe), et rien ne descend sous 44 px sur une cible tactile.

### Typographie

| Variante   | Taille / interligne | Poids | Usage                            |
| ---------- | ------------------- | ----- | -------------------------------- |
| `display`  | 34 / 40             | 600   | Solde héro — serif, tabular-nums |
| `title1`   | 28 / 34             | 600   | Titre d'écran                    |
| `title2`   | 22 / 28             | 600   | Titre de section                 |
| `title3`   | 20 / 26             | 600   | Titre de carte, NavBar           |
| `headline` | 17 / 22             | 600   | Libellé principal de ligne       |
| `body`     | 17 / 22             | 400   | Texte courant                    |
| `callout`  | 16 / 22             | 400   | Texte secondaire dense           |
| `subhead`  | 15 / 20             | 400   | Sous-titre de ligne              |
| `footnote` | 13 / 18             | 400   | Métadonnées (date, compte)       |
| `caption`  | 12 / 16             | 500   | Libellés — **casse normale**     |
| `overline` | 12 / 16 · 0.06em    | 600   | **Seule** variante en capitales  |

Plancher à 12 px. `text-micro` (10 px) est supprimé. Un seul letter-spacing
élargi existe, porté par `overline`.

### Couleurs

| Classe                 | Valeur                  | Usage                                        |
| ---------------------- | ----------------------- | -------------------------------------------- |
| `bg-bg`                | `#0B0B14`               | Fond d'écran                                 |
| `bg-surface`           | `#15151F`               | Carte, sheet — opaque                        |
| `bg-raised`            | `#1D1D2A`               | Survol, état actif, piste de contrôle        |
| `border-separator`     | `rgba(255,255,255,.08)` | Filet 1 px — la seule bordure                |
| `text-label`           | `#F5F5F7`               | Texte principal                              |
| `text-label-secondary` | 60 %                    | Texte secondaire                             |
| `text-label-tertiary`  | 38 %                    | Métadonnées                                  |
| `text-gold`            | `#D4AF37`               | **Accent de marque** — CTA, sélection, focus |
| `bg-gold-subtle`       | 10 %                    | Fond de badge, état sélectionné              |
| `text-positive`        | `#4ADE80`               | **Montant positif**                          |
| `text-negative`        | `#F87171`               | **Montant négatif**                          |
| `text-warning`         | `#F59E0B`               | Dépassement de budget                        |

> **L'or ne porte jamais une valeur financière.** Un solde et un bouton
> d'action ne doivent pas avoir la même couleur. Les catégories passent par
> `categoryColor` / `seriesColorFor()` de `tokens.ts`.

### Élévation

| Niveau | Rendu                                              | Usage                  |
| ------ | -------------------------------------------------- | ---------------------- |
| 0      | `bg-bg`                                            | Fond d'écran           |
| 1      | `bg-surface`, **ni ombre ni bordure**              | Carte, ligne de liste  |
| 2      | `bg-surface` + `border-separator`                  | Carte détachée du fond |
| 3      | `bg-surface` + `shadow-floating` + `backdrop-blur` | Sheet, modale, nav     |

### Z-index

`z-nav` 40 · `z-sticky` 50 · `z-overlay` 80 · `z-modal` 100.
Aucune valeur ad-hoc.

---

## 3. Composants

Tout est exporté depuis **`public/src/ui`** :

```tsx
import { Card, List, ListItem, Button, Amount, Text } from '../../ui';
```

| Composant                                 | Points saillants                                                                          |
| ----------------------------------------- | ----------------------------------------------------------------------------------------- |
| `Text`                                    | 11 variantes, 7 tonalités. Pose `title` automatiquement quand `truncate` est actif.       |
| `Amount`                                  | Colore selon le signe. `—` pour une valeur absente. `signed` pour préfixer les positifs.  |
| `Card` / `Surface`                        | `padding`, `bordered`, `interactive`. **Émet une erreur console si imbriquée.**           |
| `List` / `ListItem` / `Tile`              | Le rayon appartient à la LISTE, jamais aux lignes.                                        |
| `Button` / `IconButton`                   | `primary` \| `secondary` \| `plain` \| `destructive`. `IconButton` exige `label`.         |
| `Field` + `Input` / `Select` / `Textarea` | L'association `label[for]` est garantie par la signature du composant.                    |
| `Switch`                                  | `role="switch"`, cible 44 px.                                                             |
| `Badge` / `Chip` / `ProgressBar`          | Casse normale. `ProgressBar` borne sa valeur et expose `role="progressbar"`.              |
| `Sheet` / `Modal`                         | Piège de focus, Escape, portail, swipe-to-close, safe-area. `Sheet.Body`, `Sheet.Footer`. |
| `NavBar` / `Toolbar` / `TabBar`           | 56 px. Une seule implémentation pour le desktop et la PWA.                                |
| `SegmentedControl`                        | Générique sur le type de valeur.                                                          |
| `Screen`                                  | Applique la largeur et le padding **une seule fois** (voir `ContainerBoundary`).          |
| `Stack` / `Separator` / `Section`         | Mise en page par `gap`, jamais par marges individuelles.                                  |
| `EmptyState` / `Skeleton`                 | États vides et de chargement.                                                             |

Storybook : `npm run storybook` → _Design System / AURUM v3_.

---

## 4. Garde-fou

`npm run check:design` compte dix familles d'infractions et refuse toute
**augmentation**. Les plafonds vivent dans `scripts/design-system-baseline.json`
et sont vérifiés en CI (job `design`) **et** au pre-commit.

| Compteur                      | Avant refonte | Aujourd'hui |
| ----------------------------- | ------------- | ----------- |
| `rounded-[…]` arbitraires     | 105           | **0**       |
| `rounded-2xl` / `3xl` / `4xl` | 171           | **0**       |
| `uppercase`                   | 608           | **0**       |
| `tracking-[…]`                | 164           | **0**       |
| `text-[Npx]`                  | 41            | **0**       |
| Espacements hors grille       | 734           | **0**       |
| `glass-panel`                 | 27            | **0**       |
| Couleurs `#rrggbb` en dur     | 248           | 242         |
| `<button>` bruts              | 348           | 323         |
| `<input>` bruts               | 89            | 89          |

Les trois derniers compteurs descendent au fil des migrations d'écrans : ils
exigent de remplacer du markup par des primitives, pas une simple substitution
de classe. Le cliquet garantit qu'ils ne remontent jamais.

Quand un compteur baisse, resserrer le cliquet :

```bash
npm run check:design -- --update
```

---

## 5. Do / Don't

| ✅ | ❌ |
| -------------------------------------------------- | ---------------------------------------------- | --- | --- | ------------------------------- |
| `<Card>`, `<Button>`, `<Field>`, `<List>` | Réécrire `bg-surface rounded-lg p-4` à la main |
| `<Sheet>` / `<Modal>` pour toute surface flottante | Construire un backdrop ou un drawer maison |
| `<Amount>` pour un montant | `text-gold` sur une valeur financière |
| `rounded-sm                                        | md                                             | lg  | xl` | `rounded-2xl`, `rounded-[2rem]` |
| Pas de 8 px (avec 4 px en sous-pas) | `p-3`, `gap-5`, `mt-1.5` |
| Hiérarchie par taille et poids | `uppercase tracking-[0.2em]` |
| `text-label-secondary` / `-tertiary` | `text-zinc-500`, `text-white/40` |
| `border-separator` | `border-white/5`, `border-white/[0.06]` |
| Une carte, un niveau | Une `<Card>` dans une `<Card>` |
| Cible tactile 44 px | Boutons `h-8`, `py-1` |
| `title` sur tout texte tronqué | `truncate` seul sur une donnée dynamique |

---

_Mis à jour : juillet 2026 — refonte AURUM v3._
