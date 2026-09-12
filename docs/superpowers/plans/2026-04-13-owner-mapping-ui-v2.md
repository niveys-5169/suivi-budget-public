# Amélioration du Modal de Configuration des Propriétaires

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Remplacer la saisie manuelle des propriétaires, comptes et épargnes par des listes déroulantes intelligentes avec une option "Autre" pour faciliter la configuration sans JSON.

**Architecture:**

- Mise à jour du HTML dans `public/src/app.js` pour structurer le modal avec des conteneurs dynamiques.
- Logique JavaScript dans `public/src/patrimoine.js` pour peupler les sélecteurs à partir des données de l'état global (`state`).
- Gestion de l'affichage conditionnel des champs de saisie "Autre" via une fonction utilitaire `toggleOtherInput`.

**Tech Stack:** JavaScript (Vanilla), HTML, CSS, Firebase Firestore.

---

### Task 1: Mise à jour de la structure HTML du Modal

**Files:**

- Modify: `public/src/app.js`

- [x] **Step 1: Modifier la structure de `#modal-owner-mapping`**

Remplacer le contenu existant du modal par la nouvelle structure incluant les conteneurs pour les listes.

```html
<div class="modal-overlay" id="modal-owner-mapping">
  <div class="modal-card" style="max-width:800px; width:100%; max-height:90vh; overflow-y:auto;">
    <h2>Configurer les propriétaires</h2>

    <div class="modal-field">
      <label>Propriétaires existants</label>
      <div
        id="owner-list-container"
        style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:12px;"
      ></div>
      <div style="display:flex; gap:8px;">
        <input
          type="text"
          id="new-owner-input"
          placeholder="Nouveau propriétaire..."
          style="flex:1;"
          onkeypress="if(event.key==='Enter') addOwner()"
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

    <div class="modal-field" style="display:flex; gap:20px; flex-wrap:wrap;">
      <div style="flex:1 1 300px; min-width:280px;">
        <label>Comptes Courants</label>
        <div
          id="accounts-list-container"
          style="display:flex; flex-direction:column; gap:12px; margin-bottom:12px;"
        ></div>
        <button class="btn btn-sm" onclick="addAccountRow()">+ Ajouter un compte</button>
      </div>

      <div style="flex:1 1 300px; min-width:280px;">
        <label>Épargnes</label>
        <div
          id="savings-list-container"
          style="display:flex; flex-direction:column; gap:12px; margin-bottom:12px;"
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

- [x] **Step 2: Commit les changements HTML**

```bash
git add public/src/app.js
git commit -m "ui: update owner mapping modal structure"
```

### Task 2: Fonctions utilitaires et Rendu des Propriétaires

**Files:**

- Modify: `public/src/patrimoine.js`

- [x] **Step 1: Ajouter la fonction `toggleOtherInput`**

Cette fonction gère l'affichage de l'input texte quand "Autre" est sélectionné.

```javascript
window.toggleOtherInput = function (select) {
  const container = select.parentElement;
  const otherInput = container.querySelector('input[type="text"]');
  if (otherInput) {
    otherInput.style.display = select.value === '__OTHER__' ? 'block' : 'none';
    if (select.value === '__OTHER__') otherInput.focus();
  }
};
```

- [x] **Step 2: Mettre à jour `renderOwners`**

Modifier le rendu pour utiliser des badges plus compacts.

```javascript
function renderOwners() {
  const container = document.getElementById('owner-list-container');
  if (!container) return;
  container.innerHTML = '';
  currentOwnerMappingState.owners.forEach((owner, idx) => {
    const span = document.createElement('span');
    span.className = 'badge';
    span.style.padding = '6px 10px';
    span.style.display = 'flex';
    span.style.alignItems = 'center';
    span.style.gap = '6px';
    span.innerHTML = `
      ${runtime.esc(owner)}
      <span style="cursor:pointer; color:var(--red); font-weight:bold;" onclick="removeOwner(${idx})">✕</span>
    `;
    container.appendChild(span);
  });
  updateAllSelects();
}
```

- [x] **Step 3: Mettre à jour `updateAllSelects`**

S'assurer que tous les sélecteurs de propriétaires sont mis à jour dynamiquement.

```javascript
function updateAllSelects() {
  const owners = currentOwnerMappingState.owners;

  const defaultSelect = document.getElementById('owner-mapping-default-owner');
  if (defaultSelect) {
    const currentVal = defaultSelect.value || currentOwnerMappingState.default_owner;
    defaultSelect.innerHTML = owners
      .map((o) => `<option value="${runtime.esc(o)}">${runtime.esc(o)}</option>`)
      .join('');
    if (owners.includes(currentVal)) defaultSelect.value = currentVal;
  }

  document.querySelectorAll('.owner-select').forEach((select) => {
    const val = select.value;
    let html = owners
      .map((o) => `<option value="${runtime.esc(o)}">${runtime.esc(o)}</option>`)
      .join('');
    html += '<option value="__OTHER__">— Autre —</option>';
    select.innerHTML = html;
    if (owners.includes(val) || val === '__OTHER__') select.value = val;
  });
}
```

- [x] **Step 4: Commit**

```bash
git add public/src/patrimoine.js
git commit -m "feat: add toggleOtherInput and update owner rendering"
```

### Task 3: Rendu des Comptes et Épargnes avec Sélecteurs

**Files:**

- Modify: `public/src/patrimoine.js`

- [x] **Step 1: Mettre à jour `renderAccounts`**

Utiliser des listes déroulantes pour les noms de comptes et les propriétaires.

```javascript
function renderAccounts() {
  const container = document.getElementById('accounts-list-container');
  if (!container) return;
  container.innerHTML = '';

  // Noms de comptes suggérés (issus des soldes réels)
  const suggestedNames = [
    ...new Set((state.ACCOUNT_BALANCES || []).map((b) => b.id || b.compte)),
  ].sort();

  currentOwnerMappingState.accounts.forEach((acc, idx) => {
    const div = document.createElement('div');
    div.className = 'mapping-row';
    div.style.display = 'flex';
    div.style.gap = '8px';

    // Déterminer si le nom actuel est dans les suggestions
    const isOtherName = acc.name && !suggestedNames.includes(acc.name);
    const nameValue = isOtherName ? '__OTHER__' : acc.name || '';

    div.innerHTML = `
      <div style="flex:1; display:flex; flex-direction:column; gap:4px;">
        <select class="modal-select" onchange="currentOwnerMappingState.accounts[${idx}].name = (this.value === '__OTHER__' ? '' : this.value); toggleOtherInput(this);">
          <option value="">— Choisir un compte —</option>
          ${suggestedNames.map((n) => `<option value="${runtime.esc(n)}" ${n === acc.name ? 'selected' : ''}>${runtime.esc(n)}</option>`).join('')}
          <option value="__OTHER__" ${isOtherName ? 'selected' : ''}>— Autre —</option>
        </select>
        <input type="text" class="modal-input" placeholder="Nom du compte..." value="${runtime.esc(isOtherName ? acc.name : '')}" 
               style="display:${isOtherName ? 'block' : 'none'};" 
               onchange="currentOwnerMappingState.accounts[${idx}].name = this.value" />
      </div>
      <div style="flex:1; display:flex; flex-direction:column; gap:4px;">
        <select class="owner-select modal-select" onchange="currentOwnerMappingState.accounts[${idx}].owner = (this.value === '__OTHER__' ? '' : this.value); toggleOtherInput(this);">
          ${currentOwnerMappingState.owners.map((o) => `<option value="${runtime.esc(o)}" ${o === acc.owner ? 'selected' : ''}>${runtime.esc(o)}</option>`).join('')}
          <option value="__OTHER__">— Autre —</option>
        </select>
        <input type="text" class="modal-input" placeholder="Propriétaire..." style="display:none;" 
               onchange="const val=this.value.trim(); if(val){ if(!currentOwnerMappingState.owners.includes(val)) { currentOwnerMappingState.owners.push(val); renderOwners(); } currentOwnerMappingState.accounts[${idx}].owner = val; }" />
      </div>
      <button class="btn btn-sm" style="color:var(--red); height:32px;" onclick="removeAccountRow(${idx})">✕</button>
    `;
    container.appendChild(div);
  });
}
```

- [x] **Step 2: Mettre à jour `renderSavings`**

Même logique pour les épargnes.

```javascript
function renderSavings() {
  const container = document.getElementById('savings-list-container');
  if (!container) return;
  container.innerHTML = '';

  const suggestedNames = [
    ...new Set(
      [
        ...(state._placements || []).map((p) => p.nom),
        ...(state._savingsBalances || []).map((s) => s.nom),
      ].filter(Boolean),
    ),
  ].sort();

  currentOwnerMappingState.savings_patterns.forEach((sav, idx) => {
    const div = document.createElement('div');
    div.className = 'mapping-row';
    div.style.display = 'flex';
    div.style.gap = '8px';

    const isOtherName = sav.name && !suggestedNames.includes(sav.name);
    const nameValue = isOtherName ? '__OTHER__' : sav.name || '';

    div.innerHTML = `
      <div style="flex:1; display:flex; flex-direction:column; gap:4px;">
        <select class="modal-select" onchange="currentOwnerMappingState.savings_patterns[${idx}].name = (this.value === '__OTHER__' ? '' : this.value); toggleOtherInput(this);">
          <option value="">— Choisir une épargne —</option>
          ${suggestedNames.map((n) => `<option value="${runtime.esc(n)}" ${n === sav.name ? 'selected' : ''}>${runtime.esc(n)}</option>`).join('')}
          <option value="__OTHER__" ${isOtherName ? 'selected' : ''}>— Autre —</option>
        </select>
        <input type="text" class="modal-input" placeholder="Nom de l'épargne..." value="${runtime.esc(isOtherName ? sav.name : '')}" 
               style="display:${isOtherName ? 'block' : 'none'};" 
               onchange="currentOwnerMappingState.savings_patterns[${idx}].name = this.value" />
      </div>
      <div style="flex:1; display:flex; flex-direction:column; gap:4px;">
        <select class="owner-select modal-select" onchange="currentOwnerMappingState.savings_patterns[${idx}].owner = (this.value === '__OTHER__' ? '' : this.value); toggleOtherInput(this);">
          ${currentOwnerMappingState.owners.map((o) => `<option value="${runtime.esc(o)}" ${o === sav.owner ? 'selected' : ''}>${runtime.esc(o)}</option>`).join('')}
          <option value="__OTHER__">— Autre —</option>
        </select>
        <input type="text" class="modal-input" placeholder="Propriétaire..." style="display:none;" 
               onchange="const val=this.value.trim(); if(val){ if(!currentOwnerMappingState.owners.includes(val)) { currentOwnerMappingState.owners.push(val); renderOwners(); } currentOwnerMappingState.savings_patterns[${idx}].owner = val; }" />
      </div>
      <button class="btn btn-sm" style="color:var(--red); height:32px;" onclick="removeSavingRow(${idx})">✕</button>
    `;
    container.appendChild(div);
  });
}
```

- [x] **Step 3: Commit**

```bash
git add public/src/patrimoine.js
git commit -m "feat: use select with other option for accounts and savings"
```

### Task 4: Mise à jour de la Sauvegarde et Validation

**Files:**

- Modify: `public/src/patrimoine.js`

- [x] **Step 1: Modifier `saveOwnerMappingConfig`**

S'assurer que les valeurs sont correctement extraites avant de sauvegarder sur Firestore.

```javascript
async function saveOwnerMappingConfig() {
  const status = document.getElementById('owner-mapping-status');
  if (status) {
    status.style.color = 'var(--muted)';
    status.textContent = 'Enregistrement...';
  }

  const defSelect = document.getElementById('owner-mapping-default-owner');
  if (defSelect) currentOwnerMappingState.default_owner = defSelect.value;

  if (currentOwnerMappingState.owners.length === 0) {
    if (status) {
      status.style.color = 'var(--red)';
      status.textContent = 'Veuillez ajouter au moins un propriétaire.';
    }
    return;
  }

  // Validation des noms vides
  const hasEmptyAccount = currentOwnerMappingState.accounts.some(
    (a) => !a.name.trim() || !a.owner.trim(),
  );
  const hasEmptySaving = currentOwnerMappingState.savings_patterns.some(
    (s) => !s.name.trim() || !s.owner.trim(),
  );

  if (hasEmptyAccount || hasEmptySaving) {
    if (status) {
      status.style.color = 'var(--red)';
      status.textContent = 'Tous les champs (noms et propriétaires) doivent être remplis.';
    }
    return;
  }

  const accountsObj = {};
  for (const acc of currentOwnerMappingState.accounts) {
    const name = acc.name.trim();
    if (accountsObj[name]) {
      if (status) {
        status.style.color = 'var(--red)';
        status.textContent = `Erreur : Le compte "${name}" est dupliqué.`;
      }
      return;
    }
    accountsObj[name] = acc.owner;
  }

  const savingsObj = {};
  for (const sav of currentOwnerMappingState.savings_patterns) {
    const name = sav.name.trim();
    if (savingsObj[name]) {
      if (status) {
        status.style.color = 'var(--red)';
        status.textContent = `Erreur : L'épargne "${name}" est dupliquée.`;
      }
      return;
    }
    savingsObj[name] = sav.owner;
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
      status.textContent = 'Configuration enregistrée !';
    }
    setTimeout(closeOwnerMappingModal, 1000);
    // Optionnel: rafraîchir l'affichage du patrimoine
    if (window.renderPatrimoine) renderPatrimoine();
  } catch (err) {
    console.error('Save config error:', err);
    if (status) {
      status.style.color = 'var(--red)';
      status.textContent = 'Erreur lors de la sauvegarde.';
    }
  }
}
```

- [x] **Step 2: Commit final**

```bash
git add public/src/patrimoine.js
git commit -m "feat: update save logic and validation for owner mapping"
```

---

### Vérification de l'implémentation

1.  **Ouverture du Modal** : Cliquer sur le bouton de configuration dans l'onglet Patrimoine.
2.  **Rendu** : Vérifier que les listes déroulantes affichent les comptes et épargnes existants.
3.  **Option Autre** : Sélectionner "— Autre —" dans un nom de compte et vérifier que l'input texte apparaît.
4.  **Ajout de Propriétaire** : Saisir un nouveau nom dans l'input "Autre" du propriétaire d'une ligne et vérifier qu'il est ajouté à la liste globale des propriétaires en haut.
5.  **Sauvegarde** : Enregistrer et vérifier que les données sont persistées dans Firestore (`metadata/account_owners_mapping`).
6.  **Rechargement** : Fermer et rouvrir le modal pour vérifier que les sélecteurs sont bien positionnés sur les valeurs enregistrées.
