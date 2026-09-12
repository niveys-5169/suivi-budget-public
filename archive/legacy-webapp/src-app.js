// --- CODE EXTRAIT AUTOMATIQUEMENT --- 
import { state, setState, patchState, constants, FSCache } from './store.js';
import { FIREBASE_CONFIG as APP_FIREBASE_CONFIG, PORTFOLIO_FIREBASE_CONFIG as APP_PORTFOLIO_FIREBASE_CONFIG } from './firebase-setup.js';
import { collectionRef, docRef, createBatch, fieldDelete, triggerLinxoImport, getGitHubSettings, saveGitHubSettings, triggerGitHubWorkflow as firebaseGitHubWorkflow } from './services/firebase-api.js';
import { loadAllTransactions, loadTransactions, normalizeSearchValue, buildAmountSearchValues, applyFilters as txApplyFilters, renderTable, renderCards, togglePointe, openDetailModal, closeDetailModal, saveDetailChanges, openDeleteModal, closeDeleteModal, confirmDelete, openAddModal, closeAddModal, submitAdd, getSortableValue, sortBy, buildYearFilter, buildCategoryFilter, getCatStyle, formatLibelle, ICONS_MAP, AVAILABLE_COLORS } from './transactions.js';
import { loadBudgets, renderBudget, getBudgetCategoryCandidates_, getAllKnownBudgetCategories, resetBudgetPeriodToCurrentMonth } from './budget.js';
import { initPatrimoineModule } from './patrimoine.js';
import { aggregateMonthlyTransactions, detectRecurringTransactionsPure } from './utils/maths.ts';
import { buildDuplicatePairKey, detectDuplicatePairsPure } from './utils/duplicates.ts';
import { parseDateInput } from './utils/date.ts';
import { buildCategoryModel as buildCategoryModelPure, suggestCategory as suggestCategoryPure } from './services/aiEngine.ts';

let applyFilters = txApplyFilters;

const patrimoine = initPatrimoineModule({
  fmt: (...args) => fmt(...args),
  esc: (...args) => esc(...args),
  escJs: (...args) => escJs(...args),
  toast: (...args) => toast(...args),
  captureError: (...args) => captureError(...args),
});
const {
  loadPlacements,
  patrimoineComputeTotals,
  renderPatrimoine,
  renderPatrimoineCourants,
  renderPatrimoinePlacements,
  renderSavingsBalances,
  openPatrimoineDetails,
  openAddPlacementModal,
  closeAddPlacementModal,
  submitAddPlacement,
  openEditPlacementModal,
  closeEditPlacementModal,
  submitEditPlacement,
  deletePlacement,
  snapshotPlacements,
  buildPatrimoineRepartitionChart,
  buildPatrimoineEvolutionChart,
  portfolioTimestampMs,
  portfolioHoldingScore,
  isBetterPortfolioHolding,
  dedupePortfolioHoldings,
  loadPortfolioHoldings,
  getFilteredHoldings,
  portfolioHoldingMatchesFilters,
  aggregatePortfolioHoldingsByOwner,
  renderPortfolioFilters,
  onPortfolioFilterChange,
  pfRowKey,
  toggleAccountGroup,
  toggleHoldingDetail,
  renderPortfolioSummary,
  renderPortfolioHoldingsTable,
} = patrimoine;

// ══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION FIREBASE
// ══════════════════════════════════════════════════════════════════════════════
// La configuration est maintenant importée depuis firebase-setup.js pour centraliser.
const FIREBASE_CONFIG = APP_FIREBASE_CONFIG;
// ── SuiviPortefeuille (2e projet Firebase — lecture seule) ──
const PORTFOLIO_FIREBASE_CONFIG = APP_PORTFOLIO_FIREBASE_CONFIG;

const FALLBACK_CATEGORIES = {
  'Dépenses': [
    'A Catégoriser',
    'Achats shopping autres',
    'Apple Music',
    'Assistance juridique',
    'Assurance crédit Maison Gwen',
    'Assurance crédit Maison Nico',
    'Assurance Extension Gwen',
    'Assurance Extension Nico',
    'Assurance habitation',
    'Assurance voiture',
    'Cantine + Alae + Centre',
    'CFDT Nico',
    'Crédit Extension',
    'Crédit Maison',
    'Crédit Maison ProBTP',
    'Crédit voiture',
    'Eau',
    'EDF',
    'Electricité voiture',
    'Entretien Clim/Chauffage',
    'Entretien voiture + Pneus',
    'Epargne',
    'Extension',
    'Fibre SFR',
    'Frais bancaires',
    'Habits',
    'iCloud',
    'Impots fonciers',
    'Kdo Anniversaire nous 4',
    'Kdos Anniversaires',
    'Mobile Gwen',
    'Mobile Nico',
    'Netflix',
    'Noel Famille',
    'Noels nous 4',
    'Notes de frais',
    'Nourriture',
    'Prime',
    'Renouvellement Electronique/electromenager',
    'Santé',
    'Sorties',
    'Sport',
    'Travaux maison',
    'Vacances Autres',
    'Vacances été (Bretagne)',
    'Vacances Noel (Bretagne)',
    'Vacances Novembre',
    'Vacances ski',
  ],
  'Revenus': [
    'Autres revenus',
    'CAF',
    'Prime vacance',
    'Remboursement',
    'Retrait Epargne',
    'Salaire Gwen',
    'Salaire Nico',
    'Virements internes',
  ],
};

// En migration Vite, certains déploiements n'embarquent plus la constante globale
// legacy `CATEGORIES`. On garde une source locale sûre pour éviter un écran budget
// vide (ReferenceError) quand l'utilisateur ouvre l'onglet Budget.
const CATEGORIES = (() => {
  const fromWindow = window.CATEGORIES;
  if (fromWindow && typeof fromWindow === 'object') {
    const depenses = Array.isArray(fromWindow['Dépenses']) ? fromWindow['Dépenses'] : [];
    const revenus = Array.isArray(fromWindow['Revenus']) ? fromWindow['Revenus'] : [];
    const hasUsablePreset = depenses.length > 0 || revenus.length > 0;
    return {
      'Dépenses': hasUsablePreset ? depenses : [...FALLBACK_CATEGORIES['Dépenses']],
      'Revenus': hasUsablePreset ? revenus : [...FALLBACK_CATEGORIES['Revenus']],
    };
  }
  return {
    'Dépenses': [...FALLBACK_CATEGORIES['Dépenses']],
    'Revenus': [...FALLBACK_CATEGORIES['Revenus']],
  };
})();
window.CATEGORIES = CATEGORIES;
// ══════════════════════════════════════════════════════════════════════════════
//
// RÈGLES FIRESTORE (Console → Firestore → Règles) :
//
//   rules_version = '2';
//   service cloud.firestore {
//     match /databases/{database}/documents {
//       match /{document=**} {
//         allow read, write: if request.auth != null
//                            && request.auth.token.email == "user@example.com"
//                            && request.auth.token.email_verified == true;
//       }
//     }
//   }
//
// ══════════════════════════════════════════════════════════════════════════════

// ══ MODAL AJOUTER PLACEMENT ══
document.body.insertAdjacentHTML('beforeend', `
<div class="modal-overlay" id="modal-add-placement">
  <div class="modal-card">
    <h2>Ajouter un placement</h2>
    <div class="modal-field">
      <label>Nom</label>
      <input type="text" id="placement-nom" placeholder="Livret A, Assurance-vie..." />
    </div>
    <div class="modal-field">
      <label>Type</label>
      <select id="placement-type">
        <option value="epargne">Épargne (Livret A, LDDS, LEP...)</option>
        <option value="assurance_vie">Assurance-vie</option>
        <option value="per">PER (Plan Épargne Retraite)</option>
        <option value="pea">PEA</option>
        <option value="cto">CTO (Compte-Titres)</option>
        <option value="autre">Autre</option>
      </select>
    </div>
    <div class="modal-field">
      <label>Montant actuel (€)</label>
      <input type="number" id="placement-montant" step="0.01" placeholder="10000.00" />
    </div>
    <div class="modal-field">
      <label>Commentaire (optionnel)</label>
      <input type="text" id="placement-commentaire" placeholder="" />
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeAddPlacementModal()">Annuler</button>
      <button class="btn-primary" onclick="submitAddPlacement()">Ajouter</button>
    </div>
  </div>
</div>
<div class="modal-overlay" id="modal-edit-placement">
  <div class="modal-card">
    <h2>Modifier le placement</h2>
    <div class="modal-field">
      <label>Nom</label>
      <input type="text" id="edit-placement-nom" />
    </div>
    <div class="modal-field">
      <label>Type</label>
      <select id="edit-placement-type">
        <option value="epargne">Épargne (Livret A, LDDS, LEP...)</option>
        <option value="assurance_vie">Assurance-vie</option>
        <option value="per">PER (Plan Épargne Retraite)</option>
        <option value="pea">PEA</option>
        <option value="cto">CTO (Compte-Titres)</option>
        <option value="autre">Autre</option>
      </select>
    </div>
    <div class="modal-field">
      <label>Montant actuel (€)</label>
      <input type="number" id="edit-placement-montant" step="0.01" />
    </div>
    <div class="modal-field">
      <label>Commentaire</label>
      <input type="text" id="edit-placement-commentaire" />
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeEditPlacementModal()">Annuler</button>
      <button class="btn-primary" onclick="submitEditPlacement()">Enregistrer</button>
    </div>
  </div>
</div>
<div class="modal-overlay" id="modal-category-style">
  <div class="modal-card">
    <h2>Style de la catégorie</h2>
    <p id="style-cat-name" style="font-weight:600;margin-bottom:16px;color:var(--primary);"></p>
    <div class="modal-field">
      <label>Icône</label>
      <div id="style-icon-grid" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;"></div>
    </div>
    <div class="modal-field">
      <label>Couleur</label>
      <div id="style-color-grid" style="display:flex;gap:8px;flex-wrap:wrap;"></div>
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeCategoryStyleModal()">Annuler</button>
      <button class="btn" onclick="resetCategoryStyle()" style="color:var(--red)">Par défaut</button>
      <button class="btn-primary" onclick="saveCategoryStyle()">Enregistrer</button>
    </div>
  </div>
</div>
<div class="modal-overlay" id="modal-owner-mapping">
  <div class="modal-card" style="max-width:800px; width:100%; max-height:90vh; overflow-y:auto;">
    <h2>Configurer les propriétaires</h2>
    
    <div class="modal-field">
      <label>Propriétaires</label>
      <div id="owner-list-container" style="display:flex; flex-direction:column; gap:8px; margin-bottom:8px;"></div>
      <div style="display:flex; gap:8px;">
        <input type="text" id="new-owner-input" placeholder="Nouveau propriétaire..." style="flex:1;" onkeypress="if(event.key==='Enter') addOwner()" />
        <button class="btn" onclick="addOwner()">Ajouter</button>
      </div>
    </div>
    
    <div class="modal-field">
      <label>Propriétaire par défaut</label>
      <select id="owner-mapping-default-owner" class="modal-select"></select>
      <p style="font-size:11px; color:var(--muted); margin-top:6px;">Utilisé quand un compte ou épargne n'est pas explicitement assigné.</p>
    </div>

    <div class="modal-field" style="display:flex; gap:16px; flex-wrap:wrap;">
      <div style="flex:1 1 300px; min-width:260px;">
        <label>Comptes Courants</label>
        <div id="accounts-list-container" style="display:flex; flex-direction:column; gap:8px; margin-bottom:8px;"></div>
        <button class="btn btn-sm" onclick="addAccountRow()">+ Ajouter un compte</button>
      </div>
      
      <div style="flex:1 1 300px; min-width:260px;">
        <label>Épargnes</label>
        <div id="savings-list-container" style="display:flex; flex-direction:column; gap:8px; margin-bottom:8px;"></div>
        <button class="btn btn-sm" onclick="addSavingRow()">+ Ajouter une épargne</button>
      </div>
    </div>
    
    <div id="owner-mapping-status" style="font-size:12px; color:var(--red); min-height:18px; margin-bottom:10px;"></div>
    <div class="modal-actions">
      <button class="btn" onclick="closeOwnerMappingModal()">Annuler</button>
      <button class="btn-primary" onclick="saveOwnerMappingConfig()">Sauvegarder</button>
    </div>
  </div>
</div>
`);

// État centralisé importé depuis store.js

// ── Auth / Init ───────────────────────────────────────────────────────────────

function setLoaderMsg(html) {
  document.getElementById('loader').innerHTML =
    '<div class="spinner"></div><br>' + html;
}

if (typeof firebase === 'undefined') {
  setLoaderMsg(
    '<strong style="color:#c53030">Les scripts Firebase ne se sont pas chargés.</strong><br><br>' +
    'Causes possibles :<br>' +
    '&bull; Un bloqueur de publicités (uBlock, AdGuard…) bloque <code>gstatic.com</code>.<br>' +
    '&bull; Pas de connexion internet.<br>' +
    '&bull; Proxy / réseau d\'entreprise filtrant les CDN.<br><br>' +
    '<strong>Solution :</strong> désactive le bloqueur pour cette page, puis recharge.'
  );
} else if (FIREBASE_CONFIG.apiKey === 'REPLACE_ME' || (FIREBASE_CONFIG.authorizedEmails || '') === 'REPLACE_ME') {
  setLoaderMsg(
    '<strong style="color:#c53030">Configuration manquante.</strong><br>' +
    'Remplace les valeurs <code>REPLACE_ME</code> dans <code>FIREBASE_CONFIG</code>.'
  );
} else {
  try {
    // Guard for Vite HMR: if Firebase is already initialized (same app name), reuse it.
    if (!firebase.apps || !firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
  } catch (e) {
    // esc() is not yet defined at this point in the module (TDZ) — use String() instead.
    const msg = String(e && e.message ? e.message : e);
    if (msg.includes('already exists')) {
      // Already initialized (HMR / duplicate load) — safe to continue with existing app.
    } else {
      setLoaderMsg('<strong style="color:#c53030">Erreur initializeApp : ' + msg + '</strong>');
      throw e;
    }
  }

  const googleProvider = new firebase.auth.GoogleAuthProvider();

  // Initialiser la 2e app Firebase (SuiviPortefeuille) dès le démarrage
  // afin que l'auth persiste entre les pages (même logique que l'app principale)
  if (!state._portfolioApp) {
    try { setState('_portfolioApp', firebase.app('portfolio')); }
    catch (_) { setState('_portfolioApp', firebase.initializeApp(PORTFOLIO_FIREBASE_CONFIG, 'portfolio')); }
    setState('_portfolioDb', state._portfolioApp.firestore());

    // Écouter la restauration d'auth du projet portfolio (async après rechargement de page).
    // Quand l'utilisateur est restauré, recharger les holdings si le dashboard est déjà prêt.
    setState('_portfolioAuthReady', new Promise(resolve => { setState('_portfolioAuthResolve', resolve); }));
    state._portfolioApp.auth().onAuthStateChanged(portfolioUser => {
      // Résoudre la promise pour débloquer les appels qui attendent l'auth
      if (state._portfolioAuthResolve) {
        state._portfolioAuthResolve(portfolioUser || null);
        setState('_portfolioAuthResolve', null);
      }
      if (portfolioUser && state.AUTH_BOOTSTRAPPED_UID) {
        loadPortfolioHoldings();
      }
    });
  }

  setLoaderMsg('Vérification de l\'authentification…');
  const authTimeout = setTimeout(() => {
    setLoaderMsg(
      '<strong style="color:#c53030">Firebase Auth ne répond pas après 12 s.</strong><br><br>' +
      'Causes possibles :<br>' +
      '&bull; <a href="https://console.firebase.google.com/project/suivi-budget-ab888/authentication/providers" target="_blank" rel="noopener noreferrer">' +
      'Google Sign-in non activé dans Firebase Console</a><br>' +
      '&bull; Ce domaine absent de la liste blanche :<br>' +
      '&nbsp;&nbsp;<a href="https://console.firebase.google.com/project/suivi-budget-ab888/authentication/settings" target="_blank" rel="noopener noreferrer">' +
      'Authentication → Settings → Domaines autorisés</a><br>' +
      '&bull; Réseau coupé ou proxy bloquant <code>firebaseapp.com</code><br><br>' +
      '<button onclick="location.reload()" style="padding:6px 14px;cursor:pointer">Réessayer</button>'
    );
  }, 12000);

  firebase.auth().onAuthStateChanged(async user => {
    if (state.AUTH_BOOTSTRAP_IN_PROGRESS) return;
    clearTimeout(authTimeout);

    if (user && state.AUTH_BOOTSTRAPPED_UID === user.uid) {
      return;
    }

    setState('AUTH_BOOTSTRAP_IN_PROGRESS', true);

    try {
      if (!user) {
        setState('AUTH_BOOTSTRAPPED_UID', null);
        document.getElementById('login-screen').style.display = 'flex';
        hideLoader();
        return;
      }
      const authorizedEmails = (FIREBASE_CONFIG.authorizedEmails || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
      if (!authorizedEmails.includes(user.email.toLowerCase())) {
        await firebase.auth().signOut();
        setState('AUTH_BOOTSTRAPPED_UID', null);
        document.getElementById('login-screen').style.display = 'flex';
        const el = document.getElementById('login-error');
        el.textContent = `Compte non autorisé : ${user.email}`;
        el.style.display = 'block';
        hideLoader();
        return;
      }
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('btn-logout').style.display = 'block';

      setLoaderMsg('Connexion à Firestore…');
      setState('db', firebase.firestore());

      try {
        setState('userId', user.uid);
        await loadTransactions();
        setState('AUTH_BOOTSTRAPPED_UID', user.uid);
        // Charger les paires de doublons ignorées depuis Firestore (en arrière-plan)
        initReviewedDuplicatePairs().catch(err =>
          console.warn('[doublons] init silencieux échoué', err.message)
        );
        // Charger et afficher les paramètres GitHub
        updateGithubSettingsNote().catch(err =>
          console.warn('[GitHub settings] init silencieux échoué', err.message)
        );
      } catch (err) {
        setLoaderMsg(
          '<strong style="color:#c53030">Erreur Firestore : ' + esc(err.message) + '</strong><br><br>' +
          '<button onclick="location.reload()" style="padding:6px 14px;cursor:pointer">Réessayer</button>'
        );
        showError(`Erreur Firebase : <strong>${esc(err.message)}</strong>`);
        setStatus('err', 'Erreur');
      }
    } finally {
      setState('AUTH_BOOTSTRAP_IN_PROGRESS', false);
    }
  });

  window.signInWithGoogle = async function() {
    document.getElementById('login-error').style.display = 'none';
    try {
      const result = await firebase.auth().signInWithPopup(googleProvider);
      // S'authentifier également au projet portfolio avec le même credential Google
      // afin que Firestore accepte les lectures (l'auth est persistée localement)
      if (state._portfolioApp) {
        if (result.credential) {
          try {
            await state._portfolioApp.auth().signInWithCredential(result.credential);
            console.log('[Portfolio auth] signInWithCredential OK');
          } catch (pErr) {
            // credential refusé (domaine non autorisé, projet mal configuré, etc.)
            console.warn('[Portfolio auth] signInWithCredential échoué :', pErr.code, pErr.message);
            // Fallback : ouvrir un 2e popup Google pour le projet portfolio
            try {
              const portfolioProvider = new firebase.auth.GoogleAuthProvider();
              await state._portfolioApp.auth().signInWithPopup(portfolioProvider);
              console.log('[Portfolio auth] signInWithPopup fallback OK');
            } catch (pErr2) {
              console.error('[Portfolio auth] popup fallback échoué :', pErr2.code, pErr2.message);
              // Stocker l'erreur pour l'afficher dans loadPortfolioHoldings
              setState('_portfolioAuthError', `${pErr2.code} — ${pErr2.message}`);
            }
          }
        } else {
          console.warn('[Portfolio auth] result.credential est null — impossible de signer dans le projet portfolio');
          setState('_portfolioAuthError', 'credential null après signInWithPopup');
        }
      }
    } catch (err) {
      const el = document.getElementById('login-error');
      el.textContent = `Erreur : ${err.message}`;
      el.style.display = 'block';
    }
  };

  window.doSignOut = async function() {
    if (state._portfolioApp) {
      try { await state._portfolioApp.auth().signOut(); } catch (_) {}
    }
    await firebase.auth().signOut();
  };
}

// Debug: Test GitHub settings synchronization (accessible from console)
window.testGitHubSettings = async function() {
  console.log('🔍 Testing GitHub Settings...');
  const settings = await getGitHubSettings();
  console.log('✅ GitHub Settings:', settings);
  console.log('📦 User ID:', state.userId);
  return settings;
};

function _formatCloudFunctionError(err) {
  const code = err.code ? ` [${err.code}]` : '';
  const details = err.details
    ? ` — ${typeof err.details === 'string' ? err.details : JSON.stringify(err.details)}`
    : '';
  return `Erreur Cloud Function${code} : ${err.message}${details}`;
}

async function refreshTransactionsFromEmails() {
  const btn = document.getElementById('btn-refresh-mails');
  const initialLabel = btn ? btn.textContent : '';
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Import…';
  }
  try {
    toast('Recherche de nouveaux emails Linxo…', '');
    const data = await triggerLinxoImport();
    FSCache.invalidateAll();
    await loadTransactions();
    scrollToPanel('transactions');
    if (data && data.transactionsImported > 0) {
      toast(`${data.transactionsImported} transaction(s) importée(s) ✅ (${data.emailsProcessed ?? 0} email(s) traité(s))`, 'success');
    } else {
      toast(`Aucune nouvelle transaction (${data?.emailsProcessed ?? 0} email(s) traité(s))`, '');
    }
  } catch (err) {
    console.error('[refreshTransactionsFromEmails]', err);
    toast(_formatCloudFunctionError(err), 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = initialLabel || '↻ Rafraîchir mails';
    }
  }
}

async function requestFullMailScan() {
  const btn = document.getElementById('btn-full-scan-mails');
  const initialLabel = btn ? btn.textContent : '';
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Scan…';
  }
  try {
    toast('Scan complet des emails Linxo…', '');
    const data = await triggerLinxoImport();
    FSCache.invalidateAll();
    await loadTransactions();
    scrollToPanel('transactions');
    if (data && data.transactionsImported > 0) {
      toast(`${data.transactionsImported} transaction(s) importée(s) ✅ (${data.emailsProcessed ?? 0} email(s) traité(s))`, 'success');
    } else {
      toast(`Scan terminé — aucune nouvelle transaction (${data?.emailsProcessed ?? 0} email(s) traité(s))`, '');
    }
  } catch (err) {
    console.error('[requestFullMailScan]', err);
    toast(_formatCloudFunctionError(err), 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = initialLabel || '⟳ Scan complet';
    }
  }
}

