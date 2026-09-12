# Plan : Finalisation migration PWA — Features desktop manquantes

## Contexte

La PWA mobile a une fondation solide (5 écrans, CRUD transactions/budgets/placements, filtres, graphiques). Ce plan couvre les fonctionnalités desktop qui n'ont pas encore été portées sur mobile, classées par priorité. L'objectif est une parité fonctionnelle complète sur les cas d'usage quotidiens.

Branche de développement : `claude/desktop-pwa-feature-gaps-rItRZ`

---

## Tâche 1 — Config GitHub PAT dans les Réglages

**Priorité : HAUTE** (débloque la fonctionnalité de sync déjà présente)

### Problème

Le bouton "Synchroniser" dans `MSettingsModal` appelle `useSyncTransactions` qui lit `localStorage.getItem('github_pat')`. Si le PAT n'est pas configuré, il retourne silencieusement `'no-pat'`. Il n'y a aucun moyen de configurer le PAT depuis la PWA.

### Fichiers à modifier

- `public/src/mobile/components/MSettingsModal.tsx`

### Ce qu'il faut faire

Ajouter une section "Synchronisation" dans le modal de réglages, au-dessus du bouton "Synchroniser" existant, avec :

```
Section "Source des données" :
  - Champ texte "Token GitHub (PAT)" — type="password", placeholder="ghp_..."
  - Champ texte "Owner" — placeholder="niveys-5169", valeur par défaut depuis localStorage
  - Champ texte "Dépôt" — placeholder="Suivi-Budget", valeur par défaut depuis localStorage
  - Bouton "Enregistrer" → écrit dans localStorage (github_pat, github_owner, github_repo)
```

**Clés localStorage à utiliser :**

```
github_pat    → localStorage.getItem('github_pat') || ''
github_owner  → localStorage.getItem('github_owner') || 'niveys-5169'
github_repo   → localStorage.getItem('github_repo') || 'Suivi-Budget'
```

**Pattern de référence :** `public/src/components/AdvancedSettings.tsx` lignes 50–95 (même logique read/write localStorage, pas de hook spécial à importer).

**Optionnel :** Utiliser `useAdvancedSettings` hook si existant, sinon localStorage direct suffit.

---

## Tâche 2 — Assistant IA (Finance QA) sur mobile

**Priorité : HAUTE** (fonctionnalité à forte valeur, uniquement accessible sur desktop)

### Problème

L'assistant financier IA (`/qa`) n'existe pas sur mobile. `useFinanceQA` est 100% réutilisable tel quel.

### Fichiers à créer

- `public/src/mobile/screens/QAScreen.tsx`

### Fichiers à modifier

- `public/src/MobileApp.tsx` — ajouter la route `/qa`
- `public/src/mobile/screens/HomeScreen.tsx` — ajouter un bouton d'accès

### Interface de `useFinanceQA` (hook à réutiliser sans modification)

```typescript
// Fichier : public/src/hooks/useFinanceQA.ts
const { messages, loading, send, clearChat } = useFinanceQA();

// ChatMessage type :
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
```

**Clés localStorage requises** (configurables depuis les réglages) :

- `ai_provider` — 'gemini' | 'openai' | 'openrouter' | 'nvidia' (défaut: 'gemini')
- `ai_api_key` — clé API
- `ai_model` — optionnel
- `ai_base_url` — optionnel

### Structure de QAScreen.tsx

```
<div className="flex flex-col h-full">
  <MScreenHeader
    title="Assistant IA"
    leftAction={<Back button → navigate(-1)>}
    rightAction={<Settings icon → ouvre AIConfigSheet> + <Trash icon → clearChat si messages.length>}
  />

  {/* Zone messages (flex-1, overflow-y-auto, padding bottom pour input) */}
  <div ref={messagesEndRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
    {messages.length === 0 && <SuggestedQuestions onClick={send} />}
    {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
    {loading && <TypingIndicator />}
  </div>

  {/* Input fixé en bas */}
  <div className="border-t border-glass-border px-4 py-3 flex gap-2">
    <textarea
      rows={1} autoGrow
      placeholder="Posez une question sur vos finances..."
      onKeyDown (Enter sans Shift → send)
    />
    <button onClick={() => send(input)} disabled={loading || !input.trim()}>
      <Send size={20} />
    </button>
  </div>

  {/* Sheet de config IA (bottom-sheet portal) */}
  {isConfigOpen && <MAIConfigSheet onClose={...} />}
</div>
```

**Bubbles de messages :**

- User : `bg-gold text-ink`, aligné à droite, `rounded-[18px] rounded-br-[4px]`, max-w-[85%]
- Assistant : `bg-white/5 border border-white/10`, aligné à gauche, `rounded-[18px] rounded-bl-[4px]`, max-w-[85%]
- Markdown minimal : `**texte**` → `<strong>`, `\n` → `<br>`

**Questions suggérées (5 chips cliquables) :**

