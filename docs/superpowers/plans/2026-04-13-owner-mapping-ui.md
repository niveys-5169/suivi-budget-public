# Owner Mapping UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le modal actuel basé sur l'édition de JSON par une UI intuitive (listes, tableaux, selecteurs) pour configurer les propriétaires de comptes et d'épargnes.

**Architecture:** Mettre à jour le DOM HTML dans `public/src/app.js`, réécrire la logique d'état et de synchronisation du modal dans `public/src/patrimoine.js`, et modifier le format de sauvegarde vers Firestore pour refléter les données structurées.

**Tech Stack:** Vanilla JS, HTML, CSS, Firebase Firestore.

---

### Task 1: Update UI Markup in `public/src/app.js`

**Files:**

- Modify: `public/src/app.js`

- [ ] **Step 1: Replace old `#modal-owner-mapping` HTML structure**
      Dans `public/src/app.js`, trouvez la définition du `modal-owner-mapping` et remplacez-la par :

```html
<div class="modal-overlay" id="modal-owner-mapping">
  <div class="modal-card" style="max-width:800px; width:100%; max-height:90vh; overflow-y:auto;">
    <h2>Configurer les propriétaires</h2>

    <div class="modal-field">
      <label>Propriétaires</label>
      <div
        id="owner-list-container"
        style="display:flex; flex-direction:column; gap:8px; margin-bottom:8px;"
      ></div>
      <div style="display:flex; gap:8px;">
        <input
          type="text"
          id="new-owner-input"
          placeholder="Nouveau propriétaire..."
          style="flex:1;"
        />
        <button class="btn" onclick="addOwner()">Ajouter</button>
      </div>
    </div>

    <div class="modal-field">
      <label>Propriétaire par défaut</label>
      <select id="owner-mapping-default-owner" class="modal-select"></select>
      <p style="font-size:11px; color:var(--muted); margin-top:6px;">
        Utilisé quand un compte ou épargne n'est pas explicitement assigné.
      </p>
    </div>

    <div class="modal-field" style="display:flex; gap:16px; flex-wrap:wrap;">
      <div style="flex:1 1 300px; min-width:260px;">
        <label>Comptes Courants</label>
        <div
          id="accounts-list-container"
          style="display:flex; flex-direction:column; gap:8px; margin-bottom:8px;"
        ></div>
        <button class="btn btn-sm" onclick="addAccountRow()">+ Ajouter un compte</button>
      </div>

      <div style="flex:1 1 300px; min-width:260px;">
        <label>Épargnes</label>
        <div
          id="savings-list-container"
          style="display:flex; flex-direction:column; gap:8px; margin-bottom:8px;"
        ></div>
        <button class="btn btn-sm" onclick="addSavingRow()">+ Ajouter une épargne</button>
      </div>
    </div>

    <div
      id="owner-mapping-status"
      style="font-size:12px; color:var(--red); min-height:18px; margin-bottom:10px;"
    ></div>
    <div class="modal-actions">
      <button class="btn" onclick="closeOwnerMappingModal()">Annuler</button>
      <button class="btn-primary" onclick="saveOwnerMappingConfig()">Sauvegarder</button>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Add window exports in `public/src/app.js`**
      À la fin de `public/src/app.js`, ajoutez les nouveaux exports pour le DOM :

```javascript
window.addOwner = addOwner;
window.removeOwner = removeOwner;
window.addAccountRow = addAccountRow;
window.removeAccountRow = removeAccountRow;
window.addSavingRow = addSavingRow;
window.removeSavingRow = removeSavingRow;
```

- [ ] **Step 3: Commit**

```bash
git add public/src/app.js
git commit -m "feat(ui): update owner mapping modal markup to structured format"
```

### Task 2: Implement UI State Logic in `public/src/patrimoine.js`

**Files:**

- Modify: `public/src/patrimoine.js`

- [ ] **Step 1: Declare local state variables**
      En haut du fichier `public/src/patrimoine.js`, (juste en dessous de `let runtime = ...`), ajoutez le state local pour le modal :

```javascript
let currentOwnerMappingState = {
  owners: [],
  accounts: [], // [{ name: 'BforBank', owner: 'Nicolas' }]
  savings_patterns: [], // [{ name: 'Livret Romane', owner: 'Romane' }]
  default_owner: '',
};
```

- [ ] **Step 2: Update `loadOwnerMappingConfig` return structure**
      Modifiez `loadOwnerMappingConfig` pour s'assurer que `owners` est retourné, avec un fallback de base :

```javascript
async function loadOwnerMappingConfig() {
  try {
    const doc = await collectionRef(state.db, 'metadata').doc('account_owners_mapping').get();
    if (!doc.exists) {
      return {
        owners: ['Nicolas', 'Romane'],
        accounts: {},
        savings_patterns: {},
        default_owner: 'Nicolas',
      };
    }
    const data = doc.data() || {};
    return {
      owners: data.owners || ['Nicolas', 'Romane'],
      accounts: data.accounts || {},
      savings_patterns: data.savings_patterns || {},
      default_owner: data.default_owner || 'Nicolas',
    };
  } catch (err) {
    runtime.captureError('loadOwnerMappingConfig', err);
    return {
      owners: ['Nicolas', 'Romane'],
      accounts: {},
      savings_patterns: {},
      default_owner: 'Nicolas',
    };
  }
}
```

- [ ] **Step 3: Write UI Rendering Functions**
      Ajoutez les fonctions de rendu UI (renderOwners, renderAccounts, renderSavings, updateSelects) dans `public/src/patrimoine.js` :

```javascript
function renderOwners() {
  const container = document.getElementById('owner-list-container');
  if (!container) return;
  container.innerHTML = '';
  currentOwnerMappingState.owners.forEach((owner, idx) => {
    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.gap = '8px';
    div.style.alignItems = 'center';
    div.innerHTML = `
      <span style="flex:1; padding:4px 8px; background:var(--bg-lighter); border-radius:4px;">${runtime.esc(owner)}</span>
      <button class="btn btn-sm" style="color:var(--red);" onclick="removeOwner(${idx})">✕</button>
    `;
    container.appendChild(div);
  });
  updateAllSelects();
}