function renderBalancesPanel() {
  const box = document.getElementById('balances-list');
  if (!box) return;

  if (!state.ACCOUNT_BALANCES.length) {
    box.innerHTML = '<div class="balance-detail">Aucun solde disponible pour le moment.</div>';
    return;
  }

  const rows = state.ACCOUNT_BALANCES
    .slice()
    .sort((a, b) => String(a.compte || a.id).localeCompare(String(b.compte || b.id), 'fr'));

  box.innerHTML = rows.map(r => {
    const compte = r.compte || r.id || 'Compte';
    const status = r.status || 'UNKNOWN';
    const fingerprint = buildBalanceMismatchFingerprint(r);
    const isMismatchAcked = status === 'MISMATCH' && r.mismatchAckFingerprint && r.mismatchAckFingerprint === fingerprint;
    const statusTxt = status === 'OK'
      ? 'OK'
      : status === 'MISMATCH'
        ? (isMismatchAcked ? 'Écart accepté' : 'Écart')
        : 'À initialiser';
    const statusCls = status === 'OK'
      ? 'status-ok'
      : status === 'MISMATCH'
        ? (isMismatchAcked ? 'status-ack' : 'status-ko')
        : 'status-warn';
    const ecartValue = isMismatchAcked ? 0 : r.ecart;
    const prevValue = isMismatchAcked ? 0 : r.previousSolde;
    const deltaValue = isMismatchAcked ? 0 : r.linxoDelta;
    const computedValue = isMismatchAcked ? 0 : r.computedSolde;
    const soldeValue = r.solde;

    const ecart = typeof ecartValue === 'number' ? fmt(ecartValue) : '—';
    const prev = typeof prevValue === 'number' ? fmt(prevValue) : '—';
    const delta = typeof deltaValue === 'number' ? fmt(deltaValue) : '—';
    const computed = typeof computedValue === 'number' ? fmt(computedValue) : '—';
    const solde = typeof soldeValue === 'number' ? fmt(soldeValue) : '—';
    const accountId = r.id || r.compte || '';

    const actions = status === 'MISMATCH'
      ? `
        <div class="balance-card-actions">
          <button class="btn-balance-inline" onclick="acknowledgeBalanceMismatch('${escJs(accountId)}')">✅ C'est OK pour l'instant</button>
          <button class="btn-balance-inline" onclick="rerunBalanceCheck('${escJs(accountId)}')">↻ Relancer la vérification</button>
        </div>
      `
      : '';

    return `
      <div class="balance-card">
        <div class="balance-head">
          <div class="balance-account">${esc(compte)}</div>
          <div class="balance-status ${statusCls}">${statusTxt}</div>
        </div>
        <div class="balance-solde">${solde}</div>
        <div class="balance-detail">
          Solde précédent: ${prev}<br>
          Δ transactions Linxo: ${delta}<br>
          Solde recalculé: ${computed}<br>
          Écart: <strong>${ecart}</strong>
        </div>
        ${actions}
      </div>
    `;
  }).join('');
}

function buildBalanceMismatchFingerprint(balanceRow = {}) {
  return [
    balanceRow.status || '',
    Number(balanceRow.ecart ?? ''),
    Number(balanceRow.previousSolde ?? ''),
    Number(balanceRow.linxoDelta ?? ''),
    Number(balanceRow.computedSolde ?? ''),
    Number(balanceRow.solde ?? ''),
  ].join('|');
}