```
'Combien ai-je dépensé en santé cette année ?'
'Quelles sont mes 5 plus grosses catégories de dépenses ?'
'Quel est mon solde global ?'
'Compare mes dépenses de ce mois avec le mois dernier'
'Donne-moi un résumé de mes finances de cette année'
```

**Composant MAIConfigSheet** (nouveau, bottom-sheet portal) :

- Champs : Provider (select), Clé API (password input), Modèle (text, optionnel), URL base (text, optionnel)
- Enregistre dans localStorage les 4 clés `ai_*`
- Référence style : `MTransactionFilterModal.tsx` pour la structure bottom-sheet

### Navigation vers QAScreen

Pas de slot disponible en bottom nav (déjà 5 onglets). Accès via :

- Bouton "Assistant IA" dans la section hero du HomeScreen (icône `BotMessageSquare`, couleur `bg-violet-500/10 text-violet-400`)
- Route : `/qa` dans MobileApp

**Dans HomeScreen.tsx**, ajouter sous le hero balance et au-dessus de `<MQuickNav>` :

```jsx
<button
  onClick={() => navigate('/qa')}
  className="mx-4 my-2 flex items-center gap-3 px-4 py-3 bg-violet-500/10 border border-violet-500/20 rounded-2xl"
>
  <BotMessageSquare size={20} className="text-violet-400" />
  <div>
    <p className="text-m-label font-bold text-white">Assistant IA</p>
    <p className="text-m-caption text-zinc-500">Posez une question sur vos finances</p>
  </div>
  <ChevronRight size={16} className="text-zinc-600 ml-auto" />
</button>
```

---

## Tâche 3 — Améliorations Récurrences dans AnalyseScreen

**Priorité : MOYENNE** (fonctionnalité déjà partiellement portée, 3 lacunes comblables rapidement)

### Problème

`AnalyseScreen` détecte les récurrences mais manque : total mensuel, compteur de mois détectés, et regroupement par statut.

### Fichier à modifier

- `public/src/mobile/screens/AnalyseScreen.tsx`

### Ce qu'il faut faire (par ordre d'effort croissant)

**3a. Compteur de mois sur chaque carte récurrente** (trivial)

Le champ `item.count` (nombre de mois détectés) existe dans les données. L'afficher sous le label :

```jsx
<p className="text-xs text-zinc-500">
  {item.freq} • {item.count} mois détectés
</p>
```

Actuellement le code affiche `{item.freq} • {item.count} fois` — changer "fois" en "mois détectés".

**3b. Total mensuel des récurrences acceptées** (facile)

Ajouter au-dessus de la liste récurrences (mode === 'recurrences') un encart KPI :

```jsx
const acceptedTotal = detectedRecurring
  .filter((item) => recurringSettings[getRecurringKey(item)]?.status === 'accepted')
  .reduce((sum, item) => sum + (item.avgAmount || 0), 0);

// Afficher si acceptedTotal > 0 :
<div className="mx-4 mb-4 px-4 py-3 bg-gold/10 border border-gold/20 rounded-2xl">
  <p className="text-m-label text-zinc-500 uppercase tracking-wider">
    Total récurrences confirmées
  </p>
  <FormattedNumber value={acceptedTotal} style="currency" currency="EUR" />
  <p className="text-m-caption text-zinc-500">/mois</p>
</div>;
```

Hooks disponibles (déjà importés dans AnalyseScreen) : `getRecurringKey`, `recurringSettings` (via `useDashboard`).

**3c. Regroupement Pending / Accepted** (modéré)

Remplacer la liste plate par deux sections distinctes quand `mode === 'recurrences'` :

```
— Section "À confirmer (N)" : items avec status 'pending'
— Section "Confirmées (N)"  : items avec status 'accepted'
```

Style des en-têtes : même que les sections budgets `MBudgetGrid` (label uppercase zinc-500, couleur accent).

---

## Tâche 4 — Historique de solde au tap sur un compte

**Priorité : MOYENNE** (actuellement le tap navigue vers les transactions filtrées, ok mais moins riche)

### Problème

