# Plan : Persistance des catégories sélectionnées dans le dashboard

## Goal

Persister la sélection des catégories du dashboard React dans `localStorage` afin qu'elle survive aux rechargements de page.

## Scope

**In scope:**

- Initialisation lazy de `selectedCategories` depuis `localStorage` au montage
- Sauvegarde automatique dans `localStorage` à chaque changement
- Validation silencieuse (ignorer les catégories sauvegardées qui n'existent plus)
- Utilisation de la clé existante `dashboardSelectedCatsV3` (alignement avec le legacy `app.js`)

**Out of scope:**

- Refactoring du legacy `app.js`
- Hook générique réutilisable
- Synchronisation cross-onglets
- Migration des anciennes clés localStorage

---

## Implementation steps

1. **Remplacer l'initialisation de `selectedCategories`** dans `useDashboard.tsx` (ligne 27)  
   Passer de `useState<Set<string>>(new Set())` à un initializer lazy qui lit `localStorage.getItem('dashboardSelectedCatsV3')`, parse le JSON, et retourne un `Set<string>` (ou `new Set()` en cas d'erreur/absence).

2. **Remplacer le commentaire placeholder** `// ... (localStorage effects) ...` (ligne 31)  
   Ajouter un `useEffect` qui réagit à `selectedCategories` et écrit dans `localStorage` :  
   `localStorage.setItem('dashboardSelectedCatsV3', JSON.stringify([...selectedCategories]))`

3. **Modifier l'effet d'initialisation** (lignes 43-47)  
   L'effet actuel force toutes les catégories si `selectedCategories.size === 0`. Avec la persistence, une sélection vide sauvegardée (« tout désélectionner ») serait incorrectement réinitialisée.  
   Ajouter un flag `hasLoadedFromStorage` pour distinguer « rien en localStorage » (→ auto-sélectionner tout) de « l'utilisateur a tout décoché » (→ respecter le choix).

---

## Files to create or modify

| File                                | Action | Purpose                                         |
| ----------------------------------- | ------ | ----------------------------------------------- |
| `public/src/hooks/useDashboard.tsx` | modify | Lazy init + save effect + fix auto-select guard |

---

## Risks and mitigations

| Risque                                         | Mitigation                                                           |
| ---------------------------------------------- | -------------------------------------------------------------------- |
| Catégories sauvegardées obsolètes (supprimées) | Filtrer silencieusement avec `allCategories` dans l'effet d'init     |
| JSON corrompu dans localStorage                | `try/catch` dans l'initializer, fallback sur `new Set()`             |
| Sélection vide sauvegardée réinitialisée       | Flag `hasLoadedFromStorage` pour ne pas écraser le choix utilisateur |
| Désynchronisation avec le legacy `app.js`      | Même clé `dashboardSelectedCatsV3` → lecture/écriture compatible     |

---

## Open questions

Aucune — validées par l'utilisateur :

- Catégories manquantes : ignorées silencieusement ✓
- Alignement sur la clé legacy : `dashboardSelectedCatsV3` ✓