function updateAllSelects() {
  const owners = currentOwnerMappingState.owners;

  // Default owner
  const defaultSelect = document.getElementById('owner-mapping-default-owner');
  if (defaultSelect) {
    defaultSelect.innerHTML = owners
      .map((o) => `<option value="${runtime.esc(o)}">${runtime.esc(o)}</option>`)
      .join('');
    if (owners.includes(currentOwnerMappingState.default_owner)) {
      defaultSelect.value = currentOwnerMappingState.default_owner;
    }
  }

  // Row selects
  document.querySelectorAll('.owner-select').forEach((select) => {
    const val = select.value;
    select.innerHTML = owners
      .map((o) => `<option value="${runtime.esc(o)}">${runtime.esc(o)}</option>`)
      .join('');
    if (owners.includes(val)) select.value = val;
  });
}

function renderAccounts() {
  const container = document.getElementById('accounts-list-container');
  if (!container) return;
  container.innerHTML = '';
  currentOwnerMappingState.accounts.forEach((acc, idx) => {
    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.gap = '4px';
    div.innerHTML = `
      <input type="text" placeholder="Compte (ex: BforBank)" value="${runtime.esc(acc.name)}" style="flex:1;" onchange="currentOwnerMappingState.accounts[${idx}].name = this.value" />
      <select class="owner-select modal-select" style="width:100px;" onchange="currentOwnerMappingState.accounts[${idx}].owner = this.value">
        ${currentOwnerMappingState.owners.map((o) => `<option value="${runtime.esc(o)}" ${o === acc.owner ? 'selected' : ''}>${runtime.esc(o)}</option>`).join('')}
      </select>
      <button class="btn btn-sm" style="color:var(--red);" onclick="removeAccountRow(${idx})">✕</button>
    `;
    container.appendChild(div);
  });
}

function renderSavings() {
  const container = document.getElementById('savings-list-container');
  if (!container) return;
  container.innerHTML = '';
  currentOwnerMappingState.savings_patterns.forEach((sav, idx) => {
    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.gap = '4px';
    div.innerHTML = `
      <input type="text" placeholder="Épargne (ex: Livret A)" value="${runtime.esc(sav.name)}" style="flex:1;" onchange="currentOwnerMappingState.savings_patterns[${idx}].name = this.value" />
      <select class="owner-select modal-select" style="width:100px;" onchange="currentOwnerMappingState.savings_patterns[${idx}].owner = this.value">
        ${currentOwnerMappingState.owners.map((o) => `<option value="${runtime.esc(o)}" ${o === sav.owner ? 'selected' : ''}>${runtime.esc(o)}</option>`).join('')}
      </select>
      <button class="btn btn-sm" style="color:var(--red);" onclick="removeSavingRow(${idx})">✕</button>
    `;
    container.appendChild(div);
  });
}
```

- [ ] **Step 4: Commit**

```bash
git add public/src/patrimoine.js
git commit -m "feat(ui): implement owner mapping render logic"
```

### Task 3: Implement Interactivity and Save Logic in `public/src/patrimoine.js`

**Files:**

- Modify: `public/src/patrimoine.js`

- [ ] **Step 1: Write UI Actions Methods**
      Ajoutez les fonctions pour gérer les interactions utilisateurs dans `public/src/patrimoine.js` :

```javascript
window.addOwner = function () {
  const input = document.getElementById('new-owner-input');
  const val = input.value.trim();
  if (val && !currentOwnerMappingState.owners.includes(val)) {
    currentOwnerMappingState.owners.push(val);
    if (!currentOwnerMappingState.default_owner) {
      currentOwnerMappingState.default_owner = val;
    }
    input.value = '';
    renderOwners();
    renderAccounts();
    renderSavings();
  }
};