Sur desktop, tapper un compte ouvre `BalanceHistoryModal` (liste d'événements + KPIs + accès réconciliation). Sur mobile, ça navigue vers les transactions filtrées. On peut garder la navigation mais ajouter l'historique accessible en secondaire.

### Approche recommandée

Modifier `MAccountCard` pour avoir deux zones de tap :

- Tap sur la zone texte (nom + source) → naviguer vers transactions filtrées (comportement actuel)
- Nouveau bouton `Clock` à droite (icône historique) → ouvre `MBalanceHistorySheet`

### Fichiers à créer

- `public/src/mobile/components/MBalanceHistorySheet.tsx`

### Fichiers à modifier

- `public/src/mobile/components/MAccountCard.tsx`

### Structure de MBalanceHistorySheet

```typescript
// Props :
interface MBalanceHistorySheetProps {
  account: BaseBalance;
  onClose: () => void;
}

// Firestore query (même logique que BalanceHistoryModal.tsx) :
// collection: 'account_balance_history'
// where('account_id', '==', account.id)
// orderBy('timestamp', 'desc')
// limit(20)

// Rendu : bottom-sheet portal
// Header : nom du compte + solde actuel
// Liste des événements : date | type | solde formaté
// Icônes par event_type (import, manual, reconciled, etc.)
```

**Référence source :** `public/src/components/BalanceHistoryModal.tsx` pour la logique Firestore et les types (lignes 140–180). Réutiliser `HistoryEntry` type et la query Firestore. Adapter le rendu en liste mobile (pas de table, cards simples).

---

## Tâche 5 — Config AI dans les Réglages

**Priorité : BASSE** (nécessaire pour que la Tâche 2 soit utilisable sans dev tools)

### Problème

Les clés `ai_*` ne peuvent pas être configurées depuis la PWA. L'utilisateur doit passer par le desktop ou les devtools.

### Fichier à modifier

- `public/src/mobile/components/MSettingsModal.tsx`

### Ce qu'il faut faire

Ajouter une section "Assistant IA" dans le contenu du modal (après la section densité) :

```
Section "Assistant IA" :
  - Select "Fournisseur" : Gemini | OpenAI | OpenRouter | Nvidia (lit/écrit ai_provider)
  - Input "Clé API" — type="password" (lit/écrit ai_api_key)
  - Input "Modèle" — optionnel, placeholder auto selon provider (lit/écrit ai_model)
```

Les clés par provider par défaut :

- gemini → gemini-2.0-flash-exp
- openai → gpt-4o-mini
- openrouter → openai/gpt-4o-mini
- nvidia → meta/llama-3.1-70b-instruct

**Note :** Pas besoin d'importer `AISettingsForm` (trop couplé au desktop). Implémenter directement avec localStorage.

---

## Tâches hors scope (desktop-only acceptable)

Ces fonctionnalités restent sur desktop uniquement, pas besoin de les porter :

- `/fusion` — déduplication de transactions
- `/tronity` — intégration voiture électrique
- `/mappings` — config propriétaires de comptes
- `/rav-config`, `/reparse`, `/excluded` — outils d'import avancés
- `/rules` — règles de catégorisation
- `ReconciliationModal` — appels Firebase Functions complexes, usage rare

---

## Ordre d'implémentation recommandé

```
1. Tâche 1 — PAT config (30 min)         → débloque sync qui est déjà là
2. Tâche 5 — AI config (45 min)          → débloque l'assistant IA
3. Tâche 2 — QAScreen (3-4h)            → fonctionnalité phare
4. Tâche 3 — Récurrences (2h)           → amélioration incrémentale
5. Tâche 4 — Balance history (3h)       → bonus si temps disponible
```

---

## Patterns et conventions à respecter

### Style CSS (mobile design system)

- Fond : `bg-ink`, `bg-ink-100`, `bg-white/5`
- Texte : `text-m-title`, `text-m-label`, `text-m-caption`, `text-m-body`
- Accent : `text-gold`, `bg-gold`, `border-gold/50`
- Bordures : `border-glass-border`, `border-white/10`
- Inputs : `bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white`
- Coins : `rounded-2xl` (cards), `rounded-t-3xl` (bottom-sheets), `rounded-lg` (inputs)

### Structure bottom-sheet modal (pattern existant)

```tsx
// Voir MTransactionFilterModal.tsx ou MSettingsModal.tsx
return createPortal(
  <div
    className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80 backdrop-blur-sm p-4"
    onClick={onClose}
  >
    <div
      className="bg-ink border-t border-glass-border rounded-t-3xl w-full max-w-sm max-h-[90dvh] flex flex-col overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      {/* Contenu scrollable */}
      {/* Footer (optionnel) */}
    </div>
  </div>,
  document.body,
);
```

### Hooks à réutiliser (ne pas recréer)

- `useTransactions` → `public/src/hooks/useTransactions.tsx`
- `usePatrimoine` → `public/src/hooks/usePatrimoine.tsx`
- `useFinanceQA` → `public/src/hooks/useFinanceQA.ts`
- `useDashboard` → via `recurringSettings`
- `getRecurringKey`, `setRecurringStatus` → `public/src/hooks/recurringService.ts`

---

## Vérification

Après implémentation, vérifier :

1. **Build propre** : `npm run build` → 0 erreurs TypeScript, 0 warnings ESLint
2. **PAT sync** : Entrer un PAT dans les réglages → bouton "Synchroniser" → toast "Import en cours" (si PAT valide)
3. **Assistant IA** : Bouton depuis HomeScreen → naviguer vers QAScreen → poser une question → réponse en bulles
4. **Récurrences** : AnalyseScreen → mode "Récurrences" → voir total mensuel + regroupement pending/accepted
5. **Balance history** : HomeScreen → tap icône horloge sur un compte → sheet avec historique
6. **Responsive** : Tester sur viewport 375px (iPhone SE) et 390px (iPhone 14)
