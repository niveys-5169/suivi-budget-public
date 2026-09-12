# Pull-to-Refresh (Transactions) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter une fonctionnalité de "Pull-to-Refresh" sur mobile pour l'onglet Transactions afin de déclencher l'import des emails Linxo.

**Architecture:** Un module JS natif capture les événements tactiles en haut de page, affiche un indicateur visuel dont la hauteur varie avec la traction, et appelle la fonction globale `refreshTransactionsFromEmails()` une fois le seuil atteint.

**Tech Stack:** HTML5, CSS3 (Transitions, Flexbox), JavaScript (Touch Events API).

---

### Task 1: Structure HTML et Styles CSS

**Files:**

- Modify: `public/index.html`
- Modify: `public/src/style.css`

- [ ] **Step 1: Ajouter l'indicateur HTML**
      Insérer le bloc avant `balances-panel` dans `#tab-transactions`.

```html
<!-- public/index.html -->
<div id="ptr-indicator" class="ptr-indicator">
  <div class="ptr-content">
    <div class="ptr-spinner"></div>
    <span id="ptr-text">Tirez pour rafraîchir...</span>
  </div>
</div>
```

- [ ] **Step 2: Ajouter les styles CSS**
      Ajouter à la fin de la section mobile ou des composants.

```css
/* public/src/style.css */
.ptr-indicator {
  height: 0;
  overflow: hidden;
  background: var(--card);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    height 0.2s ease,
    opacity 0.2s;
  opacity: 0;
  pointer-events: none;
}

.ptr-indicator.active {
  opacity: 1;
}

.ptr-content {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--muted);
  font-size: 14px;
  font-weight: 500;
}

.ptr-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  display: none;
}

.ptr-indicator.loading .ptr-spinner {
  display: block;
}

.ptr-indicator.loading #ptr-text {
  color: var(--primary);
}

@media (min-width: 769px) {
  .ptr-indicator {
    display: none !important;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add public/index.html public/src/style.css
git commit -m "feat(ui): add pull-to-refresh indicator structure and styles"
```

---

### Task 2: Logique JavaScript du Pull-to-Refresh

**Files:**

- Create: `public/src/utils/pull-to-refresh.js`

- [ ] **Step 1: Créer le module de gestion du PTR**

```javascript
// public/src/utils/pull-to-refresh.js
export function initPullToRefresh(options) {
  const { containerId, indicatorId, textId, onRefresh, threshold = 70 } = options;
  const indicator = document.getElementById(indicatorId);
  const text = document.getElementById(textId);

  if (!indicator) return;

  let startY = 0;
  let currentY = 0;
  let pulling = false;

  const handleStart = (e) => {
    if (window.scrollY > 0) return;
    const activePanel = document.querySelector('.panel.active');
    if (activePanel?.id !== containerId) return;

    startY = e.touches[0].pageY;
    pulling = true;
    indicator.classList.add('active');
    indicator.style.transition = 'none';
  };

  const handleMove = (e) => {
    if (!pulling) return;
    currentY = e.touches[0].pageY;
    const diff = currentY - startY;

    if (diff > 0) {
      e.preventDefault();
      const height = Math.min(diff * 0.5, threshold + 20);
      indicator.style.height = `${height}px`;

      if (height >= threshold) {
        text.textContent = 'Relâchez pour rafraîchir';
      } else {
        text.textContent = 'Tirez pour rafraîchir...';
      }
    } else {
      pulling = false;
      reset();
    }
  };

  const handleEnd = async () => {
    if (!pulling) return;
    pulling = false;

    const height = parseInt(indicator.style.height);
    if (height >= threshold) {
      indicator.style.transition = 'height 0.3s ease';
      indicator.style.height = '60px';
      indicator.classList.add('loading');
      text.textContent = 'Mise à jour...';

      try {
        await onRefresh();
      } finally {
        reset();
      }
    } else {
      reset();
    }
  };

  const reset = () => {
    indicator.style.transition = 'height 0.3s ease';
    indicator.style.height = '0';
    indicator.classList.remove('loading');
    indicator.classList.remove('active');
    setTimeout(() => {
      if (!indicator.classList.contains('loading')) {
        text.textContent = 'Tirez pour rafraîchir...';
      }
    }, 300);
  };

  window.addEventListener('touchstart', handleStart, { passive: false });
  window.addEventListener('touchmove', handleMove, { passive: false });
  window.addEventListener('touchend', handleEnd);
}
```

- [ ] **Step 2: Commit**

```bash
git add public/src/utils/pull-to-refresh.js
git commit -m "feat(js): implement pull-to-refresh logic"
```

---

### Task 3: Intégration et Initialisation

**Files:**

- Modify: `public/src/main.js`

- [ ] **Step 1: Initialiser le PTR dans main.js**

```javascript
// public/src/main.js
// ... (imports existants)
import { initPullToRefresh } from './utils/pull-to-refresh.js';

// ... (après initTheme, initQAPanel)
initPullToRefresh({
  containerId: 'tab-transactions',
  indicatorId: 'ptr-indicator',
  textId: 'ptr-text',
  onRefresh: async () => {
    if (typeof window.refreshTransactionsFromEmails === 'function') {
      await window.refreshTransactionsFromEmails();
    }
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add public/src/main.js
git commit -m "feat: initialize pull-to-refresh in main entry point"
```

---

### Task 4: Vérification

- [ ] **Step 1: Vérification manuelle (simulation mobile)**
      Ouvrir les DevTools (F12), passer en mode mobile, et simuler un drag vers le bas sur l'onglet Transactions.
      Vérifier :

1. L'indicateur s'agrandit.
2. Le texte change à 70px.
3. Le spinner apparaît au relâchement.
4. L'import se déclenche (voir console ou toast).
5. L'indicateur se replie après l'import.

- [ ] **Step 2: Vérification Desktop**
      Vérifier que l'indicateur est invisible et qu'aucun bug n'apparaît lors du scroll normal.