window.removeOwner = function (idx) {
  const owner = currentOwnerMappingState.owners[idx];
  currentOwnerMappingState.owners.splice(idx, 1);
  if (currentOwnerMappingState.default_owner === owner) {
    currentOwnerMappingState.default_owner = currentOwnerMappingState.owners[0] || '';
  }
  renderOwners();
  renderAccounts();
  renderSavings();
};

window.addAccountRow = function () {
  currentOwnerMappingState.accounts.push({
    name: '',
    owner: currentOwnerMappingState.default_owner,
  });
  renderAccounts();
};

window.removeAccountRow = function (idx) {
  currentOwnerMappingState.accounts.splice(idx, 1);
  renderAccounts();
};

window.addSavingRow = function () {
  currentOwnerMappingState.savings_patterns.push({
    name: '',
    owner: currentOwnerMappingState.default_owner,
  });
  renderSavings();
};

window.removeSavingRow = function (idx) {
  currentOwnerMappingState.savings_patterns.splice(idx, 1);
  renderSavings();
};
```

- [ ] **Step 2: Rewrite `openOwnerMappingModal`**
      Mettez à jour `openOwnerMappingModal` pour lier les données au nouveau UI :

```javascript
function openOwnerMappingModal() {
  loadOwnerMappingConfig().then((mapping) => {
    currentOwnerMappingState = {
      owners: [...mapping.owners],
      accounts: Object.entries(mapping.accounts || {}).map(([k, v]) => ({ name: k, owner: v })),
      savings_patterns: Object.entries(mapping.savings_patterns || {}).map(([k, v]) => ({
        name: k,
        owner: v,
      })),
      default_owner: mapping.default_owner || mapping.owners[0] || '',
    };

    renderOwners();
    renderAccounts();
    renderSavings();

    const status = document.getElementById('owner-mapping-status');
    if (status) {
      status.textContent = '';
      status.style.color = 'var(--red)';
    }
    const modal = document.getElementById('modal-owner-mapping');
    if (modal) modal.style.display = 'flex';
  });
}
```

- [ ] **Step 3: Rewrite `saveOwnerMappingConfig`**
      Réécrire `saveOwnerMappingConfig` pour formater, valider et sauvegarder le nouveau modèle :

```javascript
async function saveOwnerMappingConfig() {
  const status = document.getElementById('owner-mapping-status');
  if (status) {
    status.style.color = 'var(--muted)';
    status.textContent = 'Enregistrement...';
  }

  // Mettre à jour depuis le select par défaut
  const defSelect = document.getElementById('owner-mapping-default-owner');
  if (defSelect) currentOwnerMappingState.default_owner = defSelect.value;

  if (currentOwnerMappingState.owners.length === 0) {
    if (status) {
      status.style.color = 'var(--red)';
      status.textContent = 'Veuillez ajouter au moins un propriétaire.';
    }
    return;
  }

  const accountsObj = {};
  for (const acc of currentOwnerMappingState.accounts) {
    const name = acc.name.trim();
    if (name) accountsObj[name] = acc.owner;
  }

  const savingsObj = {};
  for (const sav of currentOwnerMappingState.savings_patterns) {
    const name = sav.name.trim();
    if (name) savingsObj[name] = sav.owner;
  }

  try {
    await collectionRef(state.db, 'metadata').doc('account_owners_mapping').set({
      owners: currentOwnerMappingState.owners,
      accounts: accountsObj,
      savings_patterns: savingsObj,
      default_owner: currentOwnerMappingState.default_owner,
    });

    if (status) {
      status.style.color = 'var(--green)';
      status.textContent = 'Configuration enregistrée.';
    }

    setTimeout(() => {
      closeOwnerMappingModal();
    }, 1000);

    renderPatrimoine();
  } catch (err) {
    runtime.captureError('saveOwnerMappingConfig', err);
    if (status) {
      status.style.color = 'var(--red)';
      status.textContent = 'Erreur d’enregistrement. Vérifie les droits Firestore.';
    }
  }
}
```

- [ ] **Step 4: Sync identical app.js changes (if duplicated)**
      Le fichier `src/app.js` semble être un duplicata de `public/src/app.js`. Il faut appliquer les mêmes modifications de la tâche 1 (HTML markup et window exports) à `src/app.js` pour maintenir la synchronisation.
      Si c'est bien le cas, appliquez manuellement la substitution du `#modal-owner-mapping` et les exports Windows.

- [ ] **Step 5: Commit**

```bash
git add public/src/patrimoine.js src/app.js
git commit -m "feat(ui): finish interactive owner mapping and save logic"
```

---