async function acknowledgeBalanceMismatch(accountId) {
  if (!state.db || !accountId) return;
  const row = state.ACCOUNT_BALANCES.find(r => (r.id || r.compte) === accountId || r.id === accountId);
  if (!row || row.status !== 'MISMATCH') {
    toast('Aucun écart actif à valider.', 'error');
    return;
  }

  const fingerprint = buildBalanceMismatchFingerprint(row);
  try {
    await collectionRef(state.db, 'account_balances').doc(accountId).set({
      mismatchAckFingerprint: fingerprint,
      mismatchAckBy: firebase.auth().currentUser?.email || '',
      mismatchAckAt: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    toast('Écart validé temporairement. Le check reprendra dès qu\'un nouveau solde arrivera.', 'success');
    FSCache.invalidate('transactions', 'transactions_all');
    await loadTransactions();
  } catch (err) {
    toast('Impossible de valider l\'écart: ' + err.message, 'error');
  }
}

async function rerunBalanceCheck(accountId) {
  if (!state.db || !accountId) return;
  try {
    await collectionRef(state.db, 'account_balances').doc(accountId).set({
      mismatchAckFingerprint: fieldDelete(),
      mismatchAckBy: fieldDelete(),
      mismatchAckAt: fieldDelete(),
    }, { merge: true });
    toast('Vérification relancée (scan complet demandé).', 'success');
    await requestFullMailScan();
  } catch (err) {
    toast('Impossible de relancer la vérification: ' + err.message, 'error');
  }
}

function renderTopBalances() {
  const box = document.getElementById('top-balances');
  if (!box) return;

  if (!state.ACCOUNT_BALANCES.length) {
    box.innerHTML = '<span class="top-balance-empty">Soldes indisponibles.</span>';
    return;
  }

  const rows = state.ACCOUNT_BALANCES
    .slice()
    .sort((a, b) => String(a.compte || a.id).localeCompare(String(b.compte || b.id), 'fr'));

  box.innerHTML = rows.map(r => {
    const compte = r.compte || r.id || 'Compte';
    const fingerprint = buildBalanceMismatchFingerprint(r);
    const isMismatchAcked = r.status === 'MISMATCH' && r.mismatchAckFingerprint && r.mismatchAckFingerprint === fingerprint;
    const soldeValue = r.solde;
    const solde = typeof soldeValue === 'number' ? fmt(soldeValue) : '—';
    return `<span class="top-balance-chip"><span class="account">${esc(compte)}</span><span class="amount">${solde}</span></span>`;
  }).join('');
}

// ── Reste à vivre — fonctions utilitaires ─────────────────────────────────────

// Catégories exclues par défaut du calcul du revenu attendu
const RAV_DEFAULT_EXCLUDED_INCOME_CATS = new Set(['Virements internes', 'Retrait Epargne']);

/**
 * Retourne l'ensemble des catégories de revenus à prendre en compte pour le RAV.
 * Utilise la config Firestore si disponible, sinon les catégories "Revenus" hors transferts/épargne.
 */
function getRavIncomeCategories() {
  if (Array.isArray(RAV_CONFIG.revenu_categories) && RAV_CONFIG.revenu_categories.length > 0) {
    return new Set(RAV_CONFIG.revenu_categories);
  }
  // Défaut : toutes les catégories de revenus sauf virements et retraits d'épargne
  const allRevenuCats = CATEGORIES['Revenus'] || [];
  return new Set(allRevenuCats.filter(c => !RAV_DEFAULT_EXCLUDED_INCOME_CATS.has(c)));
}

/**
 * Retourne toutes les catégories pouvant apparaître comme revenus (union de la config
 * statique et des catégories réellement présentes dans les transactions positives pointées).
 */
function getAllKnownIncomeCategories() {
  const cats = new Set(CATEGORIES['Revenus'] || []);
  state.ALL_TX.forEach(t => { if (t.montant > 0 && t.categorie) cats.add(t.categorie); });
  return [...cats].sort((a, b) => a.localeCompare(b, 'fr'));
}

/**
 * Calcule la moyenne des revenus mensuels pointés sur les n derniers mois complets,
 * en ne retenant que les catégories de revenus configurées.
 */
function getAverageMonthlyIncome(n = 3) {
  const incomeCats = getRavIncomeCategories();
  const now = new Date();
  const months = [];
  for (let i = 1; i <= n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(currentMonthKey(d));
  }
  const validIncomes = months
    .map(mk => state.ALL_TX
      .filter(t => getAssignedMonthKey(t) === mk && t.montant > 0 && isPointedTransaction(t) && incomeCats.has(t.categorie))
      .reduce((s, t) => s + t.montant, 0))
    .filter(v => v > 0);
  return validIncomes.length > 0
    ? validIncomes.reduce((s, v) => s + v, 0) / validIncomes.length
    : 0;
}

/**
 * Affiche les cases à cocher de sélection des catégories de revenus dans le panneau RAV.
 */
function renderRavCategorySelector() {
  const container = document.getElementById('rav-categories-container');
  if (!container) return;
  const allCats = getAllKnownIncomeCategories();
  const selected = getRavIncomeCategories();
  container.innerHTML = allCats.map(cat => {
    const checked = selected.has(cat) ? 'checked' : '';
    const isExcludedByDefault = RAV_DEFAULT_EXCLUDED_INCOME_CATS.has(cat);
    const hint = isExcludedByDefault ? '<span style="color:var(--muted);font-size:11px"> — exclu par défaut</span>' : '';
    return `<label style="display:flex;align-items:center;gap:10px;font-size:13px;font-weight:400;cursor:pointer;padding:5px 0;border-bottom:1px solid var(--border)">
      <input type="checkbox" value="${esc(cat)}" ${checked} style="width:15px;height:15px;flex-shrink:0;cursor:pointer">
      <span>${esc(cat)}${hint}</span>
    </label>`;
  }).join('');
}

/**
 * Retourne la liste des provisions récurrentes mensuelles acceptées
 * qui ne semblent pas encore avoir été débitées ce mois-ci.
 */
function getPendingProvisions(monthKey) {
  const monthTxs = state.ALL_TX.filter(t =>
    getAssignedMonthKey(t) === monthKey && isPointedTransaction(t) && t.montant < 0
  );
  const rawItems = detectRecurringTransactionsPure(state.ALL_TX);
  return rawItems
    .map(r => {
      const key = getRecurringKey(r);
      const s = RECURRING_SETTINGS[key] || {};
      return { ...r, key, status: s.status || 'pending', freq: s.customFreq || r.freq };
    })
    .filter(r => r.status === 'accepted' && r.avgAmount < 0 && r.freq === 'Mensuel')
    .filter(r => {
      const labelPrefix = String(r.label || '').toLowerCase().slice(0, 12);
      return !monthTxs.some(t =>
        (r.category && t.categorie === r.category &&
          Math.abs(t.montant) >= Math.abs(r.avgAmount) * 0.5 &&
          Math.abs(t.montant) <= Math.abs(r.avgAmount) * 1.5) ||
        (labelPrefix.length >= 4 && t.libelle.toLowerCase().includes(labelPrefix))
      );
    });
}

/**
 * Retourne la somme (négative) des charges récurrentes mensuelles acceptées
 * qui ne semblent pas encore avoir été débitées ce mois-ci.
 */
function getRecurringProvisions(monthKey) {
  return getPendingProvisions(monthKey).reduce((s, r) => s + r.avgAmount, 0);
}

function showRavIncomes() {
  const dashboardTx = dashboardFilteredTransactions();
  const incomeCats = getRavIncomeCategories();
  const incomeTxs = dashboardTx.filter(t => t.montant > 0 && incomeCats.has(t.categorie));
  openChartPopup(incomeTxs, 'Revenus pris en compte (Réel ce mois-ci)');
}

function showRavExpenses() {
  const dashboardTx = dashboardFilteredTransactions();
  const depTxs = dashboardTx.filter(t => t.montant < 0);
  openChartPopup(depTxs, 'Dépenses prises en compte (Mois courant)');
}

function showRavProvisions() {
  if (state.DASHBOARD_PERIOD !== 'current_month') return;
  const pending = getPendingProvisions(state.DASHBOARD_MONTH_KEY);
  const mockTxs = pending.map((p, idx) => ({
    id: 'mock_prov_' + idx,
    date: 'À venir',
    libelle: p.label,
    compte: p.compte || '—',
    montant: p.avgAmount,
    categorie: p.category || 'A Catégoriser'
  }));
  openChartPopup(mockTxs, 'Provisions récurrentes (Estimations)');
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function renderDashboard() {
  syncDashboardCategories();
  const dashboardTx = dashboardFilteredTransactions();
  const dep = dashboardTx.filter(t => t.montant < 0);
  const rec = dashboardTx.filter(t => t.montant > 0);
  const totalDep = dep.reduce((s, t) => s + t.montant, 0);
  const totalRec = rec.reduce((s, t) => s + t.montant, 0);
  const solde    = +(totalDep + totalRec).toFixed(2);

  setText('k-dep',     fmt(totalDep));
  setText('k-rec',     fmt(totalRec));
  setText('k-solde',   fmt(solde));
  setText('k-periode', periodLabel(dashboardTx));
  
  const soldeEl = document.getElementById('k-solde');
  if (soldeEl) soldeEl.style.color = solde >= 0 ? 'var(--text)' : 'var(--red)'; // Neutral color for positive balance in Hero

  // Reste à vivre
  const ravBar = document.getElementById('k-rav-bar');
  if (state.DASHBOARD_PERIOD === 'current_month') {
    const monthKey = state.DASHBOARD_MONTH_KEY;
    const configuredIncome = RAV_CONFIG.revenu_mensuel_net > 0 ? RAV_CONFIG.revenu_mensuel_net : 0;
    const avgIncome = getAverageMonthlyIncome(3);
    // Fallback : revenus réels du mois courant filtrés sur les catégories retenues
    const incomeCats = getRavIncomeCategories();
    const actualFilteredIncome = dashboardTx
      .filter(t => t.montant > 0 && incomeCats.has(t.categorie))
      .reduce((s, t) => s + t.montant, 0);
    const revenuRef = configuredIncome > 0 ? configuredIncome : (avgIncome > 0 ? avgIncome : (actualFilteredIncome > 0 ? actualFilteredIncome : 3000));
    const provisions = getRecurringProvisions(monthKey);  // ≤ 0
    const reste = revenuRef + totalDep + provisions;
    const percent = Math.max(0, Math.min(100, (reste / revenuRef) * 100));

    setText('k-rav', fmt(reste));
    if (ravBar) {
      ravBar.style.width = `${percent}%`;
      ravBar.style.background = percent < 20 ? 'var(--red)' : (percent < 50 ? 'var(--amber)' : 'var(--green)');
    }
    const modeLabel = configuredIncome > 0 ? 'revenu configuré' : (avgIncome > 0 ? 'moy. 3 mois' : 'estimé');
    const provLabel = provisions < -0.01 ? ` · <span style="color:var(--amber);cursor:pointer;text-decoration:underline;text-underline-offset:2px" onclick="showRavProvisions()">${fmt(provisions)} à venir</span>` : '';
    const ravSub = document.getElementById('k-rav-sub');
    if (ravSub) ravSub.innerHTML = `<span style="cursor:pointer;text-decoration:underline;text-underline-offset:2px" onclick="showRavIncomes()">${fmt(revenuRef)} revenus (${modeLabel})</span> + <span style="cursor:pointer;text-decoration:underline;text-underline-offset:2px" onclick="showRavExpenses()">${fmt(totalDep)} dépenses</span>${provLabel}`;
  } else {
    // Hors mois courant : afficher le solde brut de la période
    setText('k-rav', fmt(solde));
    if (ravBar) { ravBar.style.width = '0%'; ravBar.style.background = 'var(--muted)'; }
    setText('k-rav-sub', 'Solde de la période sélectionnée (revenus + dépenses)');
  }

  // Opérations récentes
  const recentTxContainer = document.getElementById('recent-tx-list');
  if (recentTxContainer) {
    const recentTx = dashboardTx.slice(0, 5);
    if (recentTx.length === 0) {
      recentTxContainer.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);font-size:13px">Aucune opération récente.</div>';
    } else {
      recentTxContainer.innerHTML = recentTx.map((t, idx) => {
        const style = getCatStyle(t.categorie);
        const cleanLibelle = formatLibelle(t.libelle);
        const pos = t.montant >= 0;
        const amountColor = pos ? 'var(--green)' : 'var(--text)';
        const dateStr = t.date ? new Date(t.date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '';
        const borderBottom = idx < recentTx.length - 1 ? 'border-bottom:1px solid var(--border)' : '';

        return `
          <div style="display:flex;align-items:center;padding:12px 16px;${borderBottom};cursor:pointer" onclick="openDetailModal('${escJs(t.id)}')">
            <div style="width:36px;height:36px;border-radius:10px;background:${style.bg};color:${style.color};display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;margin-right:12px;cursor:pointer" onclick="event.stopPropagation(); openCategoryStyleModal('${escJs(t.categorie || '')}')" title="Personnaliser l'icône">
              ${style.icon}
            </div>
            <div style="flex:1;min-width:0;display:flex;flex-direction:column">
              <span style="font-weight:600;color:var(--text);font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(cleanLibelle || t.libelle)}</span>
              <span style="font-size:12px;color:var(--muted)">${esc(dateStr)} &bull; ${esc(t.categorie || '—')}</span>
            </div>
            <div style="font-weight:600;font-variant-numeric:tabular-nums;color:${amountColor};font-size:15px;margin-left:8px">
              ${fmt(t.montant)}
            </div>
          </div>
        `;
      }).join('');
    }
  }

  buildMonthlyChart(dashboardTx);
  buildCategoriesChart(dashboardTx);
  buildCumulChart(dashboardTx);
}

function normalizedDashboardCategory(value) {
  const cat = String(value || '').trim();
  return cat || 'Non catégorisé';
}

function getDashboardCategoryNames() {
  return [...new Set(state.ALL_TX.map(t => normalizedDashboardCategory(t.categorie)))]
    .sort((a, b) => a.localeCompare(b, 'fr'));
}

function loadDashboardCategorySelection() {
  try {
    const stored = localStorage.getItem(constants.DASHBOARD_CATEGORY_STORAGE_KEY);
    if (!stored) return new Set();
    const arr = JSON.parse(stored);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr);
  } catch { return new Set(); }
}

function saveDashboardCategorySelection() {
  try {
    localStorage.setItem(constants.DASHBOARD_CATEGORY_STORAGE_KEY, JSON.stringify([...state.DASHBOARD_SELECTED_CATS]));
  } catch {}
}

function syncDashboardCategories(shouldRender = true) {
  const categories = getDashboardCategoryNames();
  const signature = categories.join('||');
  if (signature === state.DASHBOARD_CATEGORY_SIGNATURE) return;

  setState('DASHBOARD_CATEGORY_SIGNATURE', signature);
  const saved = loadDashboardCategorySelection();
  // Garder uniquement les catégories qui existent encore dans les données
  setState('DASHBOARD_SELECTED_CATS', new Set([...saved].filter(c => categories.includes(c))));
  // Compatibilité historique : une sélection vide signifiait "toutes les catégories"
  if (state.DASHBOARD_SELECTED_CATS.size === 0 && categories.length) {
    setState('DASHBOARD_SELECTED_CATS', new Set(categories));
  }
  saveDashboardCategorySelection();
  if (shouldRender) renderDashboardCategoryFilters();
}

function renderDashboardCategoryFilters() {
  const container = document.getElementById('dashboard-category-list');
  if (!container) return;
  const wasOpen = !!container.querySelector('.dashboard-category-dropdown[open]');
  const categories = getDashboardCategoryNames();
  const allSelected = categories.length > 0 && state.DASHBOARD_SELECTED_CATS.size === categories.length;
  const noneSelected = state.DASHBOARD_SELECTED_CATS.size === 0;

  const allChip = `<button class="cat-chip chip-all${allSelected ? ' selected' : ''}" onclick="onDashboardCategoryAll()">Tout (${categories.length})</button>`;
  const noneChip = `<button class="cat-chip chip-all${noneSelected ? ' selected' : ''}" onclick="onDashboardCategoryNone()">Tout désélectionner</button>`;
  const chips = categories.map(cat => {
    const sel = allSelected || state.DASHBOARD_SELECTED_CATS.has(cat);
    return `<button class="cat-chip${sel ? ' selected' : ''}" onclick="onDashboardCategoryToggle('${escJs(cat)}')">${esc(cat)}</button>`;
  }).join('');

  const selectedCount = state.DASHBOARD_SELECTED_CATS.size;
  const summary = selectedCount === categories.length
    ? `Toutes les catégories (${categories.length})`
    : `${selectedCount}/${categories.length} catégories sélectionnées`;

  container.innerHTML = `
    <details class="dashboard-category-dropdown">
      <summary class="dashboard-category-summary">
        <span>${summary}</span>
        <span class="dashboard-category-count">${selectedCount}/${categories.length}</span>
      </summary>
      <div class="dashboard-category-dropdown-content">
        <div class="cat-chips">${allChip}${noneChip}${chips}</div>
      </div>
    </details>`;

  if (wasOpen) {
    const details = container.querySelector('.dashboard-category-dropdown');
    if (details) details.open = true;
  }
}

function onDashboardCategoryAll() {
  setState('DASHBOARD_SELECTED_CATS', new Set(getDashboardCategoryNames()));
  saveDashboardCategorySelection();
  renderDashboardCategoryFilters();
  renderDashboard();
}

function onDashboardCategoryNone() {
  setState('DASHBOARD_SELECTED_CATS', new Set());
  saveDashboardCategorySelection();
  renderDashboardCategoryFilters();
  renderDashboard();
}

function onDashboardCategoryToggle(cat) {
  if (state.DASHBOARD_SELECTED_CATS.has(cat)) {
    state.DASHBOARD_SELECTED_CATS.delete(cat);
  } else {
    state.DASHBOARD_SELECTED_CATS.add(cat);
  }
  saveDashboardCategorySelection();
  renderDashboardCategoryFilters();
  renderDashboard();
}

function getAssignedMonthKey(tx) {
  const assigned = String(tx?.moisAffectation || '').trim();
  if (/^\d{4}-\d{2}$/.test(assigned)) return assigned;
  return (tx?.date || '').slice(0, 7);
}

function getAssignedYear(tx) {
  return getAssignedMonthKey(tx).slice(0, 4);
}

function isPointedTransaction(tx) {
  return !!tx?.pointe;
}

function currentMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthKeyLabel(monthKey) {
  if (!monthKey) return 'Période inconnue';
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

function getDashboardRange() {
  const now = new Date();
  const currentYear = now.getFullYear();

  if (state.DASHBOARD_PERIOD === 'current_month') {
    return { mode: 'current_month', monthKey: state.DASHBOARD_MONTH_KEY, label: monthKeyLabel(state.DASHBOARD_MONTH_KEY) };
  }

  if (state.DASHBOARD_PERIOD === 'year_to_date') {
    const today = `${currentYear}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return { mode: 'year_to_date', start: `${currentYear}-01-01`, end: today, label: `Depuis le début de ${currentYear}` };
  }

  if (state.DASHBOARD_PERIOD === 'last_year') {
    const lastYear = currentYear - 1;
    return { mode: 'last_year', start: `${lastYear}-01-01`, end: `${lastYear}-12-31`, label: `Année ${lastYear}` };
  }

  if (state.DASHBOARD_PERIOD === 'custom') {
    const start = state.DASHBOARD_CUSTOM_START || null;
    const end = state.DASHBOARD_CUSTOM_END || null;
    const label = start && end ? `Du ${start} au ${end}` : 'Période personnalisée à compléter';
    return { mode: 'custom', start, end, label };
  }

  return { mode: 'all_time', label: "Tout l'historique" };
}

function periodLabel(txOverride) {
  const dashboardTx = txOverride || dashboardFilteredTransactions();
  const range = getDashboardRange();
  if (!dashboardTx.length) return `${range.label} · aucune transaction`;
  const dates = dashboardTx.map(t => t.date).sort();
  return `${range.label} · ${dates[0]} → ${dates[dates.length - 1]}`;
}

function dashboardFilteredTransactions() {
  const range = getDashboardRange();
  const byCategory = tx => state.DASHBOARD_SELECTED_CATS.has(normalizedDashboardCategory(tx.categorie));
  const byPointed = tx => isPointedTransaction(tx);

  if (range.mode === 'current_month') {
    return state.ALL_TX.filter(t => getAssignedMonthKey(t) === range.monthKey && byCategory(t) && byPointed(t));
  }

  if (range.mode === 'year_to_date' || range.mode === 'last_year') {
    return state.ALL_TX.filter(t => t.date && t.date >= range.start && t.date <= range.end && byCategory(t) && byPointed(t));
  }

  if (range.mode === 'custom') {
    if (!range.start || !range.end || range.start > range.end) return [];
    return state.ALL_TX.filter(t => t.date && t.date >= range.start && t.date <= range.end && byCategory(t) && byPointed(t));
  }

  return state.ALL_TX.filter(t => byCategory(t) && byPointed(t));
}

function updateDashboardPeriodUi() {
  const monthNav = document.getElementById('dashboard-month-nav');
  const customRange = document.getElementById('dashboard-custom-range');
  const display = document.getElementById('dashboard-period-display');
  const startInput = document.getElementById('dashboard-date-start');
  const endInput = document.getElementById('dashboard-date-end');

  if (startInput && !startInput.value) startInput.value = state.DASHBOARD_CUSTOM_START;
  if (endInput && !endInput.value) endInput.value = state.DASHBOARD_CUSTOM_END;

  if (monthNav) monthNav.style.display = state.DASHBOARD_PERIOD === 'current_month' ? 'flex' : 'none';
  if (customRange) customRange.classList.toggle('active', state.DASHBOARD_PERIOD === 'custom');

  const range = getDashboardRange();
  if (display) display.textContent = `Sélection: ${range.label}`;
}

function shiftDashboardMonth(delta) {
  const [year, month] = state.DASHBOARD_MONTH_KEY.split('-').map(Number);
  const d = new Date(year, month - 1 + delta, 1);
  setState('DASHBOARD_MONTH_KEY', currentMonthKey(d));
  if (state.DASHBOARD_PERIOD !== 'current_month') {
    setState('DASHBOARD_PERIOD', 'current_month');
    const select = document.getElementById('dashboard-period');
    if (select) select.value = 'current_month';
  }
  updateDashboardPeriodUi();
  renderDashboard();
}

function onDashboardCustomDateChange() {
  const startInput = document.getElementById('dashboard-date-start');
  const endInput = document.getElementById('dashboard-date-end');
  setState('DASHBOARD_CUSTOM_START', startInput ? startInput.value : '');
  setState('DASHBOARD_CUSTOM_END', endInput ? endInput.value : '');
  if (state.DASHBOARD_PERIOD !== 'custom') {
    setState('DASHBOARD_PERIOD', 'custom');
    const select = document.getElementById('dashboard-period');
    if (select) select.value = 'custom';
  }
  updateDashboardPeriodUi();
  renderDashboard();
}

function onDashboardPeriodChange() {
  const select = document.getElementById('dashboard-period');
  setState('DASHBOARD_PERIOD', select ? select.value : 'current_month');
  updateDashboardPeriodUi();
  renderDashboard();
}

function monthlyAggregation(transactions) {
  return aggregateMonthlyTransactions(transactions, getAssignedMonthKey, 'fr-FR');
}

let chartMonthly, chartCategories, chartCumul, chartBudget;

function buildMonthlyChart(transactions) {
  const d = monthlyAggregation(transactions);
  const ctx = document.getElementById('chart-monthly').getContext('2d');
  if (chartMonthly) chartMonthly.destroy();
  chartMonthly = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: d.labels,
      datasets: [
        { label: 'Dépenses', data: d.dep, backgroundColor: '#ef444466', borderColor: '#ef4444', borderWidth: 1.5, borderRadius: 3 },
        { label: 'Recettes', data: d.rec, backgroundColor: '#10b98166', borderColor: '#10b981', borderWidth: 1.5, borderRadius: 3 },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 12 } } } },
      scales: { y: { ticks: { callback: v => fmt(v) } } },
      onClick: (evt, elements) => {
        if (!elements.length) return;
        const idx = elements[0].index;
        const monthKey = d.keys[idx];
        const dsIdx = elements[0].datasetIndex;
        const txs = dashboardFilteredTransactions().filter(t => getAssignedMonthKey(t) === monthKey);
        const subset = dsIdx === 0 ? txs.filter(t => t.montant < 0) : txs.filter(t => t.montant > 0);
        const label = dsIdx === 0 ? 'Dépenses' : 'Recettes';
        openChartPopup(subset, `${d.labels[idx]} — ${label}`);
      },
    },
  });
}

function buildCategoriesChart(transactions) {
  const depTx = transactions.filter(t => t.montant < 0);
  const map = {};
  depTx.forEach(t => {
    const cat = t.categorie || 'Non catégorisé';
    map[cat] = (map[cat] || 0) + Math.abs(t.montant);
  });
  const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
  const TOP = 9;
  const top = sorted.slice(0, TOP);
  const rest = sorted.slice(TOP);
  if (rest.length > 0) {
    const restTotal = rest.reduce((s, [, v]) => s + v, 0);
    top.push(['Autres (' + rest.length + ')', restTotal]);
  }
  const labels = top.map(([k]) => k);
  const values = top.map(([, v]) => +v.toFixed(2));
  const restCatNames = new Set(rest.map(([k]) => k));
  const COLORS = ['#7c3aed','#d97706','#3b82f6','#10b981','#ef4444','#f59e0b','#06b6d4','#8b5cf6','#ec4899','#6b7280'];
  const ctx = document.getElementById('chart-categories').getContext('2d');
  if (chartCategories) chartCategories.destroy();
  chartCategories = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: COLORS.slice(0, labels.length),
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 12 } } },
        tooltip: { callbacks: { label: c => ` ${fmt(c.raw)}` } },
      },
      onClick: (evt, elements) => {
        if (!elements.length) return;
        const idx = elements[0].index;
        const cat = labels[idx];
        let subset;
        if (idx === TOP) {
          subset = dashboardFilteredTransactions().filter(t => t.montant < 0 && restCatNames.has(t.categorie || 'Non catégorisé'));
          openChartPopup(subset, 'Autres catégories');
        } else {
          subset = dashboardFilteredTransactions().filter(t => t.montant < 0 && (t.categorie || 'Non catégorisé') === cat);
          openChartPopup(subset, cat);
        }
      },
    },
  });
}

function buildCumulChart(transactions) {
  const d = monthlyAggregation(transactions);
  const ctx = document.getElementById('chart-cumul').getContext('2d');
  if (chartCumul) chartCumul.destroy();
  chartCumul = new Chart(ctx, {
    type: 'line',
    data: {
      labels: d.labels,
      datasets: [{
        label: 'Solde cumulé',
        data: d.soldes,
        borderColor: '#3b82f6',
        backgroundColor: '#3b82f615',
        fill: true, tension: .35, pointRadius: 4, borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => ` ${fmt(c.raw)}` } },
      },
      scales: { y: { ticks: { callback: v => fmt(v) } } },
      onClick: (evt, elements) => {
        if (!elements.length) return;
        const idx = elements[0].index;
        const monthKey = d.keys[idx];
        const txs = dashboardFilteredTransactions().filter(t => getAssignedMonthKey(t) === monthKey);
        openChartPopup(txs, `${d.labels[idx]} — Toutes transactions`);
      },
    },
  });
}

function applyDefaultMonthFilter() {
  const now = new Date();
  const currentYear = String(now.getFullYear());
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');

  const yearSel = document.getElementById('f-year');
  const monthSel = document.getElementById('f-month');
  if (yearSel && [...yearSel.options].some(o => o.value === currentYear)) {
    yearSel.value = currentYear;
  }
  if (monthSel) monthSel.value = currentMonth;

  const fsYear = document.getElementById('fs-year');
  const fsMonth = document.getElementById('fs-month');
  if (fsYear && [...fsYear.options].some(o => o.value === currentYear)) {
    fsYear.value = currentYear;
  }
  if (fsMonth) fsMonth.value = currentMonth;

  updateFilterBadge();
}

function resetFilters() {
  const ids = [
    'f-search',
    'f-search-m',
    'f-compte',
    'f-type',
    'f-year',
    'f-month',
    'f-pointe',
    'f-categorie',
    'fs-compte',
    'fs-type',
    'fs-year',
    'fs-month',
    'fs-pointe',
    'fs-categorie',
  ];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  applyDefaultMonthFilter();
  applyFilters();
}

// ── Table / Filters ───────────────────────────────────────────────────────────
// ── Chart Popup ───────────────────────────────────────────────────────────────
function openChartPopup(transactions, title) {
  document.getElementById('chart-popup-title').textContent = title;
  const head = document.getElementById('chart-popup-head');
  if (head) {
    head.innerHTML = `
      <tr>
        <th style="white-space:nowrap">Date</th>
        <th>Libellé</th>
        <th>Compte</th>
        <th style="text-align:right">Montant</th>
        <th>Catégorie</th>
      </tr>`;
  }

  const dep = transactions.filter(t => t.montant < 0).reduce((s, t) => s + t.montant, 0);
  const rec = transactions.filter(t => t.montant > 0).reduce((s, t) => s + t.montant, 0);
  const summaryEl = document.getElementById('chart-popup-summary');
  summaryEl.innerHTML = [
    dep < 0 ? `<span class="summary-chip chip-red">${fmt(dep)} dépenses</span>` : '',
    rec > 0 ? `<span class="summary-chip chip-green">+${fmt(rec)} recettes</span>` : '',
    `<span class="summary-chip chip-blue">${transactions.length} transaction(s)</span>`,
  ].join('');

  const sorted = [...transactions].sort((a, b) => b.date.localeCompare(a.date));
  document.getElementById('chart-popup-list').innerHTML = sorted.map(t => {
    const pos = t.montant >= 0;
    const badgeCls = t.compte === 'BforBank' ? 'badge-bfor' : 'badge-lcl';
    const cat = t.categorie || '';
    const isMock = String(t.id).startsWith('mock_');
    const rowCls = isMock ? '' : 'chart-popup-row-editable';
    const clickAttr = isMock ? '' : `onclick="openDetailFromChartPopup('${escJs(t.id)}')" title="Modifier cette transaction"`;
    return `<tr class="${rowCls}" ${clickAttr}>
      <td style="white-space:nowrap">${esc(t.date)}</td>
      <td style="max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${esc(t.libelle)}">${esc(t.libelle)}</td>
      <td><span class="badge ${badgeCls}">${esc(t.compte)}</span></td>
      <td style="text-align:right;font-weight:600;white-space:nowrap;color:${pos ? 'var(--green)' : 'var(--red)'}">${fmt(t.montant)}</td>
      <td><span class="badge-cat ${cat ? '' : 'empty'}">${esc(cat || '—')}</span></td>
    </tr>`;
  }).join('');

  document.getElementById('modal-chart-popup').classList.add('open');
}

function openBudgetOverrunPopup(rows, title) {
  document.getElementById('chart-popup-title').textContent = title;

  const totalBudget = rows.reduce((sum, r) => sum + r.budget, 0);
  const totalActual = rows.reduce((sum, r) => sum + r.actual, 0);
  const totalGap = rows.reduce((sum, r) => sum + Math.abs(Math.min(0, r.diff || 0)), 0);
  const summaryEl = document.getElementById('chart-popup-summary');
  summaryEl.innerHTML = [
    `<span class="summary-chip chip-blue">${rows.length} catégorie(s)</span>`,
    `<span class="summary-chip">${fmt(totalBudget)} budget total</span>`,
    `<span class="summary-chip chip-red">${fmt(totalActual)} réalisé</span>`,
    `<span class="summary-chip chip-red">${fmt(totalGap)} écart défavorable cumulé</span>`,
  ].join('');

  const head = document.getElementById('chart-popup-head');
  if (head) {
    head.innerHTML = `
      <tr>
        <th>Catégorie</th>
        <th style="text-align:right">Budget</th>
        <th style="text-align:right">Réel</th>
        <th style="text-align:right">Alerte</th>
      </tr>`;
  }

  const sorted = [...rows].sort((a, b) => Math.abs(b.diff || 0) - Math.abs(a.diff || 0));
  document.getElementById('chart-popup-list').innerHTML = sorted.map(r => {
    const gap = Math.abs(Math.min(0, r.diff || 0));
    const signedActual = budgetSignedActual(r);
    const actualColor = budgetAmountColor(signedActual);
    const alertLabel = r.kind === 'income' ? `${fmt(gap)} manquant` : `${fmt(gap)} dépassé`;
    return `<tr>
      <td><span class="badge-cat">${esc(r.cat || 'A Catégoriser')}</span></td>
      <td style="text-align:right;font-variant-numeric:tabular-nums">${fmt(r.budget)}</td>
      <td style="text-align:right;font-variant-numeric:tabular-nums;color:${actualColor}">${fmt(signedActual)}</td>
      <td style="text-align:right;font-weight:700;color:var(--red);font-variant-numeric:tabular-nums">${alertLabel}</td>
    </tr>`;
  }).join('');

  document.getElementById('modal-chart-popup').classList.add('open');
}


function openDetailFromChartPopup(id) {
  closeChartPopup();
  openDetailModal(id);
}

function closeChartPopup() {
  document.getElementById('modal-chart-popup').classList.remove('open');
}

// ── Budget (extrait vers src/budget.js)

async function loadLinxoMappings(options = {}) {
  const { throwOnError = false, forceRefresh = false } = options;
  try {
    if (!forceRefresh) {
      const cached = FSCache.get('linxo_mappings');
      if (cached) {
        setState('LINXO_MAPPINGS', cached);
        renderMappings();
        return state.LINXO_MAPPINGS;
      }
    }
    const snap = await collectionRef(state.db, 'linxo_category_mappings').get();
    setState('LINXO_MAPPINGS', snap.docs.map(d => ({ id: d.id, ...d.data() })));
    FSCache.set('linxo_mappings', state.LINXO_MAPPINGS);
    renderMappings();
    return state.LINXO_MAPPINGS;
  } catch (err) {
    console.warn('Chargement mappings Linxo:', err.message);
    setState('LINXO_MAPPINGS', []);
    renderMappings();
    if (throwOnError) throw err;
    return [];
  }
}

function mappingBudgetOptions(selected) {
  const unique = getBudgetCategoryCandidates_();
  const options = ['<option value="">(non mappé)</option>']
    .concat(unique.map(cat => `<option value="${esc(cat)}" ${cat === selected ? 'selected' : ''}>${esc(cat)}</option>`));
  return options.join('');
}


function collectLinxoCategoriesFromHistory_() {
  const out = new Set();

  for (const m of state.LINXO_MAPPINGS) {
    const cat = String(m?.linxoCategory || '').trim();
    if (cat) out.add(cat);
  }

  for (const tx of state.ALL_TX) {
    const comment = String(tx?.commentaire || '');

    const mLinxo = comment.match(/Catégorie Linxo\s+"([^"]+)"/i);
    if (mLinxo && mLinxo[1]) out.add(mLinxo[1].trim());

    const mProposed = comment.match(/Catégorie proposée:\s*"([^"]+)"/i);
    if (mProposed && mProposed[1]) {
      const val = mProposed[1].trim();
      if (val && val !== '(vide)') out.add(val);
    }
  }

  return [...out].sort((a, b) => a.localeCompare(b, 'fr'));
}

function renderMappings() {
  const tbody = document.getElementById('mappings-tbody');
  if (!tbody) return;

  const rows = state.LINXO_MAPPINGS.slice().sort((a, b) =>
    String(a.linxoCategory || '').localeCompare(String(b.linxoCategory || ''), 'fr')
  );

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="3" style="color:var(--muted)">Aucun mapping pour le moment.</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map(r => {
    const linxo = r.linxoCategory || '';
    const budget = r.budgetCategory || '';
    return `<tr>
      <td><input class="mapping-input" type="text" value="${esc(linxo)}" placeholder="Ex: Alimentation" onchange="updateMappingField('${esc(r.id)}', 'linxoCategory', this.value)" /></td>
      <td>
        <select class="mapping-input" onchange="updateMappingField('${esc(r.id)}', 'budgetCategory', this.value)">
          ${mappingBudgetOptions(budget)}
        </select>
      </td>
      <td>
        <button class="btn-icon danger" title="Supprimer" onclick="deleteMapping('${escJs(r.id)}')">✕</button>
      </td>
    </tr>`;
  }).join('');
}

async function updateMappingField(id, field, value) {
  const docRef = collectionRef(state.db, 'linxo_category_mappings').doc(id);
  const trimmed = String(value || '').trim();

  if (field === 'linxoCategory') {
    if (!trimmed) {
      toast('La catégorie Linxo ne peut pas être vide.', 'error');
      await loadLinxoMappings();
      return;
    }

    const current = state.LINXO_MAPPINGS.find(m => m.id === id);
    const currentLinxo = String(current?.linxoCategory || '').trim();
    if (trimmed === currentLinxo) return;

    try {
      await state.db.runTransaction(async trx => {
        const source = await trx.get(docRef);
        if (!source.exists) throw new Error('Mapping introuvable');
        const newId = trimmed.replace(/\//g, '_').slice(0, 140);
        const payload = {
          ...source.data(),
          linxoCategory: trimmed,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        };
        trx.set(collectionRef(state.db, 'linxo_category_mappings').doc(newId), payload, { merge: true });
        if (newId !== id) trx.delete(docRef);
      });
      FSCache.invalidate('linxo_mappings');
      toast('Mapping mis à jour', 'success');
      await loadLinxoMappings({ forceRefresh: true });
    } catch (err) {
      FSCache.invalidate('linxo_mappings');
      toast('Erreur : ' + err.message, 'error');
      await loadLinxoMappings({ forceRefresh: true });
    }
    return;
  }

  try {
    await docRef.set({
      budgetCategory: trimmed,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    const row = state.LINXO_MAPPINGS.find(m => m.id === id);
    if (row) row.budgetCategory = trimmed;
    FSCache.invalidate('linxo_mappings');
    toast('Mapping mis à jour', 'success');
  } catch (err) {
    FSCache.invalidate('linxo_mappings');
    toast('Erreur : ' + err.message, 'error');
    await loadLinxoMappings({ forceRefresh: true });
  }
}

async function addMappingRow() {
  if (!state.db) return;
  const base = 'nouvelle_categorie';
  let i = 1;
  let candidate = base;
  const ids = new Set(state.LINXO_MAPPINGS.map(m => m.id));
  while (ids.has(candidate)) {
    i += 1;
    candidate = `${base}_${i}`;
  }

  try {
    await collectionRef(state.db, 'linxo_category_mappings').doc(candidate).set({
      linxoCategory: candidate,
      budgetCategory: '',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    FSCache.invalidate('linxo_mappings');
    await loadLinxoMappings({ forceRefresh: true });
    toast('Nouveau mapping créé', 'success');
  } catch (err) {
    toast('Erreur : ' + err.message, 'error');
  }
}

async function seedMappingsFromHistory() {
  if (!state.db) return;

  const categories = collectLinxoCategoriesFromHistory_();
  if (!categories.length) {
    toast('Aucune catégorie Linxo trouvée dans l\'historique.', 'error');
    return;
  }

  const existing = new Set(
    state.LINXO_MAPPINGS
      .map(m => String(m?.linxoCategory || '').trim())
      .filter(Boolean)
  );
  const toCreate = categories.filter(cat => !existing.has(cat));
  if (!toCreate.length) {
    toast('Toutes les catégories détectées existent déjà dans les mappings.', 'success');
    return;
  }

  try {
    const col = collectionRef(state.db, 'linxo_category_mappings');
    const CHUNK_SIZE = 400;

    for (let i = 0; i < toCreate.length; i += CHUNK_SIZE) {
      const chunk = toCreate.slice(i, i + CHUNK_SIZE);
      const batch = createBatch(state.db);
      const now = firebase.firestore.FieldValue.serverTimestamp();

      chunk.forEach(cat => {
        const docId = cat.replace(/\//g, '_').slice(0, 140);
        batch.set(col.doc(docId), {
          linxoCategory: cat,
          budgetCategory: '',
          updatedAt: now,
        }, { merge: true });
      });

      await batch.commit();
    }

    FSCache.invalidate('linxo_mappings');
    const refreshed = await loadLinxoMappings({ throwOnError: true, forceRefresh: true });
    const refreshedSet = new Set(refreshed.map(m => String(m?.linxoCategory || '').trim()).filter(Boolean));
    const confirmed = toCreate.filter(cat => refreshedSet.has(cat));
    const missing = toCreate.length - confirmed.length;

    if (confirmed.length === 0) {
      toast('Aucun mapping n\'a pu être confirmé après écriture. Vérifie les règles Firestore.', 'error');
      return;
    }

    if (missing > 0) {
      toast(`${confirmed.length}/${toCreate.length} catégorie(s) importée(s). Vérifie les règles Firestore pour le reste.`, 'error');
      return;
    }

    toast(`${confirmed.length} catégorie(s) Linxo importée(s) dans les mappings.`, 'success');
  } catch (err) {
    toast('Erreur : ' + err.message, 'error');
  }
}

async function deleteMapping(id) {
  if (!id) return;
  if (!confirm('Supprimer ce mapping ?')) return;
  try {
    await collectionRef(state.db, 'linxo_category_mappings').doc(id).delete();
    setState('LINXO_MAPPINGS', state.LINXO_MAPPINGS.filter(m => m.id !== id));
    FSCache.invalidate('linxo_mappings');
    renderMappings();
    toast('Mapping supprimé', 'success');
  } catch (err) {
    toast('Erreur : ' + err.message, 'error');
  }
}

// ── Reparse Gmail (piloté depuis Firebase) ─────────────────────────────────
async function loadReparseData() {
  if (!state.db) return;
  try {
    const [msgSnap, jobSnap] = await Promise.all([
      collectionRef(state.db, 'gmail_messages').orderBy('receivedAt', 'desc').limit(200).get(),
      collectionRef(state.db, 'reparse_jobs').orderBy('requestedAt', 'desc').limit(100).get(),
    ]);
    setState('GMAIL_MESSAGES', msgSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setState('REPARSE_JOBS', jobSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    renderReparseEmails();
    renderReparseJobs();
    renderFullScanProgress();
  } catch (err) {
    console.warn('Chargement reparse:', err.message);
    toast('Reparse Gmail indisponible: ' + err.message, 'error');
  }
}

function renderReparseEmails() {
  const tbody = document.getElementById('reparse-emails-tbody');
  if (!tbody) return;
  if (!state.GMAIL_MESSAGES.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="color:var(--muted);padding:16px">Aucun email Linxo listé (attends le prochain import automatique).</td></tr>';
    return;
  }
  const excludedIds = new Set(state.EXCLUDED_EMAILS.map(e => e.id));
  tbody.innerHTML = state.GMAIL_MESSAGES.map(m => {
    const d = toDate(m.receivedAt);
    const dateTxt = d ? d.toLocaleString('fr-FR') : 'date inconnue';
    const subj = esc(m.subject || '(sans objet)');
    const status = m.lastStatus || '—';
    const statusCls = status === 'IMPORTED' ? 'status-ok' : 'status-warn';
    const isExcluded = excludedIds.has(m.id);
    const rowStyle = isExcluded ? 'opacity:.5' : '';
    const exclBtn = isExcluded
      ? `<button class="btn" style="font-size:12px;padding:5px 10px" onclick="removeExcludedEmail('${escJs(m.id)}')">Réintégrer</button>`
      : `<button class="btn" style="font-size:12px;padding:5px 10px;color:var(--muted)" onclick="addExcludedEmail('${escJs(m.id)}','${escJs(m.subject||'')}')">Exclure</button>`;
    return `<tr style="${rowStyle}">
      <td style="white-space:nowrap">${dateTxt}</td>
      <td title="${subj}" style="max-width:280px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${subj}${isExcluded ? ' <span style="font-size:11px;color:var(--muted)">(exclu)</span>' : ''}</td>
      <td><span class="${statusCls}" style="font-size:12px;font-weight:600">${esc(status)}</span></td>
      <td style="display:flex;gap:6px;flex-wrap:wrap">
        ${isExcluded ? '' : `<button class="btn-primary" style="font-size:12px;padding:5px 10px" onclick="submitReparseJob('${escJs(m.id)}')">Reparser</button>`}
        ${exclBtn}
      </td>
    </tr>`;
  }).join('');
}


function renderFullScanProgress() {
  const box = document.getElementById('full-scan-progress');
  if (!box) return;

  const fullScanJob = state.REPARSE_JOBS.find(j => (j.messageId || j.id) === 'full_scan_request');
  if (!fullScanJob) {
    box.style.display = 'none';
    if (state.FULL_SCAN_PROGRESS_INTERVAL) {
      clearInterval(state.FULL_SCAN_PROGRESS_INTERVAL);
      setState('FULL_SCAN_PROGRESS_INTERVAL', null);
    }
    return;
  }

  const statusRaw = String(fullScanJob.status || '').toLowerCase();
  const status = statusRaw || 'requested';
  const pct = Math.max(0, Math.min(100, Number(fullScanJob.progressPct ?? (status === 'done' ? 100 : 10))));
  const stage = fullScanJob.stage || (status === 'processing' ? 'Traitement en cours' : status === 'done' ? 'Terminé' : status === 'failed' ? 'Bloqué' : 'En attente');
  const message = fullScanJob.resultMessage || 'Demande enregistrée, en attente du prochain run.';
  const blocker = fullScanJob.blockingIssue || (status === 'failed' ? message : '');

  const barColor = status === 'failed' ? '#ef4444' : status === 'done' ? '#10b981' : '#3b82f6';
  const statusLabel = status === 'requested' ? 'En attente' : status === 'processing' ? 'Exécution' : status === 'done' ? 'Terminé' : status === 'failed' ? 'Bloqué' : status;

  box.style.display = 'block';
  box.innerHTML = `
    <div class="scan-progress-head">
      <span class="scan-progress-step">Scan complet Gmail · ${esc(statusLabel)} · ${esc(String(stage))}</span>
      <span class="scan-progress-pct">${Math.round(pct)}%</span>
    </div>
    <div class="progress-bar-wrap" style="margin-top:8px">
      <div class="progress-bar-fill" style="width:${pct}%;background:${barColor}"></div>
    </div>
    <div class="scan-progress-msg">${esc(message)}</div>
    ${blocker ? `<div class="scan-progress-blocker">Point bloquant: ${esc(blocker)}</div>` : ''}
  `;

  const shouldPoll = status === 'requested' || status === 'processing';
  if (shouldPoll && !state.FULL_SCAN_PROGRESS_INTERVAL) {
    // Polling léger : on lit seulement le doc sentinelle (1 lecture) au lieu
    // de loadReparseData() qui charge 300 docs à chaque fois.
    setState('FULL_SCAN_PROGRESS_INTERVAL', setInterval(async () => {
      try {
        const snap = await collectionRef(state.db, 'reparse_jobs').doc('full_scan_request').get();
        if (!snap.exists) {
          clearInterval(state.FULL_SCAN_PROGRESS_INTERVAL);
          setState('FULL_SCAN_PROGRESS_INTERVAL', null);
          return;
        }
        const data = snap.data() || {};
        const statusNow = String(data.status || '').toLowerCase();
        // Mettre à jour le job sentinelle dans le cache local et re-rendre
        const idx = state.REPARSE_JOBS.findIndex(j => (j.messageId || j.id) === 'full_scan_request');
        const updated = { id: snap.id, ...data };
        if (idx >= 0) state.REPARSE_JOBS[idx] = updated;
        else state.REPARSE_JOBS.unshift(updated);
        renderFullScanProgress();
        renderReparseJobs();
        // Quand le scan est terminé, recharger tout pour mettre à jour les statuts des emails
        if (statusNow !== 'requested' && statusNow !== 'processing') {
          clearInterval(state.FULL_SCAN_PROGRESS_INTERVAL);
          setState('FULL_SCAN_PROGRESS_INTERVAL', null);
          await loadReparseData();
        }
      } catch (e) {
        console.warn('Polling full_scan_request:', e.message);
      }
    }, 15000));
  } else if (!shouldPoll && state.FULL_SCAN_PROGRESS_INTERVAL) {
    clearInterval(state.FULL_SCAN_PROGRESS_INTERVAL);
    setState('FULL_SCAN_PROGRESS_INTERVAL', null);
  }
}

function renderReparseJobs() {
  const tbody = document.getElementById('reparse-jobs-tbody');
  if (!tbody) return;
  if (!state.REPARSE_JOBS.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="color:var(--muted)">Aucune demande pour le moment.</td></tr>';
    return;
  }
  tbody.innerHTML = state.REPARSE_JOBS.map(j => {
    const req = toDate(j.requestedAt);
    const reqTxt = req ? req.toLocaleString('fr-FR') : '—';
    const status = esc(j.status || 'requested');
    const result = esc(j.resultMessage || '—');
    const subj = esc(j.subject || '—');
    return `<tr>
      <td>${reqTxt}</td>
      <td style="font-family:monospace;font-size:11px">${esc(j.messageId || j.id)}</td>
      <td>${subj}</td>
      <td><span class="badge-src">${status}</span></td>
      <td style="max-width:420px;white-space:normal">${result}</td>
    </tr>`;
  }).join('');
}

async function submitReparseJob(messageId) {
  if (!messageId) {
    toast('Aucun email sélectionné', 'error');
    return;
  }
  const chosen = state.GMAIL_MESSAGES.find(m => m.id === messageId) || {};
  try {
    await collectionRef(state.db, 'reparse_jobs').doc(messageId).set({
      messageId,
      subject: chosen.subject || '',
      status: 'requested',
      requestedBy: firebase.auth().currentUser?.email || '',
      requestedAt: firebase.firestore.FieldValue.serverTimestamp(),
      resultMessage: '',
      processedAt: null,
    }, { merge: true });
    toast('Demande de reparse envoyée ✅', 'success');
    await loadReparseData();
  } catch (err) {
    toast('Erreur envoi demande: ' + err.message, 'error');
  }
}

// ── Emails exclus (collection gmail_excluded) ──────────────────────────────
async function loadExcludedEmails() {
  if (!state.db) return;
  try {
    const snap = await collectionRef(state.db, 'gmail_excluded').get();
    setState('EXCLUDED_EMAILS', snap.docs.map(d => ({ id: d.id, ...d.data() })));
    renderExcludedEmails();
    renderReparseEmails(); // Mettre à jour les boutons dans la liste reparse
  } catch (err) {
    console.warn('Chargement emails exclus:', err.message);
  }
}

function renderExcludedEmails() {
  const tbody = document.getElementById('excluded-emails-tbody');
  if (!tbody) return;
  if (!state.EXCLUDED_EMAILS.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="color:var(--muted);padding:16px">Aucun email exclu pour le moment.</td></tr>';
    return;
  }
  tbody.innerHTML = state.EXCLUDED_EMAILS.map(e => {
    const d = toDate(e.excludedAt);
    const dateTxt = d ? d.toLocaleString('fr-FR') : '—';
    const subj = esc(e.subject || '—');
    return `<tr>
      <td style="font-family:monospace;font-size:11px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(e.id)}">${esc(e.id)}</td>
      <td style="max-width:280px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${subj}">${subj}</td>
      <td style="white-space:nowrap">${dateTxt}</td>
      <td>
        <button class="btn" style="font-size:12px;padding:5px 10px;color:var(--muted)"
                onclick="removeExcludedEmail('${escJs(e.id)}')">Retirer</button>
      </td>
    </tr>`;
  }).join('');
}

async function addExcludedEmail(messageId, subject) {
  if (!state.db || !messageId) return;
  try {
    await collectionRef(state.db, 'gmail_excluded').doc(messageId).set({
      messageId,
      subject: subject || '',
      excludedAt: firebase.firestore.FieldValue.serverTimestamp(),
      excludedBy: firebase.auth().currentUser?.email || '',
    });
    toast('Email exclu des prochains imports ✅', 'success');
    await loadExcludedEmails();
  } catch (err) {
    toast('Erreur exclusion: ' + err.message, 'error');
  }
}

async function addExcludedEmailManual() {
  const idInput = document.getElementById('excl-manual-id');
  const subjInput = document.getElementById('excl-manual-subj');
  const messageId = (idInput?.value || '').trim();
  if (!messageId) { toast('Saisis un ID d\'email valide', 'error'); return; }
  await addExcludedEmail(messageId, subjInput?.value?.trim() || '');
  if (idInput) idInput.value = '';
  if (subjInput) subjInput.value = '';
}

async function removeExcludedEmail(messageId) {
  if (!state.db || !messageId) return;
  try {
    await collectionRef(state.db, 'gmail_excluded').doc(messageId).delete();
    toast('Email réintégré dans les imports ✅', 'success');
    await loadExcludedEmails();
  } catch (err) {
    toast('Erreur: ' + err.message, 'error');
  }
}

// ── Fusion catégories ──────────────────────────────────────────────────────────
// fusionAssignments : { 'Supermarché': 'Courses', ... }  (source → cible, en mémoire)
// L'application écrit définitivement dans Firestore.
let fusionAssignments = {};
let _fusionLoaded = false;

function _allKnownCategories() {
  return getAllKnownBudgetCategories();
}

function renderFusionTable() {
  const allCats = _allKnownCategories();
  const tbody = document.getElementById('fusion-tbody');
  if (!tbody) return;

  // Compter les transactions par catégorie
  const txCount = {};
  state.ALL_TX.forEach(t => {
    const cat = t.categorie || 'A Catégoriser';
    txCount[cat] = (txCount[cat] || 0) + 1;
  });

  // Options du select : toutes les catégories + case "garder tel quel"
  const optionsFor = (currentCat) => {
    const assigned = fusionAssignments[currentCat] || currentCat;
    return `<option value="${escJs(currentCat)}" ${assigned === currentCat ? 'selected' : ''}>— Garder tel quel —</option>
      <option disabled>──────────────────</option>` +
      allCats.filter(c => c !== currentCat).map(c =>
        `<option value="${escJs(c)}" ${assigned === c ? 'selected' : ''}>${esc(c)}</option>`
      ).join('');
  };

  tbody.innerHTML = allCats.map(cat => {
    const isChanged = fusionAssignments[cat] && fusionAssignments[cat] !== cat;
    const count = txCount[cat] || 0;
    return `<tr id="fusion-row-${CSS.escape(cat)}" style="${isChanged ? 'background:var(--primary-l)' : ''}">
      <td>
        <div style="display:flex;align-items:center;gap:6px;">
          <span class="badge-cat ${count === 0 ? 'empty' : ''}">${esc(cat)}</span>
          <button class="btn-icon" style="padding:2px 5px; font-size:11px; margin:0;" onclick="openCategoryStyleModal('${escJs(cat)}')" title="Personnaliser l'icône et la couleur">🎨</button>
        </div>
      </td>
      <td style="text-align:center;color:var(--muted);font-size:13px">${count}</td>
      <td>
        <select style="width:100%;max-width:260px;padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-size:13px;background:var(--card);color:var(--fg)"
                onchange="setFusionAssignment('${escJs(cat)}', this.value)">
          ${optionsFor(cat)}
        </select>
      </td>
    </tr>`;
  }).join('') || '<tr><td colspan="3" style="text-align:center;color:var(--muted);padding:24px">Aucune catégorie trouvée</td></tr>';

  _updateFusionUI();
}

function setFusionAssignment(src, tgt) {
  if (tgt === src) {
    delete fusionAssignments[src];
  } else {
    fusionAssignments[src] = tgt;
  }
  // Surligner la ligne
  const row = document.getElementById(`fusion-row-${CSS.escape(src)}`);
  if (row) row.style.background = fusionAssignments[src] ? 'var(--primary-l)' : '';
  _updateFusionUI();
}

function _updateFusionUI() {
  const renames = Object.entries(fusionAssignments).filter(([s, t]) => s !== t);
  const btn = document.getElementById('fusion-apply-btn');
  const warning = document.getElementById('fusion-warning');
  const summary = document.getElementById('fusion-summary');

  if (btn) btn.disabled = renames.length === 0;
  if (warning) warning.style.display = renames.length > 0 ? '' : 'none';

  if (summary) {
    if (renames.length === 0) {
      summary.style.display = 'none';
    } else {
      summary.style.display = '';
      summary.innerHTML = `<strong>${renames.length} fusion(s) en attente :</strong><br>` +
        renames.map(([s, t]) => `&nbsp;• <strong>${esc(s)}</strong> → <strong>${esc(t)}</strong>`).join('<br>');
    }
  }
}

async function applyFusions() {
  const renames = Object.entries(fusionAssignments).filter(([s, t]) => s !== t);
  if (!renames.length) return;

  const confirmMsg = `Appliquer ${renames.length} fusion(s) ?\n\n` +
    renames.map(([s, t]) => `• ${s}  →  ${t}`).join('\n') +
    '\n\nCette opération est irréversible.';
  if (!confirm(confirmMsg)) return;

  const applyBtn = document.getElementById('fusion-apply-btn');
  if (applyBtn) { applyBtn.disabled = true; applyBtn.textContent = 'Application en cours…'; }

  try {
    for (const [src, tgt] of renames) {
      // 1. Transactions : mise à jour par batch de 400
      const txSnap = await collectionRef(state.db, 'transactions').where('categorie', '==', src).get();
      if (!txSnap.empty) {
        const chunks = [];
        for (let i = 0; i < txSnap.docs.length; i += 400) chunks.push(txSnap.docs.slice(i, i + 400));
        for (const chunk of chunks) {
          const batch = createBatch(state.db);
          chunk.forEach(doc => batch.update(doc.ref, { categorie: tgt }));
          await batch.commit();
        }
      }

      // 2. budgets (doc ID = clé de catégorie)
      const srcKey = budgetDocCategoryKey(src);
      const tgtKey = budgetDocCategoryKey(tgt);
      const srcBudgetDoc = await collectionRef(state.db, 'budgets').doc(srcKey).get();
      if (srcBudgetDoc.exists) {
        const tgtBudgetDoc = await collectionRef(state.db, 'budgets').doc(tgtKey).get();
        if (!tgtBudgetDoc.exists) {
          // Transférer le budget vers la cible si elle n'en a pas
          await collectionRef(state.db, 'budgets').doc(tgtKey).set(srcBudgetDoc.data());
        }
        await collectionRef(state.db, 'budgets').doc(srcKey).delete();
      }

      // 3. budgets_monthly : supprimer les entrées sources
      const monthlySnap = await collectionRef(state.db, 'budgets_monthly').where('categorie', '==', src).get();
      if (!monthlySnap.empty) {
        const batch = createBatch(state.db);
        monthlySnap.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      }

      // 4. budgets_annual_defaults : supprimer les entrées sources
      const annualSnap = await collectionRef(state.db, 'budgets_annual_defaults').where('categorie', '==', src).get();
      if (!annualSnap.empty) {
        const batch = createBatch(state.db);
        annualSnap.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      }

      // 5. linxo_category_mappings
      const mappingSnap = await collectionRef(state.db, 'linxo_category_mappings').where('budgetCategory', '==', src).get();
      if (!mappingSnap.empty) {
        const batch = createBatch(state.db);
        mappingSnap.docs.forEach(doc => batch.update(doc.ref, { budgetCategory: tgt }));
        await batch.commit();
      }
    }

    toast(`${renames.length} fusion(s) appliquée(s) avec succès.`, 'success');
    fusionAssignments = {};

    // Recharger les données complètes (fusion modifie transactions + budgets + mappings)
    FSCache.invalidateAll();
    await loadTransactions();
    renderDashboard();
    renderBudget();
    renderFusionTable();
  } catch (err) {
    toast('Erreur lors de l\'application : ' + err.message, 'error');
    console.error(err);
  } finally {
    if (applyBtn) { applyBtn.disabled = false; applyBtn.textContent = 'Appliquer les fusions'; }
  }
}

async function loadFusions() {
  renderFusionTable();
}

// ── Personnalisation du style des catégories ──

async function loadCategoryStyles() {
  try {
    const cached = FSCache.get('category_styles');
    if (cached) {
      setState('CATEGORY_STYLES', cached);
      return;
    }
    const snap = await collectionRef(state.db, 'category_styles').get();
    const styles = {};
    snap.docs.forEach(doc => {
        const data = doc.data();
        if (data.category) styles[data.category] = data;
    });
    setState('CATEGORY_STYLES', styles);
    FSCache.set('category_styles', styles);
  } catch(err) {
    console.warn('Erreur loadCategoryStyles:', err);
    setState('CATEGORY_STYLES', {});
  }
}

let currentStyleCat = null;
let tempStyleIcon = null;
let tempStyleColor = null;

function openCategoryStyleModal(cat) {
  currentStyleCat = cat;
  document.getElementById('style-cat-name').textContent = cat;
  
  const custom = state.CATEGORY_STYLES[cat];
  if (custom) {
    tempStyleIcon = custom.icon || 'file';
    tempStyleColor = custom.color || 'gray';
  } else {
    tempStyleIcon = 'file';
    tempStyleColor = 'gray';
  }

  renderStyleGrids();
  document.getElementById('modal-category-style').classList.add('open');
}

async function searchOnlineIcons() {
  const query = document.getElementById('icon-search-input')?.value.trim();
  const resultsDiv = document.getElementById('icon-search-results');
  if (!resultsDiv) return;
  
  if (!query) {
    resultsDiv.innerHTML = '';
    return;
  }
  
  resultsDiv.innerHTML = '<span style="color:var(--muted);font-size:13px;">Recherche en cours...</span>';
  
  try {
    const res = await fetch(`https://api.iconify.design/search?query=${encodeURIComponent(query)}&limit=36`);
    const data = await res.json();
    
    if (!data.icons || data.icons.length === 0) {
      resultsDiv.innerHTML = '<span style="color:var(--muted);font-size:13px;">Aucune icône trouvée. (Utilisez des mots en anglais)</span>';
      return;
    }
    
    resultsDiv.innerHTML = data.icons.map(iconName => {
      const url = `https://api.iconify.design/${iconName.replace(':', '/')}.svg?color=%23888`;
      return `<button class="btn-icon" style="width:36px;height:36px;padding:0;display:flex;align-items:center;justify-content:center;border:1px solid var(--border);border-radius:8px;cursor:pointer;background:var(--card);color:var(--text)" onclick="selectOnlineIcon('${iconName}')" title="${iconName}">
        <img src="${url}" style="width:24px;height:24px;" />
      </button>`;
    }).join('');
  } catch (err) {
    resultsDiv.innerHTML = `<span style="color:var(--red);font-size:13px;">Erreur : ${err.message}</span>`;
  }
}

async function selectOnlineIcon(iconName) {
  try {
    const res = await fetch(`https://api.iconify.design/${iconName.replace(':', '/')}.svg?color=currentColor&width=24&height=24`);
    const svgText = await res.text();
    tempStyleIcon = svgText;
    renderStyleGrids();
    const resultsDiv = document.getElementById('icon-search-results');
    const searchInput = document.getElementById('icon-search-input');
    if (resultsDiv) resultsDiv.innerHTML = '';
    if (searchInput) searchInput.value = '';
    toast('Icône téléchargée avec succès', 'success');
  } catch (err) {
    toast('Erreur de téléchargement', 'error');
  }
}

function renderStyleGrids() {
  const iconGrid = document.getElementById('style-icon-grid');
  const colorGrid = document.getElementById('style-color-grid');
  
  if (iconGrid) {
    const isOnlineSelected = tempStyleIcon && !ICONS_MAP[tempStyleIcon];
    let onlineHtml = '';
    if (isOnlineSelected) {
      onlineHtml = `<div style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:8px;cursor:pointer;border:2px solid var(--primary);background:var(--primary-l);color:var(--text);" title="Icône téléchargée">
        ${tempStyleIcon}
      </div>`;
    }

    const defaultHtml = Object.keys(ICONS_MAP).map(key => {
      const isSelected = key === tempStyleIcon;
      return `<div onclick="selectStyleIcon('${key}')" style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:8px;cursor:pointer;border:2px solid ${isSelected ? 'var(--primary)' : 'var(--border)'};background:${isSelected ? 'var(--primary-l)' : 'var(--card)'};color:var(--text)" title="${key}">
        ${ICONS_MAP[key]}
      </div>`;
    }).join('');
    
    iconGrid.innerHTML = onlineHtml + defaultHtml;
  }

  if (colorGrid) {
    colorGrid.innerHTML = AVAILABLE_COLORS.map(color => {
      const isSelected = color === tempStyleColor;
      return `<div onclick="selectStyleColor('${color}')" style="width:32px;height:32px;border-radius:50%;cursor:pointer;background:var(--cat-${color}-bg);color:var(--cat-${color}-txt);display:flex;align-items:center;justify-content:center;border:2px solid ${isSelected ? 'var(--text)' : 'transparent'};" title="${color}">
        <div style="width:16px;height:16px;border-radius:50%;background:currentColor;"></div>
      </div>`;
    }).join('');
  }
}

function selectStyleIcon(icon) { tempStyleIcon = icon; renderStyleGrids(); }
function selectStyleColor(color) { tempStyleColor = color; renderStyleGrids(); }
function closeCategoryStyleModal() { document.getElementById('modal-category-style').classList.remove('open'); }

async function saveCategoryStyle() {
  if (!currentStyleCat || !state.db) return;
  const docId = currentStyleCat.replace(/\//g, '_').slice(0, 140);
  
  const btn = document.querySelector('#modal-category-style .btn-primary');
  const oldText = btn.textContent;
  btn.textContent = 'Enregistrement...';
  btn.disabled = true;

  try {
    await collectionRef(state.db, 'category_styles').doc(docId).set({
      category: currentStyleCat,
      icon: tempStyleIcon,
      color: tempStyleColor,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    state.CATEGORY_STYLES[currentStyleCat] = { icon: tempStyleIcon, color: tempStyleColor };
    FSCache.invalidate('category_styles');
    
    closeCategoryStyleModal();
    toast('Style sauvegardé', 'success');
    
    applyFilters();
    renderDashboard();
    renderFusionTable();
  } catch(err) {
    toast('Erreur: ' + err.message, 'error');
  } finally {
    btn.textContent = oldText;
    btn.disabled = false;
  }
}

async function resetCategoryStyle() {
  if (!currentStyleCat || !state.db) return;
  const docId = currentStyleCat.replace(/\//g, '_').slice(0, 140);
  try {
    await collectionRef(state.db, 'category_styles').doc(docId).delete();
    delete state.CATEGORY_STYLES[currentStyleCat];
    FSCache.invalidate('category_styles');
    
    closeCategoryStyleModal();
    toast('Style réinitialisé', 'success');
    
    applyFilters();
    renderDashboard();
    renderFusionTable();
  } catch(err) {
    toast('Erreur: ' + err.message, 'error');
  }
}

// ── Navigation par page ───────────────────────────────────────────────────────
const PANEL_NAMES = ['dashboard', 'transactions', 'budget', 'patrimoine', 'qa', 'fusion', 'mappings', 'reparse', 'tronity', 'rules', 'excluded', 'rav-config', 'analyse', 'budgets-v2', 'advanced'];
const ACTIVE_PANEL_STORAGE_KEY = 'activePanelV1';

function getInitialPanel() {
  const savedPanel = localStorage.getItem(ACTIVE_PANEL_STORAGE_KEY);
  return PANEL_NAMES.includes(savedPanel) ? savedPanel : 'dashboard';
}

function scrollToPanel(name) {
  if (!PANEL_NAMES.includes(name)) return;
  localStorage.setItem(ACTIVE_PANEL_STORAGE_KEY, name);

  // Afficher seulement le panneau sélectionné
  PANEL_NAMES.forEach(n => {
    const p = document.getElementById(`tab-${n}`);
    if (p) p.classList.toggle('active', n === name);
  });

  // Onglets desktop : état actif
  PANEL_NAMES.forEach(n => {
    const btn = document.getElementById(`tab-btn-${n}`);
    if (btn) btn.classList.toggle('active', n === name);
  });

  // Barre de navigation mobile : état actif
  PANEL_NAMES.forEach(n => {
    const btn = document.getElementById(`bnav-${n}`);
    if (btn) btn.classList.toggle('active', n === name);
  });

  const isAdvancedPanel = ['mappings', 'fusion', 'reparse', 'tronity'].includes(name);
  const desktopAdvancedBtn = document.getElementById('tab-btn-advanced');
  if (desktopAdvancedBtn) desktopAdvancedBtn.classList.toggle('active', isAdvancedPanel);
  const mobileAdvancedBtn = document.getElementById('bnav-advanced');
  if (mobileAdvancedBtn) mobileAdvancedBtn.classList.toggle('active', isAdvancedPanel);

  closeAdvancedMenus();

  // FAB : visible uniquement sur Transactions
  const fab = document.getElementById('fab-add');
  if (fab) fab.style.display = name === 'transactions' ? 'flex' : 'none';

  // Onglet Budget : toujours revenir au mois en cours (vue mensuelle) et forcer le rendu quel que soit le mode
  if (name === 'budget') {
    resetBudgetPeriodToCurrentMonth();
    renderBudget();
  }

  // Chargement paresseux du panneau Fusion catégories
  if (name === 'fusion' && !_fusionLoaded) {
    _fusionLoaded = true;
    loadFusions();
  } else if (name === 'fusion') {
    renderFusions();
  }

  // Chargement paresseux du panneau Patrimoine
  if (name === 'patrimoine' && !state._patrimoineLoaded) {
    setState('_patrimoineLoaded', true);
    loadPlacements();
  } else if (name === 'patrimoine') {
    renderPatrimoine();
  }

  // Chargement paresseux du panneau Avancé (économise 300 lectures Firebase au démarrage)
  if (name === 'reparse' && !state._advancedLoaded) {
    setState('_advancedLoaded', true);
    loadReparseData();
    loadExcludedEmails();
  }

  // Retour en haut de page
  window.scrollTo(0, 0);
}


function closeAdvancedMenus() {
  document.getElementById('desktop-advanced-dropdown')?.classList.remove('open');
  document.getElementById('mobile-advanced-menu')?.classList.remove('open');
}

function toggleAdvancedDropdown(event) {
  if (event?.stopPropagation) event.stopPropagation();
  const dropdown = document.getElementById('desktop-advanced-dropdown');
  if (!dropdown) return;
  dropdown.classList.toggle('open');
  document.getElementById('mobile-advanced-menu')?.classList.remove('open');
}

function toggleMobileAdvancedDropdown(event) {
  if (event?.stopPropagation) event.stopPropagation();
  const menu = document.getElementById('mobile-advanced-menu');
  if (!menu) return;
  menu.classList.toggle('open');
  document.getElementById('desktop-advanced-dropdown')?.classList.remove('open');
}

function initMobileAdvancedButtonFallback() {
  const btn = document.getElementById('bnav-advanced');
  if (!btn || btn.dataset.touchBound === '1') return;
  const onTouchEnd = (event) => {
    event.preventDefault();
    toggleMobileAdvancedDropdown(event);
  };
  btn.addEventListener('touchend', onTouchEnd, { passive: false });
  btn.dataset.touchBound = '1';
}

initMobileAdvancedButtonFallback();

function openAdvancedTarget(target) {
  if (target === 'mappings') {
    scrollToPanel('mappings');
    return;
  }
  if (target === 'fusion') {
    scrollToPanel('fusion');
    return;
  }
  if (target === 'tronity') {
    scrollToPanel('tronity');
    return;
  }
  scrollToPanel('reparse');
  const reparse = document.getElementById('adv-reparse');
  const excluded = document.getElementById('adv-excluded');
  const rules = document.getElementById('adv-rules');
  if (target === 'reparse') {
    if (reparse) reparse.open = true;
    if (excluded) excluded.open = false;
    if (rules) rules.open = false;
  } else if (target === 'excluded') {
    if (excluded) excluded.open = true;
    if (reparse) reparse.open = false;
    if (rules) rules.open = false;
  } else if (target === 'rules') {
    if (rules) rules.open = true;
    if (reparse) reparse.open = false;
    if (excluded) excluded.open = false;
  }
}

document.addEventListener('click', (event) => {
  const desktopDropdown = document.getElementById('desktop-advanced-dropdown');
  if (desktopDropdown && !desktopDropdown.contains(event.target)) {
    desktopDropdown.classList.remove('open');
  }
  const mobileWrap = document.getElementById('mobile-advanced-wrap');
  const mobileMenu = document.getElementById('mobile-advanced-menu');
  if (mobileMenu && mobileWrap && !mobileWrap.contains(event.target)) {
    mobileMenu.classList.remove('open');
  }
});

// ── Mobile search sync ────────────────────────────────────────────────────────
function syncMobileSearch() {
  document.getElementById('f-search').value = document.getElementById('f-search-m').value;
  applyFilters();
}

// ── Filter bottom sheet ───────────────────────────────────────────────────────
function openFilterSheet() {
  document.getElementById('fs-compte').value  = document.getElementById('f-compte').value;
  document.getElementById('fs-type').value    = document.getElementById('f-type').value;
  document.getElementById('fs-year').value    = document.getElementById('f-year').value;
  document.getElementById('fs-month').value   = document.getElementById('f-month').value;
  document.getElementById('fs-pointe').value  = document.getElementById('f-pointe').value;
  document.getElementById('fs-categorie').value = document.getElementById('f-categorie').value;
  document.getElementById('filter-sheet-overlay').classList.add('open');
  requestAnimationFrame(() => {
    document.getElementById('filter-sheet').classList.add('open');
  });
}

function closeFilterSheet() {
  document.getElementById('filter-sheet').classList.remove('open');
  setTimeout(() => document.getElementById('filter-sheet-overlay').classList.remove('open'), 300);
}

function applyFilterSheet() {
  document.getElementById('f-compte').value  = document.getElementById('fs-compte').value;
  document.getElementById('f-type').value    = document.getElementById('fs-type').value;
  document.getElementById('f-year').value    = document.getElementById('fs-year').value;
  document.getElementById('f-month').value   = document.getElementById('fs-month').value;
  document.getElementById('f-pointe').value  = document.getElementById('fs-pointe').value;
  document.getElementById('f-categorie').value = document.getElementById('fs-categorie').value;
  applyFilters();
  updateFilterBadge();
  closeFilterSheet();
}

function resetFiltersSheet() {
  ['fs-compte', 'fs-type', 'fs-year', 'fs-month', 'fs-pointe', 'fs-categorie']
    .forEach(id => (document.getElementById(id).value = ''));
  const now = new Date();
  const currentYear = String(now.getFullYear());
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
  const fsYear = document.getElementById('fs-year');
  const fsMonth = document.getElementById('fs-month');
  if (fsYear && [...fsYear.options].some(o => o.value === currentYear)) fsYear.value = currentYear;
  if (fsMonth) fsMonth.value = currentMonth;
}

function updateFilterBadge() {
  const count = ['f-compte', 'f-type', 'f-year', 'f-month', 'f-pointe', 'f-categorie']
    .filter(id => document.getElementById(id).value !== '').length;
  const badge = document.getElementById('filter-badge');
  const btn   = document.getElementById('btn-filter-sheet');
  if (!badge || !btn) return;
  badge.textContent = count;
  badge.style.display = count > 0 ? 'inline-flex' : 'none';
  btn.classList.toggle('has-filters', count > 0);
}

// ── Delete depuis la modale de détail ─────────────────────────────────────────
function deleteFromDetail() {
  if (!state.detailTxId) return;
  closeDetailModal();
  openDeleteModal(state.detailTxId);
}

async function addDetailToRecurring() {
  if (!state.detailTxId) return;
  const tx = state.ALL_TX.find(t => t.id === state.detailTxId);
  if (!tx) {
    toast('Transaction introuvable.', 'error');
    return;
  }

  const amount = Number(tx.montant);
  if (!Number.isFinite(amount)) {
    toast('Montant invalide pour créer une récurrence.', 'error');
    return;
  }

  const recurringDraft = {
    category: tx.categorie || '(Sans catégorie)',
    avgAmount: amount,
  };
  const key = getRecurringKey(recurringDraft);
  const current = RECURRING_SETTINGS[key] || {};
  const payload = {
    status: 'accepted',
    manual: true,
    manualAmount: amount,
    manualCompte: tx.compte || '',
    manualLastDate: tx.date || '',
    manualCount: Number(current.manualCount || 0) + 1,
    customLabel: current.customLabel || tx.libelle || null,
    customCategory: current.customCategory || tx.categorie || null,
    customFreq: current.customFreq || 'Mensuel',
  };

  await _saveRecurringSetting(key, payload);
  renderRecurringTransactions();

  const section = document.getElementById('recurring-section');
  const list = document.getElementById('recurring-list');
  const icon = document.getElementById('rec-toggle-icon');
  if (section) section.style.display = 'block';
  if (list) list.style.display = 'block';
  if (icon) icon.textContent = '▲';

  toast('Transaction ajoutée aux récurrentes', 'success');
}

// ── Toast ─────────────────────────────────────────────────────────────────────
let lastToastMsg = '';
let lastToastTime = 0;

function toast(msg, type = '') {
  const now = Date.now();
  if (msg === lastToastMsg && (now - lastToastTime) < 2000) return; // Anti-spam
  lastToastMsg = msg;
  lastToastTime = now;

  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' ' + type : '');
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3000);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = v =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);
const esc = s =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const escJs = s =>
  String(s ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r');
const toDate = value => {
  return parseDateInput(value);
};
const setText  = (id, v) => { document.getElementById(id).textContent = v; };
const hideLoader = ()    => { document.getElementById('loader').style.display = 'none'; };
const setStatus  = (cls, msg) => {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.className   = cls;
  const clickable = !!state.LAST_ERROR_STATE;
  el.classList.toggle('status-clickable', clickable);
  el.title = clickable ? 'Cliquer pour afficher les détails techniques' : '';
};

function captureError(context, err, extra = {}) {
  const error = err || {};
  setState('LAST_ERROR_STATE', {
    time: new Date().toISOString(),
    context,
    name: error.name || 'Error',
    message: error.message || String(error),
    stack: error.stack || 'Stack indisponible',
    extra,
  });
}

function onStatusClick() {
  const statusEl = document.getElementById('status');
  if (!state.LAST_ERROR_STATE) {
    toast("Aucun détail d'erreur enregistré.", 'error');
    return;
  }

  const detailsText = [
    `Contexte: ${state.LAST_ERROR_STATE.context}`,
    `Heure: ${new Date(state.LAST_ERROR_STATE.time).toLocaleString('fr-FR')}`,
    `Type: ${state.LAST_ERROR_STATE.name}`,
    `Message: ${state.LAST_ERROR_STATE.message}`,
    '',
    'Stack:',
    state.LAST_ERROR_STATE.stack,
  ].join('\n');

  const hasExtra = Object.keys(state.LAST_ERROR_STATE.extra || {}).length > 0;
  showError(
    `<strong>Erreur détectée (${esc(state.LAST_ERROR_STATE.context)})</strong><br><br>` +
    `<details open><summary>Détails techniques</summary>` +
    `<pre style="white-space:pre-wrap;font-size:12px;line-height:1.4;margin-top:8px;background:rgba(0,0,0,.03);padding:10px;border-radius:6px">${esc(detailsText)}</pre>` +
    `</details>` +
    (hasExtra
      ? `<details style="margin-top:8px"><summary>Données additionnelles</summary><pre style="white-space:pre-wrap;font-size:12px;line-height:1.4;margin-top:8px;background:rgba(0,0,0,.03);padding:10px;border-radius:6px">${esc(JSON.stringify(state.LAST_ERROR_STATE.extra, null, 2))}</pre></details>`
      : '')
  );
  document.getElementById('error-box').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function showError(html) {
  document.getElementById('error-box').innerHTML = html;
  document.getElementById('error-box').style.display = 'block';
  hideLoader();
}

// ── GitHub Actions dispatch ───────────────────────────────────────────────────

async function openGithubSettings() {
  const settings = await getGitHubSettings();
  document.getElementById('gs-owner').value = settings.owner;
  document.getElementById('gs-repo').value  = settings.repo;
  document.getElementById('gs-pat').value   = settings.pat;
  document.getElementById('modal-github-settings').classList.add('open');
}

function closeGithubSettings() {
  document.getElementById('modal-github-settings').classList.remove('open');
}

async function saveGithubSettings() {
  const owner = document.getElementById('gs-owner').value.trim();
  const repo  = document.getElementById('gs-repo').value.trim();
  const pat   = document.getElementById('gs-pat').value.trim();
  if (!owner || !repo || !pat) {
    toast('Remplis tous les champs', 'error');
    return;
  }
  try {
    await saveGitHubSettings(owner, repo, pat);
    toast('Configuration GitHub sauvegardée', 'success');
    await updateGithubSettingsNote();
    closeGithubSettings();
  } catch (e) {
    console.error('Erreur sauvegarde GitHub settings:', e);
    toast('Erreur lors de la sauvegarde', 'error');
  }
}

async function updateGithubSettingsNote() {
  const note = document.getElementById('balances-note-text');
  if (!note) return;
  const settings = await getGitHubSettings();
  if (settings.pat) {
    note.textContent = `Rafraîchir = reparse des emails non importés déjà listés (import immédiat via GitHub Actions ${settings.owner}/${settings.repo}). Scan complet = rescanner les mails récents.`;
  } else {
    note.textContent = 'Rafraîchir = reparse des emails non importés déjà listés (run de 6h UTC si GitHub non configuré). Scan complet = rescanner les mails récents.';
  }
}

// Returns: true = success, null = no PAT configured, { error, status } = API failure
async function triggerGitHubWorkflow(eventType = 'import-linxo', clientPayload = null) {
  const settings = await getGitHubSettings();
  const pat = settings.pat;
  const owner = settings.owner;
  const repo = settings.repo;
  if (!pat || !owner || !repo) return null;
  try {
    const res = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/dispatches`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${pat}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_type: eventType,
        ...(clientPayload && typeof clientPayload === 'object' ? { client_payload: clientPayload } : {}),
      }),
    });
    // GitHub returns 204 No Content on success
    if (res.status === 204 || res.ok) return true;
    const body = await res.text().catch(() => '');
    const msg = {
      401: 'Token GitHub invalide ou expiré (401)',
      403: 'Token GitHub sans permission write sur le repo (403)',
      404: `Repo "${owner}/${repo}" introuvable ou token sans accès (404)`,
      422: 'Workflow introuvable ou event_type non reconnu (422)',
    }[res.status] || `Erreur GitHub ${res.status}`;
    console.warn('GitHub dispatch HTTP', res.status, body);
    return { error: msg, status: res.status };
  } catch (e) {
    console.warn('GitHub dispatch error:', e);
    return { error: `Erreur réseau : ${e.message}`, status: 0 };
  }
}

function askTronityTargetMode() {
  const answer = (window.prompt(
    "Import Tronity : tape '1' pour importer dans l'app, ou '2' pour générer un fichier Excel (CSV).",
    '1',
  ) || '').trim().toLowerCase();

  if (answer === '1' || answer === 'app' || answer === 'import') return 'app';
  if (answer === '2' || answer === 'excel' || answer === 'csv') return 'excel';
  return null;
}

function askTronityPeriod() {
  const isStrictIsoDate = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = parseDateInput(`${value}T00:00:00Z`);
    return Boolean(parsed && parsed.toISOString().slice(0, 10) === value);
  };
  const today = new Date().toISOString().slice(0, 10);
  const defaultStart = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const start = (window.prompt('Période Tronity — date de début (YYYY-MM-DD)', defaultStart) || '').trim();
  if (!start) return null;
  const end = (window.prompt('Période Tronity — date de fin (YYYY-MM-DD)', today) || '').trim();
  if (!end) return null;
  if (!isStrictIsoDate(start) || !isStrictIsoDate(end)) {
    toast('Format de date invalide. Utilise YYYY-MM-DD.', 'error');
    return null;
  }
  if (start > end) {
    toast('La date de début doit être antérieure ou égale à la date de fin.', 'error');
    return null;
  }
  return { start, end };
}

function exportTronityTransactionsToExcelLikeCsv(start, end) {
  const tronityTx = state.ALL_TX
    .filter(t => t?.source === 'tronity' && t?.date && t.date >= start && t.date <= end)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!tronityTx.length) {
    toast('Aucune transaction Tronity trouvée sur la période demandée.', 'error');
    return false;
  }

  const headers = ['date', 'libelle', 'montant', 'compte', 'categorie', 'commentaire', 'source'];
  const escCsv = (value) => {
    const text = String(value ?? '');
    if (text.includes(';') || text.includes('"') || text.includes('\n')) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };
  const lines = [
    headers.join(';'),
    ...tronityTx.map(tx => headers.map(key => escCsv(tx[key])).join(';')),
  ];
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tronity-${start}_${end}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return true;
}

async function importLatestTronityCharges() {
  const status = document.getElementById('tronity-config-status');
  const targetMode = askTronityTargetMode();
  if (!targetMode) {
    toast('Action annulée.', 'error');
    if (status) status.textContent = 'Action Tronity annulée.';
    return;
  }
  const period = askTronityPeriod();
  if (!period) {
    if (status) status.textContent = 'Période Tronity invalide ou annulée.';
    return;
  }

  if (targetMode === 'excel') {
    const ok = exportTronityTransactionsToExcelLikeCsv(period.start, period.end);
    if (ok) {
      if (status) status.textContent = `Export Excel (CSV) Tronity généré pour ${period.start} → ${period.end}.`;
      toast('Export Tronity (Excel/CSV) terminé ✅', 'success');
    }
    return;
  }

  if (status) status.textContent = `Déclenchement de l’import Tronity (${period.start} → ${period.end}) en cours…`;

  // DÉCLENCHEMENT DE L'ACTION GITHUB
  let dispatched = false;
  try {
    dispatched = await triggerGitHubWorkflow('import-tronity', {
      date_from: period.start,
      date_to: period.end,
    });
  } catch (e) {
    alert('Check GitHub Token in Settings (⚙)');
    if (status) status.textContent = 'Erreur lors du déclenchement de l\'import Tronity.';
    return;
  }

  if (dispatched) {
    if (status) status.textContent = `Import Tronity déclenché ✅`;
    toast('Import Tronity déclenché ✅', 'success');
    // Invalidation du cache asynchrone pour ne pas geler l'UI
    setTimeout(() => {
      FSCache.invalidateAll();
    }, 100);
    return;
  }

  alert('Check GitHub Token in Settings (⚙)');
  if (status) status.textContent = 'Impossible de déclencher l\'import. Vérifie ton Token GitHub.';
}
// ── Détection de doublons ─────────────────────────────────────────────────────
const REVIEWED_DUPLICATES_KEY = 'reviewedDuplicatePairsV1';
const DISMISSED_PAIRS_COLLECTION = 'dismissed_duplicate_pairs';

// Cache mémoire des paires ignorées (null = pas encore chargé depuis Firestore)
let _reviewedPairsCache = null;

/**
 * Charge les paires ignorées depuis Firestore + localStorage au démarrage.
 * Migre automatiquement les entrées localStorage absentes de Firestore.
 */
async function initReviewedDuplicatePairs() {
  try {
    const snap = await collectionRef(state.db, DISMISSED_PAIRS_COLLECTION).get();
    const fromFirestore = new Set(snap.docs.map(d => d.id));
    const fromLocal = _loadReviewedPairsFromLocalStorage();
    _reviewedPairsCache = new Set([...fromFirestore, ...fromLocal]);
    // Migration : uploader les paires locales absentes de Firestore
    const toMigrate = [...fromLocal].filter(k => !fromFirestore.has(k));
    if (toMigrate.length > 0) {
      await _persistDismissedPairsToFirestore(toMigrate);
    }
    _saveReviewedPairsToLocalStorage(_reviewedPairsCache);
  } catch (err) {
    console.warn('[doublons] init Firestore échoué, fallback localStorage', err.message);
    _reviewedPairsCache = _loadReviewedPairsFromLocalStorage();
  }
}

function _loadReviewedPairsFromLocalStorage() {
  try {
    const stored = localStorage.getItem(REVIEWED_DUPLICATES_KEY);
    if (!stored) return new Set();
    const arr = JSON.parse(stored);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch { return new Set(); }
}

function _saveReviewedPairsToLocalStorage(set) {
  try {
    localStorage.setItem(REVIEWED_DUPLICATES_KEY, JSON.stringify([...set]));
  } catch {}
}

async function _persistDismissedPairsToFirestore(keys) {
  if (!state.db || !keys.length) return;
  try {
    const batch = createBatch(state.db);
    for (const key of keys) {
      const parts = key.split('|||');
      batch.set(collectionRef(state.db, DISMISSED_PAIRS_COLLECTION).doc(key), {
        id1: parts[0] ?? '',
        id2: parts[1] ?? '',
        dismissedAt: firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    await batch.commit();
  } catch (err) {
    console.warn('[doublons] écriture Firestore échouée', err.message);
  }
}

function loadReviewedDuplicatePairs() {
  // Utilise le cache Firestore s'il est chargé, sinon fallback localStorage
  return _reviewedPairsCache ?? _loadReviewedPairsFromLocalStorage();
}

function saveReviewedDuplicatePairs(set) {
  _reviewedPairsCache = set;
  _saveReviewedPairsToLocalStorage(set);
}

function dupPairKey(id1, id2) {
  return buildDuplicatePairKey(id1, id2);
}

function detectDuplicatePairs() {
  const reviewed = loadReviewedDuplicatePairs();
  return detectDuplicatePairsPure(state.ALL_TX, {
    reviewedKeys: reviewed,
    excludedDates: ['2026-03-01'],
    parseImportedAt: toDate,
  });
}

// Stockage de session des paires affichées
let _currentDupPairs = [];
// pairKey → txId à supprimer
let _dupsPending = new Map();

function openDuplicatesModal() {
  _currentDupPairs = detectDuplicatePairs();
  _dupsPending = new Map();
  const descEl = document.getElementById('dup-modal-desc');
  const listEl = document.getElementById('dup-list');
  const btnAll = document.getElementById('btn-dismiss-all-dups');
  const btnDel = document.getElementById('btn-delete-marked-dups');

  if (!_currentDupPairs.length) {
    descEl.textContent = 'Aucun doublon potentiel détecté (même montant, même année, non encore examiné).';
    listEl.innerHTML = '<div class="dup-empty-state">Tout est en ordre !</div>';
    if (btnAll) btnAll.style.display = 'none';
    if (btnDel) btnDel.style.display = 'none';
  } else {
    descEl.innerHTML = `<strong>${_currentDupPairs.length} paire(s)</strong> potentiellement en doublon (même montant, même année).<br>Marquez le doublon sur chaque paire, puis supprimez-les tous d'un coup.`;
    listEl.innerHTML = _currentDupPairs.map((pair, idx) => renderDuplicatePairHtml(pair, idx)).join('');
    if (btnAll) btnAll.style.display = '';
    if (btnDel) btnDel.style.display = 'none';
  }

  document.getElementById('modal-duplicates').classList.add('open');
}

function closeDuplicatesModal() {
  document.getElementById('modal-duplicates').classList.remove('open');
}

function dismissAllDuplicatePairs() {
  const reviewed = loadReviewedDuplicatePairs();
  const newKeys = _currentDupPairs.map(p => p.key);
  newKeys.forEach(k => reviewed.add(k));
  saveReviewedDuplicatePairs(reviewed);
  _persistDismissedPairsToFirestore(newKeys);
  _currentDupPairs = [];
  _dupsPending = new Map();

  const descEl = document.getElementById('dup-modal-desc');
  const listEl = document.getElementById('dup-list');
  const btnAll = document.getElementById('btn-dismiss-all-dups');
  const btnDel = document.getElementById('btn-delete-marked-dups');
  if (descEl) descEl.textContent = 'Toutes les paires ont été ignorées.';
  if (listEl) listEl.innerHTML = '<div class="dup-empty-state">Tout est en ordre !</div>';
  if (btnAll) btnAll.style.display = 'none';
  if (btnDel) btnDel.style.display = 'none';
  toast('Toutes les paires ignorées', 'success');
}

function renderDuplicatePairHtml(pair, idx) {
  const { tx1, tx2, key } = pair;
  const pos = tx1.montant >= 0;
  const amountCls = pos ? 'pos' : 'neg';

  const fmtImportedAt = tx => {
    const d = toDate(tx.importedAt);
    return d
      ? d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '—';
  };

  const rowHtml = tx => {
    const badgeCls = tx.compte === 'BforBank' ? 'badge-bfor' : 'badge-lcl';
    return `<tr id="dup-row-${esc(tx.id)}">
      <td class="td-libelle" style="max-width:180px" title="${esc(tx.libelle)}">${esc(tx.libelle)}</td>
      <td style="white-space:nowrap;font-size:12px;color:var(--muted)">${fmtImportedAt(tx)}</td>
      <td style="white-space:nowrap">${esc(tx.date)}</td>
      <td><span class="badge-cat ${tx.categorie ? '' : 'empty'}">${esc(tx.categorie || '—')}</span></td>
      <td><span class="badge ${badgeCls}" style="font-size:11px">${esc(tx.compte)}</span></td>
      <td>
        <button class="btn-dup-mark" id="btn-mark-${esc(tx.id)}"
                onclick="toggleDupMark('${escJs(key)}', '${escJs(tx.id)}')">
          C'est le doublon
        </button>
      </td>
    </tr>`;
  };

  return `
    <div class="dup-pair" id="dup-pair-${idx}">
      <div class="dup-pair-header">
        <span style="font-weight:600;font-size:13px">Paire #${idx + 1}</span>
        <span class="dup-pair-amount ${amountCls}">${fmt(tx1.montant)}</span>
        <span style="font-size:12px;color:var(--muted)">Année ${tx1.date.slice(0, 4)}</span>
      </div>
      <table class="dup-pair-table">
        <thead>
          <tr>
            <th>Libellé</th>
            <th>Date d'extraction</th>
            <th>Date</th>
            <th>Catégorie</th>
            <th>Compte</th>
            <th style="width:130px">Marquer</th>
          </tr>
        </thead>
        <tbody>
          ${rowHtml(tx1)}
          ${rowHtml(tx2)}
        </tbody>
      </table>
      <div class="dup-pair-actions">
        <button class="btn-dup-dismiss"
                onclick="dismissDuplicatePair('${escJs(key)}', ${idx})">
          Pas un doublon
        </button>
      </div>
    </div>`;
}

function toggleDupMark(pairKey, txId) {
  const btn = document.getElementById(`btn-mark-${txId}`);
  const row = document.getElementById(`dup-row-${txId}`);

  if (_dupsPending.get(pairKey) === txId) {
    // Désélectionner
    _dupsPending.delete(pairKey);
    if (btn) btn.classList.remove('marked');
    if (row) row.classList.remove('dup-row-marked');
  } else {
    // Désélectionner l'autre tx de la même paire si déjà marquée
    const prevTxId = _dupsPending.get(pairKey);
    if (prevTxId) {
      const prevBtn = document.getElementById(`btn-mark-${prevTxId}`);
      const prevRow = document.getElementById(`dup-row-${prevTxId}`);
      if (prevBtn) prevBtn.classList.remove('marked');
      if (prevRow) prevRow.classList.remove('dup-row-marked');
    }
    _dupsPending.set(pairKey, txId);
    if (btn) btn.classList.add('marked');
    if (row) row.classList.add('dup-row-marked');
  }

  updateDeleteMarkedBtn();
}

function updateDeleteMarkedBtn() {
  const btnDel = document.getElementById('btn-delete-marked-dups');
  const count = _dupsPending.size;
  if (!btnDel) return;
  if (count > 0) {
    btnDel.style.display = '';
    btnDel.textContent = `Supprimer les doublons marqués (${count})`;
  } else {
    btnDel.style.display = 'none';
  }
}

async function deleteAllMarkedDups() {
  if (!_dupsPending.size) return;
  const btnDel = document.getElementById('btn-delete-marked-dups');
  if (btnDel) { btnDel.disabled = true; btnDel.textContent = 'Suppression…'; }

  const reviewed = loadReviewedDuplicatePairs();
  const toDelete = [..._dupsPending.entries()]; // [[pairKey, txId], ...]
  let successCount = 0;
  let errorCount = 0;

  // Batch Firestore pour éviter N writes individuels
  try {
    const batch = createBatch(state.db);
    for (const [, txId] of toDelete) {
      batch.delete(collectionRef(state.db, 'transactions').doc(txId));
      batch.set(collectionRef(state.db, 'deleted_transactions').doc(txId), {
        transactionId: txId,
        deletedAt: firebase.firestore.FieldValue.serverTimestamp(),
        deletedBy: firebase.auth().currentUser?.email || '',
        source: 'dashboard_duplicate_cleanup',
      }, { merge: true });
    }
    await batch.commit();
    const deletedIds = new Set(toDelete.map(([, txId]) => txId));
    setState('ALL_TX', state.ALL_TX.filter(t => !deletedIds.has(t.id)));
    FSCache.invalidate('transactions', 'transactions_all');
    for (const [pairKey] of toDelete) {
      reviewed.add(pairKey);
      successCount++;
    }
  } catch (err) {
    console.error('Erreur suppression doublons en batch', err.message);
    errorCount = toDelete.length;
  }

  // Marquer aussi comme revues les paires ignorées (pas de doublon sélectionné)
  const ignoredKeys = [];
  _currentDupPairs.forEach(p => {
    if (!_dupsPending.has(p.key)) {
      reviewed.add(p.key);
      ignoredKeys.push(p.key);
    }
  });
  saveReviewedDuplicatePairs(reviewed);
  // Persister toutes les paires traitées (supprimées + ignorées) en Firestore
  const allTreatedKeys = [
    ...toDelete.map(([pairKey]) => pairKey),
    ...ignoredKeys,
  ];
  if (allTreatedKeys.length > 0) {
    _persistDismissedPairsToFirestore(allTreatedKeys);
  }
  _dupsPending = new Map();
  _currentDupPairs = [];

  applyFilters();
  renderDashboard();
  setStatus('ok', `${state.ALL_TX.length.toLocaleString('fr-FR')} transactions`);

  if (errorCount === 0) {
    toast(`${successCount} doublon(s) supprimé(s)`, 'success');
  } else {
    toast(`${successCount} supprimé(s), ${errorCount} erreur(s)`, 'error');
  }

  const descEl = document.getElementById('dup-modal-desc');
  const listEl = document.getElementById('dup-list');
  const btnAll = document.getElementById('btn-dismiss-all-dups');
  if (descEl) descEl.textContent = `${successCount} doublon(s) supprimé(s). Toutes les paires ont été traitées.`;
  if (listEl) listEl.innerHTML = '<div class="dup-empty-state">Tout est en ordre !</div>';
  if (btnAll) btnAll.style.display = 'none';
  if (btnDel) { btnDel.style.display = 'none'; btnDel.disabled = false; }
}

function dismissDuplicatePair(key, idx) {
  const reviewed = loadReviewedDuplicatePairs();
  reviewed.add(key);
  saveReviewedDuplicatePairs(reviewed);
  _persistDismissedPairsToFirestore([key]);
  _dupsPending.delete(key);
  _currentDupPairs = _currentDupPairs.filter(p => p.key !== key);

  const el = document.getElementById(`dup-pair-${idx}`);
  if (el) el.remove();

  const remaining = document.querySelectorAll('#dup-list .dup-pair').length;
  const descEl = document.getElementById('dup-modal-desc');
  const listEl = document.getElementById('dup-list');
  const btnAll = document.getElementById('btn-dismiss-all-dups');
  if (remaining === 0) {
    if (descEl) descEl.textContent = 'Toutes les paires ont été examinées.';
    if (listEl) listEl.innerHTML = '<div class="dup-empty-state">Tout est en ordre !</div>';
    if (btnAll) btnAll.style.display = 'none';
  } else {
    if (descEl) descEl.innerHTML = `<strong>${remaining} paire(s)</strong> restante(s) à examiner.`;
  }
  updateDeleteMarkedBtn();
}

// Fermer les modals en cliquant sur l'overlay
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// TRANSACTIONS RÉCURRENTES — détection automatique
// ══════════════════════════════════════════════════════════════════════════════

function detectRecurringTransactions() {
  return detectRecurringTransactionsPure(state.ALL_TX);
}

function renderRecurringTransactions() {
  const section = document.getElementById('recurring-section');
  const list = document.getElementById('recurring-list');
  const badge = document.getElementById('rec-count');
  if (!section || !list) return;

  const rawItems = detectRecurringTransactions();
  const manualItems = Object.entries(RECURRING_SETTINGS)
    .filter(([_, value]) => value?.manual)
    .map(([key, value]) => ({
      key,
      label: value.customLabel || 'Transaction manuelle',
      category: value.customCategory || parseRecurringCategoryFromKey(key),
      compte: value.manualCompte || '—',
      avgAmount: Number.isFinite(Number(value.manualAmount)) ? Number(value.manualAmount) : 0,
      freq: value.customFreq || 'Mensuel',
      count: Number(value.manualCount || 1),
      lastDate: value.manualLastDate || '—',
      status: value.status || 'accepted',
      isManualOnly: true,
    }));
  const detectedKeys = new Set(rawItems.map(r => getRecurringKey(r)));
  const manualOnlyItems = manualItems.filter(item => !detectedKeys.has(item.key));
  const combinedRawItems = [...rawItems, ...manualOnlyItems];

  if (!combinedRawItems.length) {
    section.style.display = 'none';
    return;
  }

  // Appliquer les paramètres personnalisés (label, catégorie, fréquence, statut)
  const items = combinedRawItems.map(r => {
    const key = getRecurringKey(r);
    const s = RECURRING_SETTINGS[key] || {};
    return {
      ...r,
      key,
      status: s.status || 'pending',
      label: s.customLabel || r.label,
      category: s.customCategory || r.category,
      freq: s.customFreq || r.freq,
    };
  });

  section.style.display = 'block';
  badge.textContent = items.length;

  // Coût mensuel : seulement les dépenses non-rejetées
  const totalMensuel = items
    .filter(r => r.avgAmount < 0 && r.status !== 'rejected')
    .reduce((s, r) => {
      if (r.freq === 'Mensuel') return s + r.avgAmount;
      if (r.freq === 'Hebdo') return s + r.avgAmount * 4.33;
      if (r.freq === 'Trimestriel') return s + r.avgAmount / 3;
      if (r.freq === 'Semestriel') return s + r.avgAmount / 6;
      if (r.freq === 'Annuel') return s + r.avgAmount / 12;
      return s;
    }, 0);

  list.innerHTML = `
    <div style="font-size:12px;color:var(--muted);margin-bottom:8px;padding:6px 0;border-bottom:1px solid var(--border)">
      Coût mensuel estimé (hors ignorés) : <strong style="color:var(--red)">${fmt(totalMensuel)}</strong> /mois
    </div>
  ` + items.map(r => {
    const isExpense = r.avgAmount < 0;
    const iconCls = isExpense ? 'expense' : 'income';
    const amtColor = isExpense ? 'var(--red)' : 'var(--green)';
    const cardCls = r.status === 'accepted' ? 'rec-card accepted'
                  : r.status === 'rejected'  ? 'rec-card rejected'
                  : 'rec-card';
    const acceptActive = r.status === 'accepted' ? ' active' : '';
    const rejectActive = r.status === 'rejected'  ? ' active' : '';
    const safeKey = escJs(r.key);
    return `<div class="${cardCls}">
      <div class="rec-icon ${iconCls}">↻</div>
      <div class="rec-info">
        <div class="rec-name" title="${esc(r.label)}">${esc(r.label)}</div>
        <div class="rec-meta">${esc(r.category || 'Non catégorisé')} · ${esc(r.compte)} · ${r.count} occurrences · dernier: ${esc(r.lastDate)}</div>
      </div>
      <span class="rec-freq">${esc(r.freq)}</span>
      <div class="rec-amount" style="color:${amtColor}">${fmt(r.avgAmount)}</div>
      <div class="rec-actions">
        <button class="rec-btn accept${acceptActive}" onclick="acceptRecurring('${safeKey}')" title="${r.status === 'accepted' ? 'Annuler la confirmation' : 'Confirmer'}">✓</button>
        <button class="rec-btn edit" onclick="openRecurringEdit('${safeKey}')" title="Modifier">✏</button>
        <button class="rec-btn reject${rejectActive}" onclick="rejectRecurring('${safeKey}')" title="${r.status === 'rejected' ? 'Annuler l\'exclusion' : 'Ignorer'}">✕</button>
      </div>
    </div>`;
  }).join('');
}

function toggleRecurringList() {
  const list = document.getElementById('recurring-list');
  const icon = document.getElementById('rec-toggle-icon');
  if (!list) return;
  const visible = list.style.display !== 'none';
  list.style.display = visible ? 'none' : 'block';
  if (icon) icon.textContent = visible ? '▼' : '▲';
}

// ══════════════════════════════════════════════════════════════════════════════
// DÉPENSES RÉCURRENTES — Accepter / Rejeter / Éditer
// ══════════════════════════════════════════════════════════════════════════════

let RECURRING_SETTINGS = {};  // docId → { status, customLabel, customCategory, customFreq }
let RAV_CONFIG = {};           // { revenu_mensuel_net: number|null }
let _recEditKey = null;

function getRecurringKey(r) {
  const cat = String(r.category || '(Sans catégorie)').trim().toLowerCase();
  const bucket = Math.round(Math.abs(r.avgAmount));
  // Sanitize pour Firestore doc ID (pas de '/')
  return `${cat}||${bucket}`.replace(/\//g, '_');
}

function parseRecurringCategoryFromKey(key) {
  return String(key || '').split('||')[0] || '(Sans catégorie)';
}

async function loadRecurringSettings() {
  try {
    const snap = await collectionRef(state.db, 'recurring_expense_settings').get();
    RECURRING_SETTINGS = {};
    snap.forEach(doc => { RECURRING_SETTINGS[doc.id] = doc.data(); });
  } catch (e) {
    console.warn('loadRecurringSettings:', e);
  }
}

async function loadRavConfig() {
  try {
    const doc = await state.db.collection('metadata').doc('rav_config').get();
    RAV_CONFIG = doc.exists ? doc.data() : {};
    const input = document.getElementById('rav-revenu-mensuel');
    if (input && RAV_CONFIG.revenu_mensuel_net > 0) input.value = RAV_CONFIG.revenu_mensuel_net;
    renderRavCategorySelector();
    _updateRavHint();
  } catch (e) {
    console.warn('loadRavConfig:', e);
  }
}

function _updateRavHint() {
  const hint = document.getElementById('rav-revenu-hint');
  if (!hint) return;
  const avg = getAverageMonthlyIncome(3);
  hint.textContent = avg > 0
    ? `Auto-détecté (moy. 3 derniers mois) : ${fmt(avg)}`
    : 'Auto-détecté : aucun historique de revenus';
}

async function saveRavConfig() {
  const input = document.getElementById('rav-revenu-mensuel');
  const val = input ? parseFloat(input.value) : NaN;

  // Collecte les catégories cochées
  const checkboxes = document.querySelectorAll('#rav-categories-container input[type="checkbox"]');
  const selectedCats = [...checkboxes].filter(cb => cb.checked).map(cb => cb.value);

  const data = {
    revenu_mensuel_net: Number.isFinite(val) && val > 0 ? val : null,
    revenu_categories: selectedCats.length > 0 ? selectedCats : null,
  };
  try {
    await state.db.collection('metadata').doc('rav_config').set(data, { merge: true });
    RAV_CONFIG = { ...RAV_CONFIG, ...data };
    _updateRavHint();
    toast('Configuration RAV enregistrée.', 'success');
    renderDashboard();
  } catch (e) {
    toast('Erreur lors de la sauvegarde : ' + e.message, 'error');
  }
}

async function _saveRecurringSetting(key, data) {
  try {
    await collectionRef(state.db, 'recurring_expense_settings').doc(key).set(data, { merge: true });
    RECURRING_SETTINGS[key] = { ...(RECURRING_SETTINGS[key] || {}), ...data };
  } catch (e) {
    toast('Erreur Firestore : ' + e.message, 'error');
  }
}

async function acceptRecurring(key) {
  const current = (RECURRING_SETTINGS[key] || {}).status;
  const newStatus = current === 'accepted' ? 'pending' : 'accepted';
  await _saveRecurringSetting(key, { status: newStatus });
  renderRecurringTransactions();
  toast(newStatus === 'accepted' ? 'Dépense confirmée ✓' : 'Statut réinitialisé', 'success');
}

async function rejectRecurring(key) {
  const current = (RECURRING_SETTINGS[key] || {}).status;
  const newStatus = current === 'rejected' ? 'pending' : 'rejected';
  await _saveRecurringSetting(key, { status: newStatus });
  renderRecurringTransactions();
  toast(newStatus === 'rejected' ? 'Dépense ignorée' : 'Statut réinitialisé', 'success');
}

function openRecurringEdit(key) {
  _recEditKey = key;
  const s = RECURRING_SETTINGS[key] || {};
  document.getElementById('rec-edit-label').value = s.customLabel || '';
  populateCategorySelect(document.getElementById('rec-edit-category'), s.customCategory || '');
  document.getElementById('rec-edit-freq').value = s.customFreq || '';
  document.getElementById('modal-rec-edit').classList.add('open');
}

function closeRecurringEdit() {
  document.getElementById('modal-rec-edit').classList.remove('open');
  _recEditKey = null;
}

async function saveRecurringEdit() {
  if (!_recEditKey) return;
  const label = document.getElementById('rec-edit-label').value.trim();
  const category = document.getElementById('rec-edit-category').value;
  const freq = document.getElementById('rec-edit-freq').value;
  const data = {
    customLabel: label || null,
    customCategory: category || null,
    customFreq: freq || null,
  };
  await _saveRecurringSetting(_recEditKey, data);
  closeRecurringEdit();
  renderRecurringTransactions();
  toast('Modifications enregistrées', 'success');
}

// ══════════════════════════════════════════════════════════════════════════════
// CATÉGORISATION IA — suggestions basées sur l'historique (pattern matching)
// ══════════════════════════════════════════════════════════════════════════════

function buildCategoryModel() {
  return buildCategoryModelPure(state.ALL_TX);
}

function suggestCategory(tx, model) {
  return suggestCategoryPure(tx, model);
}

function getUncategorizedTransactions() {
  return state.filtered.filter(t => !t.categorie || t.categorie === 'A Catégoriser');
}

function renderAiBar() {
  const bar = document.getElementById('ai-uncat-bar');
  const countEl = document.getElementById('ai-uncat-count');
  if (!bar) return;

  const uncat = getUncategorizedTransactions();
  if (!uncat.length) {
    bar.style.display = 'none';
    return;
  }

  bar.style.display = 'flex';
  countEl.textContent = uncat.length;
}

async function aiCategorizeAll() {
  const model = buildCategoryModel();
  const uncat = getUncategorizedTransactions();
  let categorized = 0;
  let skipped = 0;

  const batch = createBatch(state.db);
  const updates = []; // track local updates

  for (const tx of uncat) {
    const suggestion = suggestCategory(tx, model);
    if (!suggestion || suggestion.confidence < 50) {
      skipped++;
      continue;
    }
    batch.update(collectionRef(state.db, 'transactions').doc(tx.id), {
      categorie: suggestion.cat,
      aiCategorized: true,
    });
    updates.push({ id: tx.id, cat: suggestion.cat });
    categorized++;

    // Firestore batches max 500
    if (categorized % 490 === 0) {
      await batch.commit();
    }
  }

  if (categorized > 0) {
    try {
      await batch.commit();
      // Mettre à jour localement
      for (const u of updates) {
        const tx = state.ALL_TX.find(t => t.id === u.id);
        if (tx) {
          tx.categorie = u.cat;
          tx.aiCategorized = true;
        }
      }
      FSCache.invalidate('transactions', 'transactions_all');
      applyFilters();
      renderDashboard();
      toast(`${categorized} transaction(s) catégorisée(s) automatiquement (${skipped} ignorée(s) — confiance trop faible)`, 'success');
    } catch (err) {
      toast('Erreur catégorisation : ' + err.message, 'error');
    }
  } else {
    toast(`Aucune suggestion fiable trouvée pour ${uncat.length} transaction(s)`, 'error');
  }
}

// Générer un badge de suggestion pour une cellule de catégorie (règles en priorité, IA en fallback)
function aiSuggestBadgeHtml(tx) {
  if (tx.pointe) return ''; // jamais de suggestion sur les transactions pointées
  if (tx.categorie && tx.categorie !== 'A Catégoriser') return '';

  // 1. Règles d'auto-catégorisation (priorité sur l'IA)
  if (RULES_LOADED && RULES.length) {
    const cat = getRuleCategory(tx, RULES);
    if (cat) {
      return ` <span class="rule-suggest-badge" onclick="event.stopPropagation();applyRuleSuggestion('${escJs(tx.id)}','${escJs(cat)}')" title="Règle auto-catégorisation">⚡ ${esc(cat)}</span>`;
    }
  }

  // 2. Suggestion IA par pattern matching
  if (!window._aiModel) window._aiModel = buildCategoryModel();
  const suggestion = suggestCategory(tx, window._aiModel);
  if (!suggestion || suggestion.confidence < 40) return '';
  return ` <span class="ai-suggest-badge" onclick="event.stopPropagation();aiApplySuggestion('${escJs(tx.id)}','${escJs(suggestion.cat)}')" title="Confiance: ${suggestion.confidence}% (${suggestion.method})"><span class="ai-icon">⚡</span>${esc(suggestion.cat)}</span>`;
}

async function aiApplySuggestion(txId, cat) {
  try {
    await collectionRef(state.db, 'transactions').doc(txId).update({
      categorie: cat,
      aiCategorized: true,
    });
    const tx = state.ALL_TX.find(t => t.id === txId);
    if (tx) {
      tx.categorie = cat;
      tx.aiCategorized = true;
    }
    FSCache.invalidate('transactions', 'transactions_all');
    window._aiModel = null; // Invalider le cache modèle
    applyFilters();
    renderDashboard();
    toast(`Catégorie "${cat}" appliquée`, 'success');
  } catch (err) {
    toast('Erreur : ' + err.message, 'error');
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// RÈGLES D'AUTO-CATÉGORISATION
// Collection Firestore : auto_categorization_rules/{id}
// Champs : pattern, matchType, categorie, compte, enabled, priority, createdAt
// ══════════════════════════════════════════════════════════════════════════════

let RULES = [];
let RULES_LOADED = false;

// Chargement silencieux au démarrage pour alimenter les badges inline
async function loadRulesQuiet() {
  try {
    const cached = FSCache.get('rules');
    if (cached) {
      RULES = cached;
      RULES_LOADED = true;
      window._aiModel = null;
      applyFilters();
      return;
    }
    const snap = await collectionRef(state.db, 'auto_categorization_rules').orderBy('priority', 'asc').get();
    RULES = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    RULES_LOADED = true;
    FSCache.set('rules', RULES);
    window._aiModel = null; // invalider le cache IA pour forcer la prise en compte des règles
    applyFilters(); // re-render des badges dans la liste
  } catch (_) {
    // optionnel — pas bloquant
  }
}

// Déclenché à l'ouverture de la section <details>
async function onRulesToggle(detailsEl) {
  if (detailsEl.open && !RULES_LOADED) {
    await loadRulesForPanel();
  } else if (detailsEl.open) {
    renderRulesTable();
  }
}

async function loadRulesForPanel() {
  const tbody = document.getElementById('rules-tbody');
  try {
    const cached = FSCache.get('rules');
    if (cached) {
      RULES = cached;
      RULES_LOADED = true;
      window._aiModel = null;
      renderRulesTable();
      return;
    }
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="color:var(--muted);text-align:center;padding:20px">Chargement…</td></tr>';
    const snap = await collectionRef(state.db, 'auto_categorization_rules').orderBy('priority', 'asc').get();
    RULES = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    RULES_LOADED = true;
    FSCache.set('rules', RULES);
    window._aiModel = null;
    renderRulesTable();
  } catch (err) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="color:var(--red);padding:12px">${esc(err.message)}</td></tr>`;
  }
}

function renderRulesTable() {
  const tbody = document.getElementById('rules-tbody');
  if (!tbody) return;
  if (!RULES.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="color:var(--muted);text-align:center;padding:20px">Aucune règle. Cliquez sur "+ Ajouter une règle" pour commencer.</td></tr>';
    return;
  }
  tbody.innerHTML = RULES.map(r => ruleRowHtml(r)).join('');
}

function buildRuleCategoryOptions(selectedValue) {
  let html = '<option value="">— choisir —</option>';
  for (const [group, cats] of Object.entries(CATEGORIES)) {
    html += `<optgroup label="${esc(group)}">`;
    for (const cat of cats) {
      html += `<option value="${esc(cat)}"${cat === selectedValue ? ' selected' : ''}>${esc(cat)}</option>`;
    }
    html += '</optgroup>';
  }
  if (selectedValue && !Object.values(CATEGORIES).flat().includes(selectedValue)) {
    html = `<option value="">— choisir —</option><option value="${esc(selectedValue)}" selected>${esc(selectedValue)}</option>` +
           html.replace('<option value="">— choisir —</option>', '');
  }
  return html;
}

function ruleRowHtml(r) {
  const matchTypes = [
    ['contains',   'Contient'],
    ['exact',      'Exact'],
    ['startsWith', 'Commence par'],
    ['regex',      'Regex'],
  ].map(([v, l]) => `<option value="${v}"${(r.matchType || 'contains') === v ? ' selected' : ''}>${l}</option>`).join('');
  const comptes = [
    ['',         'Tous'],
    ['BforBank', 'BforBank'],
    ['LCL',      'LCL'],
  ].map(([v, l]) => `<option value="${v}"${(r.compte || '') === v ? ' selected' : ''}>${l}</option>`).join('');
  return `<tr data-rule-id="${esc(r.id)}">
    <td style="text-align:center"><input type="number" min="0" max="999" value="${r.priority ?? 10}" class="mapping-input rule-priority" style="width:52px;text-align:center"></td>
    <td><input type="text" value="${esc(r.pattern || '')}" placeholder="ex: netflix" class="mapping-input rule-pattern" style="width:100%"></td>
    <td><select class="mapping-input rule-matchtype" style="width:100%">${matchTypes}</select></td>
    <td><select class="mapping-input rule-categorie" style="width:100%">${buildRuleCategoryOptions(r.categorie || '')}</select></td>
    <td><select class="mapping-input rule-compte" style="width:100%">${comptes}</select></td>
    <td style="text-align:center"><input type="checkbox" class="rule-enabled"${r.enabled !== false ? ' checked' : ''}></td>
    <td style="white-space:nowrap;display:flex;gap:4px">
      <button class="btn" style="padding:4px 8px;font-size:12px" onclick="saveRule('${esc(r.id)}')">Sauver</button>
      <button class="btn" style="padding:4px 8px;font-size:12px;color:var(--red);border-color:var(--red)" onclick="deleteRule('${esc(r.id)}')">✕</button>
    </td>
  </tr>`;
}

function addRuleRow() {
  const maxPriority = RULES.length ? Math.max(...RULES.map(r => r.priority ?? 0)) : 0;
  const tempId = 'new_' + Date.now();
  const newRule = { id: tempId, pattern: '', matchType: 'contains', categorie: '', compte: '', enabled: true, priority: maxPriority + 10 };
  RULES.push(newRule);

  const tbody = document.getElementById('rules-tbody');
  if (!tbody) return;
  if (tbody.querySelector('td[colspan]')) tbody.innerHTML = '';

  const tr = document.createElement('tr');
  tr.dataset.ruleId = tempId;
  tr.innerHTML = ruleRowHtml(newRule).replace(/^<tr[^>]*>\n?/, '').replace(/\n?<\/tr>$/, '');
  tbody.appendChild(tr);
  tr.querySelector('.rule-pattern')?.focus();
}

async function saveRule(ruleId) {
  const tr = document.querySelector(`[data-rule-id="${CSS.escape(ruleId)}"]`);
  if (!tr) return;
  const pattern  = tr.querySelector('.rule-pattern')?.value?.trim();
  const matchType = tr.querySelector('.rule-matchtype')?.value || 'contains';
  const categorie = tr.querySelector('.rule-categorie')?.value || '';
  const compte    = tr.querySelector('.rule-compte')?.value || '';
  const enabled   = tr.querySelector('.rule-enabled')?.checked ?? true;
  const priority  = parseInt(tr.querySelector('.rule-priority')?.value ?? '10', 10);

  if (!pattern)   { toast('Le motif ne peut pas être vide', 'error'); return; }
  if (!categorie) { toast('Sélectionnez une catégorie cible', 'error'); return; }

  const payload = { pattern, matchType, categorie, compte, enabled, priority };

  try {
    let docId;
    if (ruleId.startsWith('new_')) {
      payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      payload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
      const ref = await collectionRef(state.db, 'auto_categorization_rules').add(payload);
      docId = ref.id;
      const idx = RULES.findIndex(r => r.id === ruleId);
      if (idx >= 0) { RULES[idx] = { id: docId, ...payload }; tr.dataset.ruleId = docId; }
    } else {
      payload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
      await collectionRef(state.db, 'auto_categorization_rules').doc(ruleId).set(payload, { merge: true });
      docId = ruleId;
      const idx = RULES.findIndex(r => r.id === ruleId);
      if (idx >= 0) RULES[idx] = { id: docId, ...payload };
    }
    RULES.sort((a, b) => (a.priority ?? 10) - (b.priority ?? 10));
    FSCache.set('rules', RULES); // mettre à jour le cache avec la version locale
    window._aiModel = null;
    renderRulesTable();
    toast('Règle sauvegardée', 'success');
  } catch (err) {
    toast('Erreur : ' + err.message, 'error');
  }
}

async function deleteRule(ruleId) {
  if (!confirm('Supprimer cette règle ?')) return;
  try {
    if (!ruleId.startsWith('new_')) {
      await collectionRef(state.db, 'auto_categorization_rules').doc(ruleId).delete();
    }
    RULES = RULES.filter(r => r.id !== ruleId);
    FSCache.set('rules', RULES); // mettre à jour le cache avec la version locale
    window._aiModel = null;
    renderRulesTable();
    toast('Règle supprimée', 'success');
  } catch (err) {
    toast('Erreur : ' + err.message, 'error');
  }
}

// Vérifie si une règle correspond à une transaction
function matchesRule(rule, tx) {
  if (!rule.enabled) return false;
  if (rule.compte && tx.compte !== rule.compte) return false;
  const libelle = (tx.libelle || '').toLowerCase();
  const pattern = (rule.pattern || '').toLowerCase();
  if (!pattern) return false;
  switch (rule.matchType) {
    case 'exact':      return libelle === pattern;
    case 'startsWith': return libelle.startsWith(pattern);
    case 'regex':
      try { return new RegExp(rule.pattern, 'i').test(tx.libelle || ''); } catch { return false; }
    default:           return libelle.includes(pattern); // contains
  }
}

// Retourne la catégorie suggérée par la première règle correspondante (null si aucune)
// Ne s'applique JAMAIS aux transactions pointées
function getRuleCategory(tx, rules) {
  if (tx.pointe) return null;
  const sorted = [...rules].filter(r => r.enabled !== false).sort((a, b) => (a.priority ?? 10) - (b.priority ?? 10));
  for (const rule of sorted) {
    if (matchesRule(rule, tx)) return rule.categorie;
  }
  return null;
}

// Applique les règles en batch à toutes les transactions non pointées sans catégorie
async function applyRulesToUnpointed() {
  if (!RULES_LOADED) await loadRulesForPanel();
  const enabledRules = RULES.filter(r => r.enabled !== false);
  if (!enabledRules.length) { toast('Aucune règle active définie', 'error'); return; }

  const targets = state.ALL_TX.filter(t => !t.pointe && (!t.categorie || t.categorie === 'A Catégoriser'));
  if (!targets.length) { toast('Aucune transaction non-pointée sans catégorie', 'error'); return; }

  let applied = 0;
  const updates = [];
  let batch = createBatch(state.db);

  for (const tx of targets) {
    const cat = getRuleCategory(tx, enabledRules);
    if (!cat) continue;
    batch.update(collectionRef(state.db, 'transactions').doc(tx.id), { categorie: cat, ruleApplied: true });
    updates.push({ id: tx.id, cat });
    applied++;
    if (applied % 490 === 0) {
      await batch.commit();
      batch = createBatch(state.db);
    }
  }

  if (!applied) {
    toast(`Aucune règle ne correspond aux ${targets.length} transaction(s) non-pointée(s)`, 'error');
    return;
  }

  try {
    await batch.commit();
    for (const u of updates) {
      const tx = state.ALL_TX.find(t => t.id === u.id);
      if (tx) { tx.categorie = u.cat; tx.ruleApplied = true; }
    }
    FSCache.invalidate('transactions', 'transactions_all');
    window._aiModel = null;
    applyFilters();
    renderDashboard();
    toast(`${applied} transaction(s) catégorisée(s) par règles`, 'success');
  } catch (err) {
    toast('Erreur lors de l\'application des règles : ' + err.message, 'error');
  }
}

// Applique une suggestion de règle à une transaction individuelle (clic badge)
async function applyRuleSuggestion(txId, cat) {
  try {
    await collectionRef(state.db, 'transactions').doc(txId).update({ categorie: cat, ruleApplied: true });
    const tx = state.ALL_TX.find(t => t.id === txId);
    if (tx) { tx.categorie = cat; tx.ruleApplied = true; }
    FSCache.invalidate('transactions', 'transactions_all');
    window._aiModel = null;
    applyFilters();
    renderDashboard();
    toast(`Catégorie "${cat}" appliquée par règle`, 'success');
  } catch (err) {
    toast('Erreur : ' + err.message, 'error');
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPARAISON MOIS PAR MOIS — Dashboard
// ══════════════════════════════════════════════════════════════════════════════
let chartCompare = null;

function getAvailableMonths() {
  const months = new Set();
  for (const tx of state.ALL_TX) {
    if (tx.date) months.add(tx.date.slice(0, 7));
  }
  return [...months].sort().reverse();
}

function populateCompareSelects() {
  const months = getAvailableMonths();
  if (months.length < 2) {
    const section = document.getElementById('compare-section');
    if (section) section.style.display = 'none';
    return;
  }

  const selA = document.getElementById('compare-month-a');
  const selB = document.getElementById('compare-month-b');
  if (!selA || !selB) return;

  const opts = months.map(m => `<option value="${m}">${monthKeyLabel(m)}</option>`).join('');
  selA.innerHTML = opts;
  selB.innerHTML = opts;

  // Par défaut : mois en cours vs mois précédent
  selA.value = months[0];
  selB.value = months[1] || months[0];
}

function renderComparison() {
  const selA = document.getElementById('compare-month-a');
  const selB = document.getElementById('compare-month-b');
  if (!selA || !selB) return;

  const monthA = selA.value;
  const monthB = selB.value;
  if (!monthA || !monthB) return;

  const txA = state.ALL_TX.filter(t => t.date && t.date.startsWith(monthA));
  const txB = state.ALL_TX.filter(t => t.date && t.date.startsWith(monthB));

  const depA = txA.filter(t => t.montant < 0).reduce((s, t) => s + Math.abs(t.montant), 0);
  const recA = txA.filter(t => t.montant > 0).reduce((s, t) => s + t.montant, 0);
  const depB = txB.filter(t => t.montant < 0).reduce((s, t) => s + Math.abs(t.montant), 0);
  const recB = txB.filter(t => t.montant > 0).reduce((s, t) => s + t.montant, 0);

  // KPIs comparatifs
  const kpisEl = document.getElementById('compare-kpis');
  if (kpisEl) {
    const deltaDep = depA - depB;
    const deltaRec = recA - recB;
    const deltaSolde = (recA - depA) - (recB - depB);
    const deltaCls = v => v >= 0 ? 'pos' : 'neg';

    kpisEl.innerHTML = `
      <div class="compare-kpi">
        <div class="ck-label">Dépenses</div>
        <div class="ck-row">
          <span class="ck-val" style="color:var(--red)">${fmt(-depA)}</span>
          <span class="ck-prev">vs ${fmt(-depB)}</span>
          <span class="compare-delta ${deltaCls(-deltaDep)}">${deltaDep > 0 ? '+' : ''}${fmt(-deltaDep)}</span>
        </div>
      </div>
      <div class="compare-kpi">
        <div class="ck-label">Recettes</div>
        <div class="ck-row">
          <span class="ck-val" style="color:var(--green)">${fmt(recA)}</span>
          <span class="ck-prev">vs ${fmt(recB)}</span>
          <span class="compare-delta ${deltaCls(deltaRec)}">${deltaRec > 0 ? '+' : ''}${fmt(deltaRec)}</span>
        </div>
      </div>
      <div class="compare-kpi">
        <div class="ck-label">Solde net</div>
        <div class="ck-row">
          <span class="ck-val" style="color:${(recA-depA) >= 0 ? 'var(--green)' : 'var(--red)'}">${fmt(recA - depA)}</span>
          <span class="ck-prev">vs ${fmt(recB - depB)}</span>
          <span class="compare-delta ${deltaCls(deltaSolde)}">${deltaSolde > 0 ? '+' : ''}${fmt(deltaSolde)}</span>
        </div>
      </div>
    `;
  }

  // Graphique de comparaison par catégorie
  const cats = new Set();
  const byCatA = {};
  const byCatB = {};

  txA.filter(t => t.montant < 0).forEach(t => {
    const cat = t.categorie || 'Non catégorisé';
    cats.add(cat);
    byCatA[cat] = (byCatA[cat] || 0) + Math.abs(t.montant);
  });
  txB.filter(t => t.montant < 0).forEach(t => {
    const cat = t.categorie || 'Non catégorisé';
    cats.add(cat);
    byCatB[cat] = (byCatB[cat] || 0) + Math.abs(t.montant);
  });

  const sortedCats = [...cats].sort((a, b) => ((byCatA[b] || 0) + (byCatB[b] || 0)) - ((byCatA[a] || 0) + (byCatB[a] || 0)));
  // Limiter à 15 catégories pour la lisibilité
  const topCats = sortedCats.slice(0, 15);

  const ctx = document.getElementById('chart-compare');
  if (!ctx) return;

  if (chartCompare) chartCompare.destroy();

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

  chartCompare = new Chart(ctx.getContext('2d'), {
    type: 'bar',
    data: {
      labels: topCats,
      datasets: [
        {
          label: monthKeyLabel(monthA),
          data: topCats.map(c => +(byCatA[c] || 0).toFixed(2)),
          backgroundColor: isDark ? 'rgba(91,156,246,.6)' : 'rgba(59,130,246,.6)',
          borderColor: isDark ? '#5b9cf6' : '#3b82f6',
          borderWidth: 1.5,
          borderRadius: 3,
        },
        {
          label: monthKeyLabel(monthB),
          data: topCats.map(c => +(byCatB[c] || 0).toFixed(2)),
          backgroundColor: isDark ? 'rgba(248,113,113,.5)' : 'rgba(239,68,68,.5)',
          borderColor: isDark ? '#f87171' : '#ef4444',
          borderWidth: 1.5,
          borderRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 12 } } },
        tooltip: {
          callbacks: {
            label: c => ` ${c.dataset.label}: ${fmt(c.raw)}`,
            afterBody: (items) => {
              if (items.length < 2) return '';
              const valA = items[0]?.raw || 0;
              const valB = items[1]?.raw || 0;
              if (valB === 0) return '';
              const diff = valA - valB;
              const pct = ((diff / valB) * 100).toFixed(0);
              return `Δ ${diff >= 0 ? '+' : ''}${fmt(diff)} (${pct}%)`;
            },
          },
        },
      },
      scales: {
        x: { ticks: { maxRotation: 45, font: { size: 10 } } },
        y: { ticks: { callback: v => fmt(v) } },
      },
    },
  });
}

// ── Hook les nouvelles fonctions dans le cycle de rendu existant ──

// Sauvegarder les fonctions originales pour les étendre
const _originalApplyFilters = applyFilters;
const _originalRenderDashboard = renderDashboard;

// Étendre applyFilters pour mettre à jour la barre IA + récurrentes
applyFilters = function() {
  _originalApplyFilters();
  window._aiModel = null; // Invalider le cache modèle IA
  renderAiBar();
  renderRecurringTransactions();
};

// Étendre renderDashboard pour mettre à jour la comparaison
renderDashboard = function() {
  _originalRenderDashboard();
  populateCompareSelects();
  renderComparison();
  if (typeof window.renderInsightsFeed === 'function') {
    window.renderInsightsFeed();
  }
};

// ── Tronity HP/HC config ────────────────────────────────────────────────────

function _tronityTimeInput(h, m) {
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return `<input type="time" value="${hh}:${mm}"
    style="padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text);font-size:13px">`;
}

function addTronityPlage(start_h = 22, start_m = 0, end_h = 6, end_m = 0) {
  const tbody = document.getElementById('tronity-plages-tbody');
  if (!tbody) return;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>${_tronityTimeInput(start_h, start_m)}</td>
    <td>${_tronityTimeInput(end_h, end_m)}</td>
    <td><button class="btn" type="button" style="background:var(--danger,#ef4444);color:#fff;font-size:12px;padding:4px 10px"
        onclick="this.closest('tr').remove()">Supprimer</button></td>`;
  tbody.appendChild(tr);
}

function _parseTronityRows() {
  const tbody = document.getElementById('tronity-plages-tbody');
  if (!tbody) return [];
  const plages = [];
  for (const tr of tbody.querySelectorAll('tr')) {
    const inputs = tr.querySelectorAll('input[type=time]');
    if (inputs.length < 2) continue;
    const [sh, sm] = inputs[0].value.split(':').map(Number);
    const [eh, em] = inputs[1].value.split(':').map(Number);
    if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) continue;
    plages.push({ start_h: sh, start_m: sm, end_h: eh, end_m: em });
  }
  return plages;
}

function _csvEscape(value) {
  const s = String(value ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function _flattenRawForCsv(value) {
  if (value == null) return '';
  if (typeof value === 'object') {
    try { return JSON.stringify(value); } catch (_) { return String(value); }
  }
  return String(value);
}

async function downloadTronityRawCsv() {
  if (!state.db) return;
  const status = document.getElementById('tronity-config-status');
  try {
    const snap = await collectionRef(state.db, 'transactions').where('source', '==', 'tronity').get();
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const withRaw = docs.filter(tx => tx.tronity_raw && typeof tx.tronity_raw === 'object');
    if (!withRaw.length) {
      toast('Aucune donnée brute Tronity trouvée.', 'error');
      if (status) status.textContent = 'Aucune transaction Tronity avec payload brut.';
      return;
    }

    const rawKeys = new Set();
    withRaw.forEach(tx => Object.keys(tx.tronity_raw || {}).forEach(k => rawKeys.add(k)));
    const sortedRawKeys = [...rawKeys].sort();
    const headers = ['transaction_id', 'date', 'libelle', 'compte', 'montant', ...sortedRawKeys];
    const lines = [headers.map(_csvEscape).join(',')];

    withRaw.forEach(tx => {
      const base = [tx.id, tx.date || '', tx.libelle || '', tx.compte || '', tx.montant ?? ''];
      const rawCols = sortedRawKeys.map(k => _flattenRawForCsv((tx.tronity_raw || {})[k]));
      lines.push([...base, ...rawCols].map(_csvEscape).join(','));
    });

    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tronity-raw-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast(`CSV téléchargé (${withRaw.length} lignes).`, 'success');
    if (status) status.textContent = `CSV téléchargé : ${withRaw.length} ligne(s)`;
  } catch (e) {
    toast('Erreur export CSV Tronity : ' + e.message, 'error');
    if (status) status.textContent = 'Erreur export CSV : ' + e.message;
  }
}

async function loadTronityConfig() {
  const status = document.getElementById('tronity-config-status');
  try {
    const doc = await collectionRef(state.db, 'config').doc('tronity').get();
    const data = doc.exists ? doc.data() : {};
    document.getElementById('tronity-tarif-hp').value = data.tarif_hp ?? 0.2470;
    document.getElementById('tronity-tarif-hc').value = data.tarif_hc ?? 0.1941;
    document.getElementById('tronity-network-loss-percent').value = data.network_loss_percent ?? 7.0;
    document.getElementById('tronity-import-scope').value = data.import_scope === 'home' ? 'home' : 'all';
    document.getElementById('tronity-save-raw-api').checked = Boolean(data.save_raw_api_payload);
    const tbody = document.getElementById('tronity-plages-tbody');
    if (tbody) tbody.innerHTML = '';
    const plages = data.hc_plages && data.hc_plages.length
      ? data.hc_plages
      : [{ start_h: 22, start_m: 0, end_h: 6, end_m: 0 }];
    plages.forEach(p => addTronityPlage(p.start_h, p.start_m, p.end_h, p.end_m));
    if (status) status.textContent = doc.exists
      ? `Chargé depuis Firestore (mis à jour le ${data.updatedAt?.toDate?.()?.toLocaleString('fr-FR') ?? '?'})`
      : 'Valeurs par défaut (aucune config enregistrée)';
  } catch (e) {
    if (status) status.textContent = 'Erreur de chargement : ' + e.message;
  }
}

async function saveTronityConfig() {
  const status = document.getElementById('tronity-config-status');
  const tarif_hp = parseFloat(document.getElementById('tronity-tarif-hp').value);
  const tarif_hc = parseFloat(document.getElementById('tronity-tarif-hc').value);
  const network_loss_percent = parseFloat(document.getElementById('tronity-network-loss-percent').value);
  const import_scope = document.getElementById('tronity-import-scope').value === 'home' ? 'home' : 'all';
  const save_raw_api_payload = Boolean(document.getElementById('tronity-save-raw-api').checked);
  if (isNaN(tarif_hp) || isNaN(tarif_hc) || tarif_hp <= 0 || tarif_hc <= 0) {
    toast('Tarifs invalides — vérifie les valeurs HP et HC.', 'error'); return;
  }
  if (isNaN(network_loss_percent) || network_loss_percent <= -100 || network_loss_percent >= 100) {
    toast('Correction pertes réseau invalide — la valeur doit être strictement entre -100 et 100.', 'error'); return;
  }
  const hc_plages = _parseTronityRows();
  if (hc_plages.length === 0) {
    toast('Ajoute au moins une plage HC.', 'error'); return;
  }
  try {
    await collectionRef(state.db, 'config').doc('tronity').set({
      tarif_hp, tarif_hc, network_loss_percent, import_scope, hc_plages, save_raw_api_payload,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    toast('Paramètres Tronity enregistrés.', 'success');
    if (status) status.textContent = `Enregistré le ${new Date().toLocaleString('fr-FR')}`;
  } catch (e) {
    toast('Erreur lors de la sauvegarde : ' + e.message, 'error');
  }
}

// Chargement automatique quand on ouvre le panel Tronity
const _origScrollToPanel = scrollToPanel;
scrollToPanel = function(name) {
  _origScrollToPanel(name);
  if (name === 'tronity') loadTronityConfig();
};


// --- BINDINGS GLOBAUX ---
// Expose les fonctions au HTML (car les modules isolent le scope)
window.setLoaderMsg = setLoaderMsg;
window.refreshTransactionsFromEmails = refreshTransactionsFromEmails;
window.requestFullMailScan = requestFullMailScan;
window.renderBalancesPanel = renderBalancesPanel;
window.buildBalanceMismatchFingerprint = buildBalanceMismatchFingerprint;
window.acknowledgeBalanceMismatch = acknowledgeBalanceMismatch;
window.rerunBalanceCheck = rerunBalanceCheck;
window.renderTopBalances = renderTopBalances;
window.renderDashboard = renderDashboard;
window.normalizedDashboardCategory = normalizedDashboardCategory;
window.getDashboardCategoryNames = getDashboardCategoryNames;
window.loadDashboardCategorySelection = loadDashboardCategorySelection;
window.saveDashboardCategorySelection = saveDashboardCategorySelection;
window.syncDashboardCategories = syncDashboardCategories;
window.renderDashboardCategoryFilters = renderDashboardCategoryFilters;
window.onDashboardCategoryAll = onDashboardCategoryAll;
window.onDashboardCategoryNone = onDashboardCategoryNone;
window.onDashboardCategoryToggle = onDashboardCategoryToggle;
window.getAssignedMonthKey = getAssignedMonthKey;
window.showRavIncomes = showRavIncomes;
window.showRavExpenses = showRavExpenses;
window.showRavProvisions = showRavProvisions;
window.getAssignedYear = getAssignedYear;
window.isPointedTransaction = isPointedTransaction;
window.currentMonthKey = currentMonthKey;
window.monthKeyLabel = monthKeyLabel;
window.getDashboardRange = getDashboardRange;
window.periodLabel = periodLabel;
window.dashboardFilteredTransactions = dashboardFilteredTransactions;
window.updateDashboardPeriodUi = updateDashboardPeriodUi;
window.shiftDashboardMonth = shiftDashboardMonth;
window.onDashboardCustomDateChange = onDashboardCustomDateChange;
window.onDashboardPeriodChange = onDashboardPeriodChange;
window.monthlyAggregation = monthlyAggregation;
window.buildMonthlyChart = buildMonthlyChart;
window.buildCategoriesChart = buildCategoriesChart;
window.buildCumulChart = buildCumulChart;
window.applyDefaultMonthFilter = applyDefaultMonthFilter;
window.resetFilters = resetFilters;
window.getSortableValue = getSortableValue;
window.sortBy = sortBy;
window.buildYearFilter = buildYearFilter;
window.buildCategoryFilter = buildCategoryFilter;
window.openChartPopup = openChartPopup;
window.openBudgetOverrunPopup = openBudgetOverrunPopup;
window.openDetailFromChartPopup = openDetailFromChartPopup;
window.closeChartPopup = closeChartPopup;
window.loadLinxoMappings = loadLinxoMappings;
window.mappingBudgetOptions = mappingBudgetOptions;
window.collectLinxoCategoriesFromHistory_ = collectLinxoCategoriesFromHistory_;
window.renderMappings = renderMappings;
window.updateMappingField = updateMappingField;
window.addMappingRow = addMappingRow;
window.seedMappingsFromHistory = seedMappingsFromHistory;
window.deleteMapping = deleteMapping;
window.loadReparseData = loadReparseData;
window.renderReparseEmails = renderReparseEmails;
window.renderFullScanProgress = renderFullScanProgress;
window.renderReparseJobs = renderReparseJobs;
window.submitReparseJob = submitReparseJob;
window.loadExcludedEmails = loadExcludedEmails;
window.renderExcludedEmails = renderExcludedEmails;
window.addExcludedEmail = addExcludedEmail;
window.addExcludedEmailManual = addExcludedEmailManual;
window.removeExcludedEmail = removeExcludedEmail;
window._allKnownCategories = _allKnownCategories;
window.renderFusionTable = renderFusionTable;
window.setFusionAssignment = setFusionAssignment;
window._updateFusionUI = _updateFusionUI;
window.applyFusions = applyFusions;
window.loadFusions = loadFusions;
window.loadCategoryStyles = loadCategoryStyles;
window.openCategoryStyleModal = openCategoryStyleModal;
window.closeCategoryStyleModal = closeCategoryStyleModal;
window.selectStyleIcon = selectStyleIcon;
window.searchOnlineIcons = searchOnlineIcons;
window.selectOnlineIcon = selectOnlineIcon;
window.selectStyleColor = selectStyleColor;
window.saveCategoryStyle = saveCategoryStyle;
window.resetCategoryStyle = resetCategoryStyle;
window.getInitialPanel = getInitialPanel;
window.scrollToPanel = scrollToPanel;
window.closeAdvancedMenus = closeAdvancedMenus;
window.toggleAdvancedDropdown = toggleAdvancedDropdown;
window.toggleMobileAdvancedDropdown = toggleMobileAdvancedDropdown;
window.initMobileAdvancedButtonFallback = initMobileAdvancedButtonFallback;
window.openAdvancedTarget = openAdvancedTarget;
window.syncMobileSearch = syncMobileSearch;
window.openFilterSheet = openFilterSheet;
window.closeFilterSheet = closeFilterSheet;
window.applyFilterSheet = applyFilterSheet;
window.resetFiltersSheet = resetFiltersSheet;
window.updateFilterBadge = updateFilterBadge;
window.deleteFromDetail = deleteFromDetail;
window.addDetailToRecurring = addDetailToRecurring;
window.toast = toast;
window.fmt = fmt;
window.esc = esc;
window.escJs = escJs;
window.setText = setText;
window.hideLoader = hideLoader;
window.setStatus = setStatus;
window.captureError = captureError;
window.onStatusClick = onStatusClick;
window.showError = showError;
window.loadReviewedDuplicatePairs = loadReviewedDuplicatePairs;
window.saveReviewedDuplicatePairs = saveReviewedDuplicatePairs;
window.dupPairKey = dupPairKey;
window.detectDuplicatePairs = detectDuplicatePairs;
window.openDuplicatesModal = openDuplicatesModal;
window.closeDuplicatesModal = closeDuplicatesModal;
window.dismissAllDuplicatePairs = dismissAllDuplicatePairs;
window.renderDuplicatePairHtml = renderDuplicatePairHtml;
window.toggleDupMark = toggleDupMark;
window.updateDeleteMarkedBtn = updateDeleteMarkedBtn;
window.deleteAllMarkedDups = deleteAllMarkedDups;
window.dismissDuplicatePair = dismissDuplicatePair;
window.detectRecurringTransactions = detectRecurringTransactions;
window.renderRecurringTransactions = renderRecurringTransactions;
window.toggleRecurringList = toggleRecurringList;
window.getRecurringKey = getRecurringKey;
window.loadRecurringSettings = loadRecurringSettings;
window.loadRavConfig = loadRavConfig;
window.saveRavConfig = saveRavConfig;
window.renderRavCategorySelector = renderRavCategorySelector;
window._saveRecurringSetting = _saveRecurringSetting;
window.acceptRecurring = acceptRecurring;
window.rejectRecurring = rejectRecurring;
window.openRecurringEdit = openRecurringEdit;
window.closeRecurringEdit = closeRecurringEdit;
window.saveRecurringEdit = saveRecurringEdit;
window.buildCategoryModel = buildCategoryModel;
window.suggestCategory = suggestCategory;
window.getUncategorizedTransactions = getUncategorizedTransactions;
window.renderAiBar = renderAiBar;
window.aiCategorizeAll = aiCategorizeAll;
window.aiSuggestBadgeHtml = aiSuggestBadgeHtml;
window.aiApplySuggestion = aiApplySuggestion;
window.loadRulesQuiet = loadRulesQuiet;
window.onRulesToggle = onRulesToggle;
window.loadRulesForPanel = loadRulesForPanel;
window.renderRulesTable = renderRulesTable;
window.buildRuleCategoryOptions = buildRuleCategoryOptions;
window.ruleRowHtml = ruleRowHtml;
window.addRuleRow = addRuleRow;
window.saveRule = saveRule;
window.deleteRule = deleteRule;
window.matchesRule = matchesRule;
window.getRuleCategory = getRuleCategory;
window.applyRulesToUnpointed = applyRulesToUnpointed;
window.applyRuleSuggestion = applyRuleSuggestion;
window.loadPlacements = loadPlacements;
window.patrimoineComputeTotals = patrimoineComputeTotals;
window.renderPatrimoine = renderPatrimoine;
window.renderPatrimoineCourants = renderPatrimoineCourants;
window.renderPatrimoinePlacements = renderPatrimoinePlacements;
window.renderSavingsBalances = renderSavingsBalances;
window.openPatrimoineDetails = openPatrimoineDetails;
window.openAddPlacementModal = openAddPlacementModal;
window.closeAddPlacementModal = closeAddPlacementModal;
window.submitAddPlacement = submitAddPlacement;
window.openEditPlacementModal = openEditPlacementModal;
window.closeEditPlacementModal = closeEditPlacementModal;
window.submitEditPlacement = submitEditPlacement;
window.deletePlacement = deletePlacement;
window.snapshotPlacements = snapshotPlacements;
window.buildPatrimoineRepartitionChart = buildPatrimoineRepartitionChart;
window.buildPatrimoineEvolutionChart = buildPatrimoineEvolutionChart;
window.portfolioTimestampMs = portfolioTimestampMs;
window.portfolioHoldingScore = portfolioHoldingScore;
window.isBetterPortfolioHolding = isBetterPortfolioHolding;
window.dedupePortfolioHoldings = dedupePortfolioHoldings;
window.loadPortfolioHoldings = loadPortfolioHoldings;
window.getFilteredHoldings = getFilteredHoldings;
window.portfolioHoldingMatchesFilters = portfolioHoldingMatchesFilters;
window.aggregatePortfolioHoldingsByOwner = aggregatePortfolioHoldingsByOwner;
window.renderPortfolioFilters = renderPortfolioFilters;
window.onPortfolioFilterChange = onPortfolioFilterChange;
window.pfRowKey = pfRowKey;
window.toggleAccountGroup = toggleAccountGroup;
window.toggleHoldingDetail = toggleHoldingDetail;
window.renderPortfolioSummary = renderPortfolioSummary;
window.renderPortfolioHoldingsTable = renderPortfolioHoldingsTable;
window.getAvailableMonths = getAvailableMonths;
window.populateCompareSelects = populateCompareSelects;
window.renderComparison = renderComparison;
window._tronityTimeInput = _tronityTimeInput;
window.addTronityPlage = addTronityPlage;
window._parseTronityRows = _parseTronityRows;
window.loadTronityConfig = loadTronityConfig;
window.saveTronityConfig = saveTronityConfig;
window.downloadTronityRawCsv = downloadTronityRawCsv;
window.importLatestTronityCharges = importLatestTronityCharges;
window.addOwner = addOwner;
window.removeOwner = removeOwner;
window.addAccountRow = addAccountRow;
window.removeAccountRow = removeAccountRow;
window.addSavingRow = addSavingRow;
window.removeSavingRow = removeSavingRow;
