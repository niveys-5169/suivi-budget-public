// =============================================================================
// IMPORT LINXO EMAIL (Gmail) → Google Sheets "Dépenses catégorisée"
// v6.3 — FIX CIBLE CLASSEUR + LOCK + POST-CHECK + SANS ÉCRITURE COLONNE H
//
// ✅ Objectif v6.3 (suite à ton erreur de validation Hxxxx) :
// - NE JAMAIS ÉCRIRE EN COLONNE H (Catégorie) pour éviter tout blocage de validation.
// - On met la catégorie "proposée" uniquement dans la COLONNE J (Commentaires) pour que tu puisses la saisir à la main.
// - Contrainte maintenue : NE JAMAIS ÉCRIRE EN COLONNE B (Mois).
// - Lock global anti-concurrence + post-check sur D (libellé) + F (montant).
//
// PRÉREQUIS (Drive API) : seulement si tu veux archivage EML + CSV audit via Drive.Files.*
// =============================================================================


// ─── CONFIG ──────────────────────────────────────────────────────────────────
const CONFIG = {
  // ✅ ID du classeur Google Sheets (entre /d/ et /edit dans l’URL)
  SPREADSHEET_ID: 'A_REMPLACER_PAR_TON_ID',

  SHEET_DEPENSES: 'Dépenses catégorisée',
  SHEET_MAPPING: 'Mapping Catégories Linxo',
  SHEET_PROJECTION: 'Projection fin de mois',
  SHEET_PROJECTION_REGLES: 'Règles projection récurrentes',

  DOSSIER_DRIVE: 'Linxo Imports',
  SOUS_DOSSIER_DRIVE: 'Importés',

  PREMIERE_LIGNE_DATA: 4,

  // Colonnes de la feuille (1-indexé)
  COL: {
    DATE: 1,           // A
    MOIS: 2,           // B (⚠️ INTERDIT D'ÉCRITURE)
    INDEX: 3,          // C
    LIBELLE: 4,        // D
    COMPTE: 5,         // E
    MONTANT: 6,        // F
    REMBOURSEMENT: 7,  // G (jamais touché)
    CATEGORIE: 8,      // H (⚠️ NE PAS ÉCRIRE)
    POINTE: 9,         // I (jamais touché)
    COMMENTAIRES: 10,  // J
  },

  COMPTES_ACTIFS: {
    'BforBank Compte Courant': 'BforBank',
    'LCL Compte Joint': 'LCL',
  },

  // Catégories Linxo à recatégoriser manuellement (on n'écrit pas H, on met un warning en J)
  CATEGORIES_IGNOREES: [
    'Virements internes',
    'Virements à catégoriser',
    'Intérêts',
  ],

  // Gmail
  GMAIL_FROM: 'assistance@linxo.com',
  GMAIL_SUBJECT_CONTAINS: 'Notification',
  GMAIL_LABEL_TRAITE:   'Linxo_Importé_Sheets', // Chemin Sheets — Apps Script (temporaire)
  GMAIL_LABEL_FIREBASE: 'Linxo_Importé',         // Chemin Firebase — Python (permanent)
  GMAIL_NEWER_THAN_DAYS: 30,

  // Trigger
  TRIGGER_HOUR: 6,
  TRIGGER_NEAR_MINUTE: 55,

  // Limites
  MAX_EMAILS_PAR_BATCH: 120,
  MAX_TRANSACTIONS_PAR_EMAIL: 200,
  TIMEOUT_MS: 270000, // 4min30

  // Validation montants
  MONTANT_MIN: -50000,
  MONTANT_MAX: 50000,

  // Dédoublonnage
  LIBELLE_DEDOUBLONNAGE_MAX_LEN: 40,

  // Comportement catégories ignorées (stockées en commentaire uniquement)
  EMPTY_CATEGORY_WHEN_IGNORED: true,

  // Rapprochement Google Sheets <-> Firebase
  FIREBASE_PROJECT_ID: 'A_REMPLACER_PAR_PROJECT_ID_FIREBASE',
  FIREBASE_COLLECTION_TRANSACTIONS: 'transactions',
  SHEET_RAPPROCHEMENT: 'Écarts Sheets Firebase',
  FIREBASE_COLLECTION_RAPPROCHEMENT: 'reconciliation_reports',
};

// Immutabilité
Object.freeze(CONFIG.COL);
Object.freeze(CONFIG.COMPTES_ACTIFS);
Object.freeze(CONFIG.CATEGORIES_IGNOREES);
Object.freeze(CONFIG);


// ─── LOGGING STRUCTURÉ ───────────────────────────────────────────────────────
function logImport_(level, message, data) {
  const ts = Utilities.formatDate(new Date(), 'Europe/Paris', 'yyyy-MM-dd HH:mm:ss');
  let entry = '[' + ts + '] [' + level + '] ' + message;
  if (data && Object.keys(data).length > 0) entry += ' | ' + JSON.stringify(data);
  Logger.log(entry);
}


// ─── MENU ────────────────────────────────────────────────────────────────────
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🏦 Linxo')
    .addItem('📩 Importer depuis Gmail (emails Linxo)', 'importerDepuisGmail_UI')
    .addItem('📈 Projection fin de mois (dépenses récurrentes)', 'genererProjectionFinDeMois_UI')
    .addItem('⚙️ Paramétrer récurrences de projection', 'initialiserReglesProjection_UI')
    .addItem('♻️ Reparser / réuploader un email Linxo…', 'ouvrirReparseEmailDialog_UI')
    .addSeparator()
    .addItem('⏰ Installer trigger quotidien', 'installerTriggerQuotidien')
    .addItem('🧹 Reset "déjà traité" (Message IDs) (DANGER)', 'resetProcessedStore_UI')
    .addSeparator()
    .addItem('🔄 Rafraîchir le mapping catégories', 'creerOuMettreAJourMapping')
    .addItem('🔍 Vérifier & fusionner les catégories', 'verifierEtFusionnerCategories_UI')
    .addItem('⚡ Appliquer les fusions de catégories', 'appliquerFusionCategories_UI')
    .addSeparator()
    .addItem('🧪 Test Drive API (création fichier)', 'debugDriveApi_')
    .addToUi();
}


function initialiserReglesProjection_UI() {
  const ui = SpreadsheetApp.getUi();
  if (!CONFIG.SPREADSHEET_ID || CONFIG.SPREADSHEET_ID === 'A_REMPLACER_PAR_TON_ID') {
    ui.alert('❌ CONFIG.SPREADSHEET_ID non renseigné.');
    return;
  }

  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  obtenirOuInitialiserOngletReglesProjection_(ss);
  ui.alert('✅ Onglet de paramétrage prêt', 'Tu peux maintenant ajuster les transactions récurrentes (hebdomadaire, mensuelle, annuelle) et définir une date de fin optionnelle dans "' + CONFIG.SHEET_PROJECTION_REGLES + '".', ui.ButtonSet.OK);
}

function genererProjectionFinDeMois_UI() {
  const ui = SpreadsheetApp.getUi();
  const msg = genererProjectionFinDeMois_();
  ui.alert(msg.startsWith('❌') ? '❌ Projection en erreur' : '✅ Projection terminée', msg, ui.ButtonSet.OK);
}

function genererProjectionFinDeMois_() {
  if (!CONFIG.SPREADSHEET_ID || CONFIG.SPREADSHEET_ID === 'A_REMPLACER_PAR_TON_ID') {
    return '❌ CONFIG.SPREADSHEET_ID non renseigné.';
  }

  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const depenses = ss.getSheetByName(CONFIG.SHEET_DEPENSES);
  if (!depenses) return '❌ Onglet "' + CONFIG.SHEET_DEPENSES + '" introuvable.';

  const start = CONFIG.PREMIERE_LIGNE_DATA;
  const lastRow = depenses.getLastRow();
  if (lastRow < start) return '❌ Aucune transaction à analyser.';

  const rows = depenses.getRange(start, 1, lastRow - start + 1, CONFIG.COL.COMMENTAIRES).getValues();
  const now = new Date();
  const nowParis = new Date(Utilities.formatDate(now, 'Europe/Paris', 'yyyy-MM-dd') + 'T00:00:00');
  const currentMonthKey = Utilities.formatDate(nowParis, 'Europe/Paris', 'yyyy-MM');

  const autoRulesMap = construireReglesAutoProjection_(rows, nowParis);
  const manualRules = chargerReglesProjectionRecurrentes_(ss);
  const projectionRules = fusionnerReglesProjection_(autoRulesMap, manualRules);

  const depensesActuelles = calculerDepensesActuellesMois_(rows, currentMonthKey);
  const depensesRestantes = estimerDepensesRestantesDepuisRegles_(projectionRules, rows, nowParis);
  const projectionFinDeMois = depensesActuelles + depensesRestantes;

  ecrireProjectionFinDeMois_(ss, nowParis, depensesActuelles, depensesRestantes, projectionFinDeMois, projectionRules, rows);

  return [
    'Projection de fin de mois générée.',
    '• Dépenses du mois en cours: ' + formatMontantEur_(depensesActuelles),
    '• Dépenses récurrentes restantes estimées: ' + formatMontantEur_(depensesRestantes),
    '• Projection fin de mois: ' + formatMontantEur_(projectionFinDeMois),
    '• Règles de projection actives: ' + projectionRules.length,
    '• Onglet projection: "' + CONFIG.SHEET_PROJECTION + '"',
    '• Onglet paramétrage: "' + CONFIG.SHEET_PROJECTION_REGLES + '"',
  ].join('\n');
}

function construireReglesAutoProjection_(rows, nowParis) {
  const previousMonths = listerMoisCompletsAvant_(nowParis, 6);
  const recurringCandidates = new Map();

  for (const row of rows) {
    const date = parseDateSheet_(row[CONFIG.COL.DATE - 1]);
    const montant = parseMontant_(row[CONFIG.COL.MONTANT - 1]);
    const libelle = String(row[CONFIG.COL.LIBELLE - 1] || '').trim();
    const compte = String(row[CONFIG.COL.COMPTE - 1] || '').trim();
    if (!date || montant === null || !libelle || montant >= 0) continue;

    const monthKey = Utilities.formatDate(date, 'Europe/Paris', 'yyyy-MM');
    if (previousMonths.indexOf(monthKey) === -1) continue;

    const day = Number(Utilities.formatDate(date, 'Europe/Paris', 'd'));
    const txKey = normaliserCleProjection_(libelle, compte);
    const bucket = recurringCandidates.get(txKey) || {
      key: txKey,
      libelle,
      compte,
      months: new Set(),
      amounts: [],
      days: [],
    };
    bucket.months.add(monthKey);
    bucket.amounts.push(Math.abs(montant));
    bucket.days.push(day);
    recurringCandidates.set(txKey, bucket);
  }

  const out = new Map();
  for (const [txKey, item] of recurringCandidates.entries()) {
    if (item.months.size < 2) continue;

    out.set(txKey, {
      key: txKey,
      libelle: item.libelle,
      compte: item.compte,
      actif: true,
      periodicite: 'mensuelle',
      montantPrevu: -arrondir2_(moyenne_(item.amounts)),
      jourPrevu: Math.max(1, Math.min(31, Math.round(moyenne_(item.days)))),
      finLe: '',
      source: 'auto',
      frequenceHistorique: item.months.size,
    });
  }
  return out;
}

function chargerReglesProjectionRecurrentes_(ss) {
  const sh = obtenirOuInitialiserOngletReglesProjection_(ss);
  const lastRow = sh.getLastRow();
  const out = [];
  if (lastRow < 2) return out;

  const values = sh.getRange(2, 1, lastRow - 1, 9).getValues();
  for (const row of values) {
    const actifRaw = row[0];
    const libelle = String(row[1] || '').trim();
    const compte = String(row[2] || '').trim();
    const periodicite = normaliserPeriodicite_(row[3]);
    const montant = parseMontant_(row[4]);
    const jour = parseJourRegle_(row[5]);
    const moisAnnuel = parseMoisAnnuelRegle_(row[6]);
    const finLe = parseDateSheet_(row[7]);

    if (!libelle || montant === null) continue;

    out.push({
      key: normaliserCleProjection_(libelle, compte),
      libelle,
      compte,
      actif: actifRaw === '' ? true : Boolean(actifRaw),
      periodicite,
      montantPrevu: montant > 0 ? -Math.abs(montant) : montant,
      jourPrevu: jour,
      finLe: finLe ? Utilities.formatDate(finLe, 'Europe/Paris', 'yyyy-MM-dd') : '',
      source: 'manuel',
      frequenceHistorique: '',
      moisAnnuel,
      commentaire: String(row[8] || '').trim(),
    });
  }
  return out;
}

function fusionnerReglesProjection_(autoRulesMap, manualRules) {
  const out = new Map(autoRulesMap);
  for (const rule of manualRules) {
    out.set(rule.key, rule);
  }
  return Array.from(out.values()).filter(function (rule) { return rule.actif; });
}

function calculerDepensesActuellesMois_(rows, currentMonthKey) {
  let depensesActuelles = 0;
  for (const row of rows) {
    const date = parseDateSheet_(row[CONFIG.COL.DATE - 1]);
    const montant = parseMontant_(row[CONFIG.COL.MONTANT - 1]);
    if (!date || montant === null || montant >= 0) continue;
    const monthKey = Utilities.formatDate(date, 'Europe/Paris', 'yyyy-MM');
    if (monthKey === currentMonthKey) depensesActuelles += montant;
  }
  return depensesActuelles;
}

function estimerDepensesRestantesDepuisRegles_(rules, rows, nowParis) {
  const currentMonthKey = Utilities.formatDate(nowParis, 'Europe/Paris', 'yyyy-MM');
  const currentDay = Number(Utilities.formatDate(nowParis, 'Europe/Paris', 'd'));
  const totalDaysMonth = Number(Utilities.formatDate(new Date(nowParis.getFullYear(), nowParis.getMonth() + 1, 0), 'Europe/Paris', 'd'));

  const occurrences = construireOccurencesMoisCourant_(rows, currentMonthKey);
  let total = 0;

  for (const rule of rules) {
    if (rule.finLe) {
      const fin = parseDateISO_(rule.finLe);
      if (fin && fin < nowParis) continue;
    }

    const txKey = rule.key;
    const occur = occurrences.get(txKey) || [];

    if (rule.periodicite === 'annuelle') {
      const moisAnnuel = rule.moisAnnuel || (occur.length > 0 ? Number(Utilities.formatDate(occur[0], 'Europe/Paris', 'M')) : 0);
      const currentMonth = Number(Utilities.formatDate(nowParis, 'Europe/Paris', 'M'));
      if (moisAnnuel && moisAnnuel !== currentMonth) continue;
      const eventDate = calculerDateOccurrenceAnnuelle_(nowParis, rule.jourPrevu);
      if (!eventDate || eventDate < nowParis) continue;
      if (occur.length > 0) continue;
      total += rule.montantPrevu;
      continue;
    }

    if (rule.periodicite === 'hebdomadaire') {
      const remainingWeeks = Math.max(0, Math.floor((totalDaysMonth - currentDay) / 7) + 1);
      const dejaCeMois = occur.length;
      const reste = Math.max(0, remainingWeeks - dejaCeMois);
      total += rule.montantPrevu * reste;
      continue;
    }

    const jourCible = rule.jourPrevu || currentDay;
    if (jourCible < currentDay) continue;
    if (occur.length > 0) continue;
    total += rule.montantPrevu;
  }

  return arrondir2_(total);
}

function construireOccurencesMoisCourant_(rows, currentMonthKey) {
  const out = new Map();
  for (const row of rows) {
    const date = parseDateSheet_(row[CONFIG.COL.DATE - 1]);
    const montant = parseMontant_(row[CONFIG.COL.MONTANT - 1]);
    const libelle = String(row[CONFIG.COL.LIBELLE - 1] || '').trim();
    const compte = String(row[CONFIG.COL.COMPTE - 1] || '').trim();
    if (!date || montant === null || montant >= 0 || !libelle) continue;

    const monthKey = Utilities.formatDate(date, 'Europe/Paris', 'yyyy-MM');
    if (monthKey !== currentMonthKey) continue;

    const txKey = normaliserCleProjection_(libelle, compte);
    const list = out.get(txKey) || [];
    list.push(date);
    out.set(txKey, list);
  }
  return out;
}

function calculerDateOccurrenceAnnuelle_(nowParis, jourPrevu) {
  const currentYear = nowParis.getFullYear();
  const currentMonth = nowParis.getMonth();
  const maxDay = new Date(currentYear, currentMonth + 1, 0).getDate();
  const day = Math.max(1, Math.min(maxDay, jourPrevu || 1));
  return new Date(currentYear, currentMonth, day);
}

function ecrireProjectionFinDeMois_(ss, nowParis, depensesActuelles, depensesRestantes, projectionFinDeMois, projectionRules, rows) {
  const currentMonthKey = Utilities.formatDate(nowParis, 'Europe/Paris', 'yyyy-MM');
  const currentDay = Number(Utilities.formatDate(nowParis, 'Europe/Paris', 'd'));
  const currentOccurrences = construireOccurencesMoisCourant_(rows, currentMonthKey);

  const name = CONFIG.SHEET_PROJECTION;
  const sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  sheet.clear();

  const monthLabel = Utilities.formatDate(nowParis, 'Europe/Paris', 'MMMM yyyy');
  sheet.getRange(1, 1).setValue('Projection fin de mois — ' + monthLabel);
  sheet.getRange(2, 1, 4, 2).setValues([
    ['Dépenses déjà passées (mois courant)', depensesActuelles],
    ['Dépenses récurrentes restantes estimées', depensesRestantes],
    ['Projection dépenses fin de mois', projectionFinDeMois],
    ['Date de calcul', Utilities.formatDate(new Date(), 'Europe/Paris', 'yyyy-MM-dd HH:mm:ss')],
  ]);

  sheet.getRange(6, 1, 1, 10).setValues([[
    'Libellé', 'Compte', 'Périodicité', 'Montant estimé', 'Jour', 'Mois annuel', 'Fin (option)', 'Source', 'Statut mois en cours', 'Mois observés'
  ]]);

  const detailRows = projectionRules.map(function (rule) {
    const occurrences = currentOccurrences.get(rule.key) || [];
    const dejaPasse = occurrences.length > 0;
    const statut = dejaPasse
      ? 'Déjà passé (' + occurrences.length + ')'
      : ((rule.jourPrevu || currentDay) < currentDay ? 'Probablement passé' : 'À venir');

    return [
      rule.libelle,
      rule.compte,
      rule.periodicite,
      rule.montantPrevu,
      rule.jourPrevu,
      rule.moisAnnuel || '',
      rule.finLe || '',
      rule.source,
      statut,
      rule.frequenceHistorique || '',
    ];
  });

  if (detailRows.length > 0) {
    sheet.getRange(7, 1, detailRows.length, detailRows[0].length).setValues(detailRows);
  }

  sheet.getRange('A1').setFontWeight('bold').setFontSize(12);
  sheet.getRange(2, 2, 3, 1).setNumberFormat('#,##0.00 [$€-fr-FR]');
  sheet.getRange(7, 4, Math.max(1, detailRows.length), 1).setNumberFormat('#,##0.00 [$€-fr-FR]');
  sheet.getRange(6, 1, 1, 10).setFontWeight('bold').setBackground('#E8F0FE');
  sheet.autoResizeColumns(1, 10);
  sheet.setFrozenRows(6);
}

function obtenirOuInitialiserOngletReglesProjection_(ss) {
  const name = CONFIG.SHEET_PROJECTION_REGLES;
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
  }

  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, 9).setValues([[
      'Actif', 'Libellé', 'Compte (optionnel)', 'Périodicité (hebdomadaire|mensuelle|annuelle)', 'Montant prévu (négatif)', 'Jour (1-31)', 'Mois annuel (1-12, optionnel)', 'Fin le (optionnel)', 'Commentaire'
    ]]);
    sh.getRange(1, 1, 1, 9).setFontWeight('bold').setBackground('#FCE8E6');
    sh.setFrozenRows(1);
    sh.autoResizeColumns(1, 9);
  }

  return sh;
}


function parseMoisAnnuelRegle_(value) {
  const n = Number(value);
  if (!isFinite(n)) return '';
  const m = Math.max(1, Math.min(12, Math.round(n)));
  return m;
}

function parseJourRegle_(value) {
  const n = Number(value);
  if (!isFinite(n)) return 1;
  return Math.max(1, Math.min(31, Math.round(n)));
}

function normaliserPeriodicite_(value) {
  const s = String(value || '').trim().toLowerCase();
  if (s === 'hebdomadaire' || s === 'mensuelle' || s === 'annuelle') return s;
  return 'mensuelle';
}

function listerMoisCompletsAvant_(referenceDate, count) {
  const out = [];
  const d = new Date(referenceDate.getTime());
  d.setDate(1);

  for (let i = 1; i <= count; i += 1) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(Utilities.formatDate(m, 'Europe/Paris', 'yyyy-MM'));
  }
  return out;
}

function normaliserCleProjection_(libelle, compte) {
  return [String(libelle || '').trim().toLowerCase(), String(compte || '').trim().toLowerCase()].join('||');
}

function moyenne_(values) {
  if (!values || values.length === 0) return 0;
  const total = values.reduce(function (sum, v) { return sum + Number(v || 0); }, 0);
  return total / values.length;
}

function formatMontantEur_(value) {
  return Utilities.formatString('%.2f €', Number(value || 0));
}

function verifierEcartsSheetsFirebase_UI() {
  const ui = SpreadsheetApp.getUi();
  const msg = verifierEcartsSheetsFirebase_();
  ui.alert(msg.startsWith('❌') ? '❌ Vérification en erreur' : '✅ Vérification terminée', msg, ui.ButtonSet.OK);
}

function verifierEcartsSheetsFirebaseEtSyncFirebase_UI() {
  const ui = SpreadsheetApp.getUi();
  const msg = verifierEcartsSheetsFirebaseEtSyncFirebase_();
  ui.alert(msg.startsWith('❌') ? '❌ Vérification en erreur' : '✅ Vérification terminée', msg, ui.ButtonSet.OK);
}

function verifierEcartsSheetsFirebaseEtSyncFirebase_() {
  return verifierEcartsSheetsFirebase_({
    syncFirebaseReport: true,
  });
}

function verifierEcartsSheetsFirebase_(options) {
  const opts = options || {};

  if (!CONFIG.SPREADSHEET_ID || CONFIG.SPREADSHEET_ID === 'A_REMPLACER_PAR_TON_ID') {
    return '❌ CONFIG.SPREADSHEET_ID non renseigné.';
  }
  if (!CONFIG.FIREBASE_PROJECT_ID || CONFIG.FIREBASE_PROJECT_ID === 'A_REMPLACER_PAR_PROJECT_ID_FIREBASE') {
    return '❌ CONFIG.FIREBASE_PROJECT_ID non renseigné.';
  }

  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEET_DEPENSES);
  if (!sheet) return '❌ Onglet "' + CONFIG.SHEET_DEPENSES + '" introuvable.';

  const aggrSheets = agregerTransactionsParMoisEtCategorieDepuisSheets_(sheet);
  const transactionsFirebase = chargerTransactionsFirebase_(CONFIG.FIREBASE_PROJECT_ID);
  const aggrFirebase = agregerTransactionsParMoisEtCategorieDepuisFirebase_(transactionsFirebase);
  const ecarts = comparerAgregatsSheetsEtFirebase_(aggrSheets, aggrFirebase);

  const meta = {
    totalSheets: aggrSheets.size,
    totalFirebase: aggrFirebase.size,
    totalTransactionsFirebase: transactionsFirebase.length,
  };

  ecrireRapportEcartsSheetsFirebase_(ss, ecarts, meta);

  let firebaseReportId = '';
  if (opts.syncFirebaseReport) {
    firebaseReportId = ecrireRapportRapprochementDansFirebase_(CONFIG.FIREBASE_PROJECT_ID, ecarts, meta);
  }

  return [
    'Rapprochement terminé.',
    '• Groupes Sheets (mois+catégorie): ' + aggrSheets.size,
    '• Groupes Firebase (mois+catégorie): ' + aggrFirebase.size,
    '• Transactions Firebase analysées: ' + transactionsFirebase.length,
    '• Écarts détectés: ' + ecarts.length,
    '• Rapport: onglet "' + CONFIG.SHEET_RAPPROCHEMENT + '"',
    (opts.syncFirebaseReport
      ? ('• Rapport Firebase: collection "' + CONFIG.FIREBASE_COLLECTION_RAPPROCHEMENT + '" (id: ' + firebaseReportId + ')')
      : ''),
  ].filter(Boolean).join('\n');
}

function agregerTransactionsParMoisEtCategorieDepuisSheets_(sheet) {
  const start = CONFIG.PREMIERE_LIGNE_DATA;
  const lastRow = sheet.getLastRow();
  const out = new Map();
  if (lastRow < start) return out;

  const numRows = lastRow - start + 1;
  const values = sheet
    .getRange(start, 1, numRows, CONFIG.COL.COMMENTAIRES)
    .getValues();

  for (const row of values) {
    const date = parseDateSheet_(row[CONFIG.COL.DATE - 1]);
    const montant = parseMontant_(row[CONFIG.COL.MONTANT - 1]);
    if (!date || montant === null) continue;

    const mois = Utilities.formatDate(date, 'Europe/Paris', 'yyyy-MM');
    const categorie = normaliserCategorie_(row[CONFIG.COL.CATEGORIE - 1]);
    const key = mois + '||' + categorie;
    const current = out.get(key) || { mois, categorie, somme: 0, count: 0 };

    current.somme += montant;
    current.count += 1;
    out.set(key, current);
  }
  return out;
}

function chargerTransactionsFirebase_(projectId) {
  const baseUrl =
    'https://firestore.googleapis.com/v1/projects/' +
    encodeURIComponent(projectId) +
    '/databases/(default)/documents/' +
    encodeURIComponent(CONFIG.FIREBASE_COLLECTION_TRANSACTIONS);

  const headers = {
    Authorization: 'Bearer ' + ScriptApp.getOAuthToken(),
  };

  const transactions = [];
  let nextPageToken = '';

  do {
    const url = baseUrl + '?pageSize=1000' + (nextPageToken ? '&pageToken=' + encodeURIComponent(nextPageToken) : '');
    const resp = UrlFetchApp.fetch(url, {
      method: 'get',
      headers,
      muteHttpExceptions: true,
    });
    const status = resp.getResponseCode();
    const body = resp.getContentText();
    if (status < 200 || status >= 300) {
      throw new Error('Erreur Firestore ' + status + ' : ' + body);
    }

    const payload = JSON.parse(body);
    const docs = payload.documents || [];
    for (const doc of docs) {
      const tx = parseDocumentTransactionFirebase_(doc.fields || {});
      if (tx) transactions.push(tx);
    }
    nextPageToken = payload.nextPageToken || '';
  } while (nextPageToken);

  return transactions;
}

function parseDocumentTransactionFirebase_(fields) {
  const dateRaw = lireChampFirestoreString_(fields.date);
  const montant = lireChampFirestoreNumber_(fields.montant);
  if (!dateRaw || montant === null) return null;

  const date = parseDateISO_(dateRaw);
  if (!date) return null;

  return {
    date,
    montant,
    categorie: normaliserCategorie_(lireChampFirestoreString_(fields.categorie)),
  };
}

function agregerTransactionsParMoisEtCategorieDepuisFirebase_(transactions) {
  const out = new Map();
  for (const tx of transactions) {
    const mois = Utilities.formatDate(tx.date, 'Europe/Paris', 'yyyy-MM');
    const categorie = normaliserCategorie_(tx.categorie);
    const key = mois + '||' + categorie;
    const current = out.get(key) || { mois, categorie, somme: 0, count: 0 };

    current.somme += tx.montant;
    current.count += 1;
    out.set(key, current);
  }
  return out;
}

function comparerAgregatsSheetsEtFirebase_(aggrSheets, aggrFirebase) {
  const keys = new Set([...aggrSheets.keys(), ...aggrFirebase.keys()]);
  const rows = [];

  for (const key of keys) {
    const s = aggrSheets.get(key) || { mois: '', categorie: '', somme: 0, count: 0 };
    const f = aggrFirebase.get(key) || { mois: s.mois, categorie: s.categorie, somme: 0, count: 0 };

    const deltaSomme = arrondir2_(s.somme - f.somme);
    const deltaCount = s.count - f.count;
    if (deltaSomme === 0 && deltaCount === 0) continue;

    rows.push({
      mois: s.mois || f.mois,
      categorie: s.categorie || f.categorie,
      sommeSheets: arrondir2_(s.somme),
      sommeFirebase: arrondir2_(f.somme),
      ecartSomme: deltaSomme,
      nbSheets: s.count,
      nbFirebase: f.count,
      ecartNb: deltaCount,
    });
  }

  rows.sort((a, b) =>
    String(a.mois).localeCompare(String(b.mois)) ||
    String(a.categorie).localeCompare(String(b.categorie))
  );
  return rows;
}

function ecrireRapportEcartsSheetsFirebase_(ss, ecarts, meta) {
  const name = CONFIG.SHEET_RAPPROCHEMENT;
  const sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  sheet.clear();

  const now = Utilities.formatDate(new Date(), 'Europe/Paris', 'yyyy-MM-dd HH:mm:ss');
  const header = [
    ['Rapport de rapprochement Sheets ↔ Firebase'],
    ['Généré le', now],
    ['Groupes Sheets', meta.totalSheets || 0],
    ['Groupes Firebase', meta.totalFirebase || 0],
    ['Transactions Firebase analysées', meta.totalTransactionsFirebase || 0],
    ['Écarts', ecarts.length],
    [],
  ];
  sheet.getRange(1, 1, header.length, 2).setValues(header.map(r => [r[0] || '', r[1] || '']));

  const columns = [
    'Mois',
    'Catégorie',
    'Somme Sheets',
    'Somme Firebase',
    'Écart somme (Sheets - Firebase)',
    'Nb tx Sheets',
    'Nb tx Firebase',
    'Écart nb tx',
  ];
  const startRow = header.length + 1;
  sheet.getRange(startRow, 1, 1, columns.length).setValues([columns]);

  if (ecarts.length > 0) {
    const rows = ecarts.map(r => [
      r.mois,
      r.categorie,
      r.sommeSheets,
      r.sommeFirebase,
      r.ecartSomme,
      r.nbSheets,
      r.nbFirebase,
      r.ecartNb,
    ]);
    sheet.getRange(startRow + 1, 1, rows.length, columns.length).setValues(rows);
  }

  sheet.autoResizeColumns(1, columns.length);
}

function ecrireRapportRapprochementDansFirebase_(projectId, ecarts, meta) {
  const runId = Utilities.getUuid();
  const generatedAtIso = new Date().toISOString();

  const basePath =
    'https://firestore.googleapis.com/v1/projects/' +
    encodeURIComponent(projectId) +
    '/databases/(default)/documents/' +
    encodeURIComponent(CONFIG.FIREBASE_COLLECTION_RAPPROCHEMENT);

  const runPayload = {
    fields: {
      runId: { stringValue: runId },
      generatedAt: { timestampValue: generatedAtIso },
      sourceSpreadsheetId: { stringValue: CONFIG.SPREADSHEET_ID },
      sourceSheetName: { stringValue: CONFIG.SHEET_DEPENSES },
      reportSheetName: { stringValue: CONFIG.SHEET_RAPPROCHEMENT },
      totalGroupsSheets: { integerValue: String(meta.totalSheets || 0) },
      totalGroupsFirebase: { integerValue: String(meta.totalFirebase || 0) },
      totalTransactionsFirebase: { integerValue: String(meta.totalTransactionsFirebase || 0) },
      totalEcarts: { integerValue: String(ecarts.length) },
    },
  };

  const createdRun = firestoreCreateDocument_(basePath, runPayload, runId);
  const runDocName = String(createdRun.name || '');

  for (let i = 0; i < ecarts.length; i++) {
    const e = ecarts[i];
    const itemPayload = {
      fields: {
        runId: { stringValue: runId },
        ordre: { integerValue: String(i + 1) },
        mois: { stringValue: String(e.mois || '') },
        categorie: { stringValue: String(e.categorie || '') },
        sommeSheets: { doubleValue: Number(e.sommeSheets || 0) },
        sommeFirebase: { doubleValue: Number(e.sommeFirebase || 0) },
        ecartSomme: { doubleValue: Number(e.ecartSomme || 0) },
        nbSheets: { integerValue: String(e.nbSheets || 0) },
        nbFirebase: { integerValue: String(e.nbFirebase || 0) },
        ecartNb: { integerValue: String(e.ecartNb || 0) },
      },
    };
    firestoreCreateDocument_(runDocName + '/items', itemPayload);
  }

  return runId;
}

// NOTE ARCHITECTURE : L'écriture dans Firebase est exclusivement gérée par
// le script Python src/importer.py (via GitHub Actions). Apps Script écrit
// uniquement dans Google Sheets. Ces deux chemins sont indépendants.
// La feuille Sheets est temporaire et sera supprimée à terme.

function firestoreCreateDocument_(collectionPathOrDocPath, payload, documentId) {
  const url = collectionPathOrDocPath + (documentId ? ('?documentId=' + encodeURIComponent(documentId)) : '');
  const resp = UrlFetchApp.fetch(url, {
    method: 'post',
    headers: {
      Authorization: 'Bearer ' + ScriptApp.getOAuthToken(),
      'Content-Type': 'application/json',
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  const status = resp.getResponseCode();
  const body = resp.getContentText();
  if (status < 200 || status >= 300) {
    throw new Error('Erreur Firestore write ' + status + ' : ' + body);
  }

  return JSON.parse(body || '{}');
}

function parseDateSheet_(value) {
  if (!value) return null;
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) return value;

  const s = String(value).trim();
  if (!s) return null;

  const fr = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (fr) {
    return new Date(Number(fr[3]), Number(fr[2]) - 1, Number(fr[1]));
  }
  const iso = parseDateISO_(s);
  return iso;
}

function parseDateISO_(value) {
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function parseMontant_(value) {
  if (typeof value === 'number') return isFinite(value) ? value : null;
  if (value === null || value === undefined) return null;
  const normalized = String(value).replace(/\s/g, '').replace(',', '.');
  if (!normalized) return null;
  const n = Number(normalized);
  return isFinite(n) ? n : null;
}

function normaliserCategorie_(value) {
  const c = String(value || '').trim();
  return c || '(Sans catégorie)';
}

function lireChampFirestoreString_(field) {
  if (!field) return '';
  return String(field.stringValue || '').trim();
}

function lireChampFirestoreNumber_(field) {
  if (!field) return null;
  if (field.doubleValue !== undefined) return Number(field.doubleValue);
  if (field.integerValue !== undefined) return Number(field.integerValue);
  return null;
}

function arrondir2_(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}


// =============================================================================
//  UI WRAPPERS
// =============================================================================
function importerDepuisGmail_UI() {
  const ui = SpreadsheetApp.getUi();
  const res = importerDepuisGmail_();
  ui.alert(res.startsWith('❌') ? '❌ Erreur' : '✅ Import Gmail terminé', res, ui.ButtonSet.OK);
}

function resetProcessedStore_UI() {
  const ui = SpreadsheetApp.getUi();
  const btn = ui.alert(
    '⚠️ Réinitialiser ?',
    'Cela efface la mémoire "déjà traité" (Message IDs).\n' +
    'Tu risques de rescanner / réimporter des emails.\n\nContinuer ?',
    ui.ButtonSet.OK_CANCEL
  );
  if (btn !== ui.Button.OK) return;

  PropertiesService.getScriptProperties().deleteProperty(PROCESSED_STORE_KEY);
  ui.alert('✅ Store "déjà traité" effacé.');
}

function ouvrirReparseEmailDialog_UI() {
  const html = HtmlService.createHtmlOutput(`
    <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          body { font-family: Arial, sans-serif; padding: 12px; }
          .row { margin-bottom: 10px; }
          select, button { width: 100%; padding: 8px; }
          #status { margin-top: 10px; white-space: pre-wrap; font-size: 12px; }
          .muted { color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="row muted">Sélectionne un email Gmail Linxo, puis lance un reparse + réupload.</div>
        <div class="row">
          <select id="emailSelect"><option>Chargement…</option></select>
        </div>
        <div class="row"><button onclick="run()">♻️ Reparser et réuploader</button></div>
        <div id="status"></div>

        <script>
          function setStatus(msg) {
            document.getElementById('status').textContent = msg || '';
          }

          function loadEmails() {
            setStatus('Chargement des emails Linxo…');
            google.script.run
              .withSuccessHandler(function(items) {
                setStatus('');
                const sel = document.getElementById('emailSelect');
                sel.innerHTML = '';
                if (!items || !items.length) {
                  sel.innerHTML = '<option value="">Aucun email Linxo trouvé</option>';
                  return;
                }
                items.forEach(function(it) {
                  const o = document.createElement('option');
                  o.value = it.id;
                  o.textContent = it.label;
                  sel.appendChild(o);
                });
                setStatus('✅ ' + items.length + ' email(s) trouvé(s).');
              })
              .withFailureHandler(function(err) {
                setStatus('❌ Impossible de charger la liste: ' + (err && err.message ? err.message : err));
              })
              .listerEmailsLinxoPourReparse(200);
          }

          function run() {
            const id = document.getElementById('emailSelect').value;
            if (!id) {
              setStatus('⚠️ Sélectionne un email.');
              return;
            }
            setStatus('Traitement en cours…');
            google.script.run
              .withSuccessHandler(function(msg) { setStatus(msg); })
              .withFailureHandler(function(err) {
                setStatus('❌ Erreur: ' + (err && err.message ? err.message : err));
              })
              .reparserEtReuploaderEmailLinxo(id);
          }

          loadEmails();
        </script>
      </body>
    </html>
  `)
    .setWidth(640)
    .setHeight(360);

  SpreadsheetApp.getUi().showModalDialog(html, 'Reparser un email Linxo');
}

// ─── PROXY PUBLICS POUR google.script.run ────────────────────────────────────
// Les fonctions finissant par _ sont PRIVÉES dans Apps Script et ne peuvent
// PAS être appelées depuis le HTML via google.script.run. Ces wrappers publics
// délèguent aux implémentations privées.
function listerEmailsLinxoPourReparse(limit) {
  return listerEmailsLinxoPourReparse_(limit);
}

function reparserEtReuploaderEmailLinxo(msgId) {
  return reparserEtReuploaderEmailLinxo_(msgId);
}


function listerEmailsLinxoPourReparse_(limit) {
  // Pas de filtre newer_than : on veut voir TOUS les emails Linxo,
  // y compris ceux déjà labellisés (Linxo_Importé / Linxo_Importé_Sheets) et les plus anciens.
  const max = Math.min(Math.max(Number(limit) || 200, 1), 500);
  const processedIds = new Set(loadProcessedMessageIds_());

  // Recherche sans limite de date, dans tous les dossiers Gmail (All Mail)
  const q =
    'from:(' + CONFIG.GMAIL_FROM + ') ' +
    'subject:(' + JSON.stringify(CONFIG.GMAIL_SUBJECT_CONTAINS) + ')';

  const threads = GmailApp.search(q, 0, max);
  const rows = [];

  for (const th of threads) {
    const threadLabelNames = th.getLabels().map(function(l) { return l.getName(); });
    const hasLabelSheets   = threadLabelNames.includes(CONFIG.GMAIL_LABEL_TRAITE);
    const hasLabelFirebase = threadLabelNames.includes(CONFIG.GMAIL_LABEL_FIREBASE);

    const msgs = th.getMessages();
    for (const msg of msgs) {
      const id = msg.getId();
      const inStore = processedIds.has(id);
      const dt = Utilities.formatDate(msg.getDate(), 'Europe/Paris', 'yyyy-MM-dd HH:mm');
      const subject = String(msg.getSubject() || '(sans objet)');

      let statusStr = '⏳ non importé';
      if (hasLabelFirebase && hasLabelSheets) statusStr = '✅ Firebase + Sheets';
      else if (hasLabelFirebase)              statusStr = '✅ Firebase (Python)';
      else if (hasLabelSheets)                statusStr = '✅ Sheets (Apps Script)';
      else if (inStore)                       statusStr = '✅ Sheets (store local)';

      rows.push({
        id,
        dateMs: msg.getDate().getTime(),
        label: '[' + statusStr + '] ' + dt + ' — ' + subject,
      });
    }
  }

  rows.sort((a, b) => b.dateMs - a.dateMs);
  return rows.slice(0, max).map(function(r) { return { id: r.id, label: r.label }; });
}

function reparserEtReuploaderEmailLinxo_(msgId) {
  if (!msgId) return '❌ Message ID manquant.';

  const msg = GmailApp.getMessageById(msgId);
  if (!msg) return '❌ Email introuvable pour ID=' + msgId;

  if (!CONFIG.SPREADSHEET_ID || CONFIG.SPREADSHEET_ID === 'A_REMPLACER_PAR_TON_ID') {
    return '❌ CONFIG.SPREADSHEET_ID non renseigné.';
  }

  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEET_DEPENSES);
  if (!sheet) return '❌ Onglet "' + CONFIG.SHEET_DEPENSES + '" introuvable.';

  const mapping = chargerMapping_(ss);
  const { strict: existantsStrict, libelleMontant: existantsLM } = chargerTransactionsExistantes_(sheet);

  const html = getHtmlRobusteDepuisMessage_(msg);
  const parsed = parserEmailLinxoHTML_Robuste_(html);
  const txs = (parsed.transactions || []).slice(0, CONFIG.MAX_TRANSACTIONS_PAR_EMAIL);

  const nouvelles = [];
  let nbDoublonsStrict = 0;
  let nbIgnorees = 0;
  let nbPotentiels = 0;

  for (const tx of txs) {
    if (!CONFIG.COMPTES_ACTIFS[tx.compteLinxo]) {
      nbIgnorees++;
      continue;
    }

    const compteBudget = CONFIG.COMPTES_ACTIFS[tx.compteLinxo];
    const catLinxo = tx.categorieLinxo || '';
    let catProposee = mapping[catLinxo] || '';

    let commentaireCat = '';
    if (CONFIG.CATEGORIES_IGNOREES.includes(catLinxo)) {
      catProposee = CONFIG.EMPTY_CATEGORY_WHEN_IGNORED ? '' : catLinxo;
      commentaireCat =
        '⚠️ Catégorie Linxo "' + catLinxo + '" à recatégoriser (choisir une catégorie en colonne H)';
    } else if (!catProposee && catLinxo) {
      catProposee = catLinxo;
      commentaireCat = '⚠️ Catégorie Linxo sans mapping (à vérifier)';
    }

    const kStrict = cleDedoublonnage_(tx.date, tx.libelle, tx.montant);
    if ((existantsStrict.get(kStrict) || 0) > 0) {
      nbDoublonsStrict++;
      continue;
    }

    let commentairePotentiel = '';
    const kLM = cleLibelleMontant_(tx.libelle, tx.montant);
    if (existantsLM.has(kLM)) {
      nbPotentiels++;
      const dates = existantsLM.get(kLM);
      commentairePotentiel =
        '⚠️ Doublon potentiel (libellé+montant déjà vus le ' + dates.slice(0, 3).join(', ') + ')';
    }

    const commentaireCategorieProposee = (catProposee || catLinxo)
      ? ('Catégorie proposée: "' + (catProposee || catLinxo) + '"')
      : 'Catégorie proposée: (vide)';

    const commentaire = [commentaireCat, commentairePotentiel, commentaireCategorieProposee]
      .filter(Boolean)
      .join(' | ');

    nouvelles.push({
      date: tx.date,
      libelle: tx.libelle,
      compte: compteBudget,
      montant: tx.montant,
      commentaire,
    });

    existantsStrict.set(kStrict, 1);
    if (!existantsLM.has(kLM)) existantsLM.set(kLM, []);
    existantsLM.get(kLM).push(formatDateFR_(tx.date));
  }

  nouvelles.sort((a, b) => a.date - b.date);
  if (nouvelles.length > 0) ecrireBatch_SANS_COL_B_ET_SANS_COL_H_(sheet, nouvelles);

  // Réupload/archivage de l'email même si aucune transaction nouvelle.
  try {
    archiverEmailDansDrive_API_(msg);
  } catch (e) {
    logImport_('WARN', 'Archivage EML échoué pendant reparse manuel', { error: e.message });
  }

  const label = getOrCreateGmailLabel_(CONFIG.GMAIL_LABEL_TRAITE);
  try {
    msg.getThread().addLabel(label);
  } catch (e) {
    logImport_('WARN', 'Ajout label échoué pendant reparse manuel', { error: e.message });
  }
  markMessageProcessed_(msgId);

  return [
    '✅ Reparse terminé',
    '• Sujet : ' + String(msg.getSubject() || '(sans objet)'),
    '• Transactions détectées : ' + txs.length,
    '• Nouvelles lignes importées : ' + nouvelles.length,
    '• Doublons strict ignorés : ' + nbDoublonsStrict,
    '• Doublons potentiels signalés : ' + nbPotentiels,
    '• Transactions filtrées (compte non suivi) : ' + nbIgnorees,
    '• Email archivé (.eml) + marqué traité',
  ].join('\n');
}


// =============================================================================
//  TRIGGER QUOTIDIEN
// =============================================================================
function installerTriggerQuotidien() {
  const triggers = ScriptApp.getProjectTriggers();
  for (const t of triggers) {
    if (t.getHandlerFunction() === 'importerDepuisGmail_Trigger') ScriptApp.deleteTrigger(t);
  }

  ScriptApp.newTrigger('importerDepuisGmail_Trigger')
    .timeBased()
    .everyDays(1)
    .atHour(CONFIG.TRIGGER_HOUR)
    .nearMinute(CONFIG.TRIGGER_NEAR_MINUTE)
    .create();

  SpreadsheetApp.getUi().alert(
    '✅ Trigger installé : import Gmail quotidien vers ' +
    String(CONFIG.TRIGGER_HOUR).padStart(2, '0') + ':' +
    String(CONFIG.TRIGGER_NEAR_MINUTE).padStart(2, '0') + '.'
  );
}

function importerDepuisGmail_Trigger() {
  importerDepuisGmail_();
}


// =============================================================================
//  MOTEUR PRINCIPAL : Gmail → Sheet + Archivage Drive + CSV Audit
// =============================================================================
function importerDepuisGmail_() {
  // ✅ Anti concurrence : un seul import à la fois
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    return '❌ Import déjà en cours (lock non obtenu).';
  }

  const startTime = Date.now();

  try {
    logImport_('INFO', '🚀 Début import Gmail Linxo v6.3');

    // ✅ Forcer le classeur cible
    if (!CONFIG.SPREADSHEET_ID || CONFIG.SPREADSHEET_ID === 'A_REMPLACER_PAR_TON_ID') {
      return '❌ CONFIG.SPREADSHEET_ID non renseigné.';
    }

    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEET_DEPENSES);
    if (!sheet) return '❌ Onglet "' + CONFIG.SHEET_DEPENSES + '" introuvable.';

    logImport_('INFO', 'Cible écriture', {
      spreadsheetName: ss.getName(),
      spreadsheetId: ss.getId(),
      sheetName: sheet.getName(),
    });

    const label = getOrCreateGmailLabel_(CONFIG.GMAIL_LABEL_TRAITE);

    // Recherche des emails Linxo. On n'exclut plus par label car un autre programme
    // pourrait l'avoir ajouté. On se fie à notre store interne PROCESSED_STORE_KEY.
    const q =
      'from:(' + CONFIG.GMAIL_FROM + ') ' +
      'subject:(' + JSON.stringify(CONFIG.GMAIL_SUBJECT_CONTAINS) + ') ' +
      'newer_than:' + CONFIG.GMAIL_NEWER_THAN_DAYS + 'd';

    const threads = GmailApp.search(q, 0, CONFIG.MAX_EMAILS_PAR_BATCH);
    if (threads.length === 0) return '📭 Aucun email Linxo trouvé sur la fenêtre.';

    logImport_('INFO', 'Threads trouvés', { count: threads.length, q });

    const mapping = chargerMapping_(ss);
    const { strict: existantsStrict, libelleMontant: existantsLM } = chargerTransactionsExistantes_(sheet);

    let totalEmails = 0;
    let totalTx = 0;
    let nbImportees = 0;
    let nbDoublonsStrict = 0;
    let nbIgnorees = 0;
    let nbPotentiels = 0;
    let nbInvalides = 0;
    let nbCatARecategoriser = 0;

    const sansMapping = new Set();
    const nouvelles = [];

    // Marquage après écriture OK
    const messagesToMark = [];
    const threadsToLabel = new Set();
    // Emails dont toutes les transactions sont déjà enregistrées (marqués sans attendre l'écriture)
    const messagesAlreadyDone = [];

    const audit = {
      imported: [],
      filtered: [],
      strictDuplicates: [],
      potentialDuplicates: [],
      invalid: [],
    };

    let auditFileName = '';
    let auditError = '';

    // Charger les IDs traités une seule fois (évite N lectures ScriptProperties)
    const processedIds = new Set(loadProcessedMessageIds_());

    for (const th of threads) {
      if (Date.now() - startTime > CONFIG.TIMEOUT_MS) {
        logImport_('WARN', 'Timeout atteint, arrêt anticipé');
        break;
      }

      const messages = th.getMessages();
      for (const msg of messages) {
        if (Date.now() - startTime > CONFIG.TIMEOUT_MS) break;

        const msgId = msg.getId();
        if (processedIds.has(msgId)) continue;

        totalEmails++;

        const html = getHtmlRobusteDepuisMessage_(msg);
        const parsed = parserEmailLinxoHTML_Robuste_(html);

        if (parsed.warnings && parsed.warnings.length > 0) {
          nbInvalides += parsed.warnings.length;
          for (const w of parsed.warnings) {
            audit.invalid.push({
              emailDate: msg.getDate(),
              subject: msg.getSubject(),
              warning: w,
            });
          }
        }

        const txs = (parsed.transactions || []).slice(0, CONFIG.MAX_TRANSACTIONS_PAR_EMAIL);
        let msgImportedCount = 0;

        for (const tx of txs) {
          totalTx++;

          if (!CONFIG.COMPTES_ACTIFS[tx.compteLinxo]) {
            nbIgnorees++;
            audit.filtered.push({
              statut: 'FILTRÉ_COMPTE',
              compteLinxo: tx.compteLinxo,
              compteBudget: '',
              date: tx.date,
              libelle: tx.libelle,
              montant: tx.montant,
              categorieLinxo: tx.categorieLinxo,
            });
            continue;
          }

          const compteBudget = CONFIG.COMPTES_ACTIFS[tx.compteLinxo];
          const catLinxo = tx.categorieLinxo || '';

          let catProposee = mapping[catLinxo] || '';
          let commentaireCat = '';

          const isIgnoredCategory = CONFIG.CATEGORIES_IGNOREES.includes(catLinxo);
          if (isIgnoredCategory) {
            nbCatARecategoriser++;
            commentaireCat =
              '⚠️ Catégorie Linxo "' + catLinxo + '" à recatégoriser (choisir une catégorie en colonne H)';
            catProposee = CONFIG.EMPTY_CATEGORY_WHEN_IGNORED ? '' : catLinxo;
          } else {
            if (!catProposee && catLinxo) {
              sansMapping.add(catLinxo);
              catProposee = catLinxo;
              commentaireCat = '⚠️ Catégorie Linxo sans mapping (à vérifier)';
            }
          }

          // Dédoublonnage strict
          const kStrict = cleDedoublonnage_(tx.date, tx.libelle, tx.montant);
          if ((existantsStrict.get(kStrict) || 0) > 0) {
            nbDoublonsStrict++;
            audit.strictDuplicates.push({
              statut: 'DOUBLON_STRICT',
              compteLinxo: tx.compteLinxo,
              compteBudget: compteBudget,
              date: tx.date,
              libelle: tx.libelle,
              montant: tx.montant,
              categorieLinxo: catLinxo,
            });
            continue;
          }

          // Doublon potentiel
          const kLM = cleLibelleMontant_(tx.libelle, tx.montant);
          let commentairePotentiel = '';
          if (existantsLM.has(kLM)) {
            nbPotentiels++;
            const dates = existantsLM.get(kLM);
            commentairePotentiel =
              '⚠️ Doublon potentiel (libellé+montant déjà vus le ' +
              dates.slice(0, 3).join(', ') + ')';

            audit.potentialDuplicates.push({
              statut: 'DOUBLON_POTENTIEL',
              compteLinxo: tx.compteLinxo,
              compteBudget: compteBudget,
              date: tx.date,
              libelle: tx.libelle,
              montant: tx.montant,
              categorieLinxo: catLinxo,
              note: commentairePotentiel,
            });
          }

          // ✅ On n’écrit PAS la catégorie en H : on la met en commentaire pour saisie manuelle
          const commentaireCategorieProposee = (catProposee || catLinxo)
            ? ('Catégorie proposée: "' + (catProposee || catLinxo) + '"')
            : 'Catégorie proposée: (vide)';

          const commentaire = [commentaireCat, commentairePotentiel, commentaireCategorieProposee]
            .filter(Boolean)
            .join(' | ');

          nouvelles.push({
            date: tx.date,
            libelle: tx.libelle,
            compte: compteBudget,
            montant: tx.montant,
            // categorie: volontairement ignorée en écriture
            commentaire: commentaire,
          });

          audit.imported.push({
            statut: isIgnoredCategory ? 'IMPORTÉ_A_RECATEGORISER' : 'IMPORTÉ',
            compteLinxo: tx.compteLinxo,
            compteBudget: compteBudget,
            date: tx.date,
            libelle: tx.libelle,
            montant: tx.montant,
            categorieLinxo: catLinxo,
            categorieBudget: catProposee,
            commentaire: commentaire,
          });

          // MAJ dédoublonnage intra-batch
          existantsStrict.set(kStrict, 1);
          if (!existantsLM.has(kLM)) existantsLM.set(kLM, []);
          existantsLM.get(kLM).push(formatDateFR_(tx.date));

          msgImportedCount++;
        }

        if (msgImportedCount > 0) {
          messagesToMark.push({ msgId, msg, th });
          threadsToLabel.add(th);
        } else {
          // Toutes les transactions étaient déjà enregistrées : marquer sans attendre l'écriture
          messagesAlreadyDone.push(msgId);
        }
      }
    }

    // Marquer immédiatement les emails dont toutes les transactions sont des doublons
    if (messagesAlreadyDone.length > 0) {
      for (const msgId of messagesAlreadyDone) processedIds.add(msgId);
      saveProcessedMessageIds_(Array.from(processedIds));
      logImport_('INFO', 'Emails sans nouvelles transactions marqués comme traités', { count: messagesAlreadyDone.length });
    }

    // Tri chronologique
    nouvelles.sort((a, b) => a.date - b.date);
    logImport_('INFO', 'Transactions à écrire', { count: nouvelles.length });

    // ✅ ÉCRITURE BATCH — SANS COLONNES B ET H
    if (nouvelles.length > 0) {
      try {
        nbImportees = nouvelles.length;
        ecrireBatch_SANS_COL_B_ET_SANS_COL_H_(sheet, nouvelles);

        // SUCCÈS : maintenant on marque les messages comme traités (batch save)
        for (const item of messagesToMark) {
          processedIds.add(item.msgId);

          try {
            archiverEmailDansDrive_API_(item.msg);
          } catch (e) {
            logImport_('WARN', 'Archivage EML échoué pour un message', { error: e.message });
          }
        }
        if (messagesToMark.length > 0) {
          saveProcessedMessageIds_(Array.from(processedIds));
        }

        // Ajouter le label aux threads
        for (const th of threadsToLabel) {
          try {
            th.addLabel(label);
          } catch (e) {
            logImport_('WARN', 'Impossible d\'ajouter le label au thread', { error: e.message });
          }
        }

        logImport_('INFO', 'Écriture réussie', { lignes: nbImportees });
      } catch (e) {
        logImport_('ERROR', 'Échec écriture', { error: e.message, stack: e.stack });

        // CSV audit même en cas d'échec
        try {
          auditFileName = genererCsvAuditDansDrive_API_(audit, {
            totalEmails, totalTx, nbImportees: 0, nbDoublonsStrict, nbPotentiels, nbIgnorees, nbInvalides, nbCatARecategoriser,
          });
        } catch (e2) {
          auditError = (e2 && e2.message) ? e2.message : String(e2);
        }

        return '❌ Erreur lors de l\'écriture dans la feuille :\n' + e.message +
          '\n\nAucun email n\'a été marqué comme traité.';
      }
    }

    // Générer CSV d'audit
    if (totalEmails > 0) {
      try {
        auditFileName = genererCsvAuditDansDrive_API_(audit, {
          totalEmails, totalTx, nbImportees, nbDoublonsStrict, nbPotentiels, nbIgnorees, nbInvalides, nbCatARecategoriser,
        });
      } catch (e) {
        auditError = (e && e.message) ? e.message : String(e);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    return buildRapport_({
      totalEmails, totalTx, nbImportees, nbDoublonsStrict,
      nbPotentiels, nbIgnorees, nbInvalides, nbCatARecategoriser,
      sansMapping, duration, auditFileName, auditError,
    });

  } finally {
    lock.releaseLock();
  }
}

function buildRapport_(stats) {
  let r = '📊 Import Gmail Linxo v6.3 :\n';
  r += '• Emails scannés : ' + stats.totalEmails + '\n';
  r += '• Transactions vues : ' + stats.totalTx + '\n';
  r += '• Importées : ' + stats.nbImportees + '\n';
  r += '• Doublons strict ignorés (date+libellé+montant) : ' + stats.nbDoublonsStrict + '\n';
  r += '• Doublons potentiels signalés (libellé+montant) : ' + stats.nbPotentiels + '\n';
  r += '• Filtrées (compte non suivi) : ' + stats.nbIgnorees + '\n';
  r += '• Importées à recatégoriser : ' + stats.nbCatARecategoriser + '\n';
  if (stats.nbInvalides > 0) r += '• Invalides / warnings parsing : ' + stats.nbInvalides + '\n';

  r += '• Archivage Drive : ' + CONFIG.DOSSIER_DRIVE + '/' + CONFIG.SOUS_DOSSIER_DRIVE + ' (.eml)\n';

  if (stats.auditFileName) {
    r += '• CSV Audit : ' + CONFIG.DOSSIER_DRIVE + '/' + CONFIG.SOUS_DOSSIER_DRIVE + ' (' + stats.auditFileName + ')\n';
  } else {
    r += '• CSV Audit : ❌ non créé\n';
    if (stats.auditError) r += '  ↳ Erreur : ' + stats.auditError + '\n';
  }

  r += '• Durée : ' + stats.duration + 's\n';

  if (stats.sansMapping && stats.sansMapping.size > 0) {
    r += '\n⚠️ Catégories Linxo sans mapping :\n';
    for (const c of stats.sansMapping) r += '  → "' + c + '"\n';
  }
  return r;
}


// =============================================================================
//  HTML ROBUSTE : getBody() si OK, sinon extraction depuis RAW
// =============================================================================
function getHtmlRobusteDepuisMessage_(msg) {
  const body = msg.getBody() || '';
  if (body.indexOf('<!-- Name of the notification -->') !== -1) return body;

  try {
    const raw = msg.getRawContent();
    const html = extraireHtmlDepuisRaw_(raw);
    if (html && html.length > 200) return html;
  } catch (e) {
    Logger.log('RAW parse failed: ' + e);
  }

  return body;
}

function extraireHtmlDepuisRaw_(raw) {
  const txt = String(raw || '').replace(/\r/g, '');

  if (/Content-Type:\s*text\/html/i.test(txt) && !/multipart\//i.test(txt)) {
    const split = txt.split(/\n\n/);
    if (split.length >= 2) {
      const headers = split[0];
      const body = split.slice(1).join('\n\n');
      const encMatch = headers.match(/Content-Transfer-Encoding:\s*([^\n]+)/i);
      const enc = (encMatch ? encMatch[1] : '').toLowerCase().trim();

      if (enc.includes('base64')) {
        const bytes = Utilities.base64Decode(body.replace(/\s/g, ''));
        return Utilities.newBlob(bytes).getDataAsString('UTF-8');
      }
      if (enc.includes('quoted-printable')) {
        return decodeQuotedPrintable_(body);
      }
      return body;
    }
  }

  const parts = txt.split(/\n--/);
  for (const p of parts) {
    if (!/Content-Type:\s*text\/html/i.test(p)) continue;

    const encMatch = p.match(/Content-Transfer-Encoding:\s*([^\n]+)/i);
    const enc = (encMatch ? encMatch[1] : '').toLowerCase().trim();

    const split = p.split(/\n\n/);
    if (split.length < 2) continue;

    const body = split.slice(1).join('\n\n').trim();
    if (!body) continue;

    if (enc.includes('base64')) {
      const bytes = Utilities.base64Decode(body.replace(/\s/g, ''));
      return Utilities.newBlob(bytes).getDataAsString('UTF-8');
    }
    if (enc.includes('quoted-printable')) {
      return decodeQuotedPrintable_(body);
    }
    return body;
  }

  return '';
}

function decodeQuotedPrintable_(input) {
  const s = String(input || '')
    .replace(/=\n/g, '')
    .replace(/=([A-Fa-f0-9]{2})/g, (m, h) => String.fromCharCode(parseInt(h, 16)));

  const bytes = [];
  for (let i = 0; i < s.length; i++) bytes.push(s.charCodeAt(i) & 0xFF);
  return Utilities.newBlob(bytes).getDataAsString('UTF-8');
}


// =============================================================================
//  PARSING LINXO — ROBUSTE
// =============================================================================
function parserEmailLinxoHTML_Robuste_(html) {
  const transactions = [];
  const warnings = [];

  const s = String(html || '').replace(/\r/g, '');
  const comptes = s.split('<!-- Account Name -->');

  if (comptes.length <= 1) {
    warnings.push('Aucun bloc compte (Account Name) détecté');
    return { transactions, warnings };
  }

  const now = new Date();
  const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
  const thirtyDaysAhead = new Date(now.getTime() + 30 * 86400000);

  for (let i = 1; i < comptes.length; i++) {
    const blocBrut = comptes[i];
    
    // Isolation section transactions / section solde
    const partsSolde = blocBrut.split('<!--STATUS ACCOUNT');
    const bloc = partsSolde[0];

    const mCompte = bloc.match(/<strong[^>]*>\s*([\s\S]*?)\s*<\/strong>/i);
    if (!mCompte) { warnings.push('Compte introuvable dans un bloc'); continue; }
    const compteLinxo = stripHtml_(mCompte[1]).trim();

    const tParts = bloc.split('<!-- Name of the notification -->');
    for (let k = 1; k < tParts.length; k++) {
      const t = tParts[k];

      const mLib = t.match(/<strong[^>]*>\s*([\s\S]*?)\s*<\/strong>/i);
      if (!mLib) { warnings.push('Libellé introuvable (compte ' + compteLinxo + ')'); continue; }
      const libelle = nettoyerLibelle_(stripHtml_(mLib[1]).trim());
      if (!libelle) { warnings.push('Libellé vide (compte ' + compteLinxo + ')'); continue; }

      const mAmountBlock = t.match(/<!-- Amount -->[\s\S]*?<strong[^>]*>\s*([\s\S]*?)\s*<\/strong>/i);
      if (!mAmountBlock) { warnings.push('Montant introuvable (libellé ' + libelle + ')'); continue; }
      const montant = parseMontantFR_(stripHtml_(mAmountBlock[1]).trim());
      if (isNaN(montant) || montant === 0) { warnings.push('Montant invalide (libellé ' + libelle + ')'); continue; }
      if (montant < CONFIG.MONTANT_MIN || montant > CONFIG.MONTANT_MAX) {
        warnings.push('Montant hors limites: ' + montant + ' (libellé ' + libelle + ')'); continue;
      }

      const mDate = t.match(/calendar\.png[\s\S]*?(\d{2}\/\d{2}\/\d{4})/i);
      if (!mDate) { warnings.push('Date introuvable (libellé ' + libelle + ')'); continue; }
      const date = parseDateFR_(stripHtml_(mDate[1]).trim());
      if (isNaN(date.getTime())) { warnings.push('Date invalide (libellé ' + libelle + ')'); continue; }
      if (date > thirtyDaysAhead || date < twoYearsAgo) { warnings.push('Date hors plage (libellé ' + libelle + ')'); continue; }

      let categorieLinxo = '';
      const mCat = t.match(/Bullet-Email\.png[\s\S]*?<font[^>]*>\s*([^<]+?)\s*<\/font>/i);
      if (mCat) categorieLinxo = stripHtml_(mCat[1]).trim();

      transactions.push({ compteLinxo, libelle, montant, date, categorieLinxo });
    }
  }

  return { transactions, warnings };
}


// =============================================================================
//  UTILITAIRES PARSING
// =============================================================================
function stripHtml_(x) {
  return String(x || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDateFR_(ddmmyyyy) {
  const p = String(ddmmyyyy || '').split('/');
  if (p.length !== 3) return new Date('invalid');
  const d = Number(p[0]), m = Number(p[1]), y = Number(p[2]);
  if (d < 1 || d > 31 || m < 1 || m > 12 || y < 1900 || y > 2100) return new Date('invalid');
  return new Date(y, m - 1, d);
}

function parseMontantFR_(s) {
  const x = String(s || '')
    .replace(/[€\s]/g, '')
    .replace(/\u00A0/g, '')
    .replace(',', '.');
  return Number(x);
}

function formatDateFR_(d) {
  return Utilities.formatDate(d, 'Europe/Paris', 'dd/MM/yyyy');
}

function formatDateTimeFR_(d) {
  if (!d) return '';
  try {
    const dt = d instanceof Date ? d : new Date(d);
    if (isNaN(dt.getTime())) return '';
    return Utilities.formatDate(dt, 'Europe/Paris', 'dd/MM/yyyy HH:mm:ss');
  } catch (e) {
    return '';
  }
}


// =============================================================================
//  NETTOYAGE LIBELLÉ
// =============================================================================
function nettoyerLibelle_(lib) {
  let s = String(lib || '');

  s = s.replace(/PRELVT SEPA.*$/i, '');
  s = s.replace(/PRLV SEPA.*$/i, '');

  s = s.replace(/VIREMENT INSTANTANE\s*/i, '');
  s = s.replace(/VIR\.PERMANENT\s*/i, '');
  s = s.replace(/VIR INST\s*/i, '');
  s = s.replace(/VIR(EMENT)?\s+(SEPA\s+)?/i, '');

  s = s.replace(/CARTE \d{2}\/\d{2}\s*/i, '');
  s = s.replace(/CB\s*\d{2}\/\d{2}\s*/i, '');

  s = s.replace(/\s*ICS\.[A-Z0-9]+.*$/i, '');
  s = s.replace(/\s*\.RUM\.[A-Z0-9]+.*$/i, '');
  s = s.replace(/\s*[SIC]DR\d{6,}.*$/i, '');
  s = s.replace(/\s*IPA\d{6,}.*$/i, '');
  s = s.replace(/\s*SEPA\s+\d{5}\s+\d+[A-Z]?$/i, '');
  s = s.replace(/\s*Vt vers\s*:.*$/i, '');

  s = s.replace(/RETRAIT DAB\s*/i, 'Retrait ');
  s = s.replace(/^AVOIR\s*/i, 'Remb. ');
  s = s.replace(/PRET IMMOBILIER ECH.*/i, 'Crédit Maison');

  s = s.replace(/\s+/g, ' ').trim();

  if (s.length > 60) s = s.substring(0, 57) + '...';
  return s || String(lib || '').substring(0, 40);
}


// =============================================================================
//  DÉDOUBLONNAGE — Clés + lecture existants
// =============================================================================
function arrondirCentimes_(montant) {
  return Math.round((Number(montant) + Number.EPSILON) * 100);
}

function cleDedoublonnage_(date, libelle, montant) {
  const d = Utilities.formatDate(date, 'Europe/Paris', 'yyyy-MM-dd');
  const l = String(libelle || '').toLowerCase().replace(/\s+/g, ' ').trim()
    .substring(0, CONFIG.LIBELLE_DEDOUBLONNAGE_MAX_LEN);
  return d + '|' + l + '|' + arrondirCentimes_(montant);
}

function cleLibelleMontant_(libelle, montant) {
  const l = String(libelle || '').toLowerCase().replace(/\s+/g, ' ').trim()
    .substring(0, CONFIG.LIBELLE_DEDOUBLONNAGE_MAX_LEN);
  return l + '|' + arrondirCentimes_(montant);
}

/**
 * Première cellule vide en colonne D (Libellé) → append
 */
function getFirstEmptyRowInColumnD_(sheet, startRow) {
  const max = sheet.getMaxRows();
  const n = max - startRow + 1;
  if (n <= 0) return startRow;

  const values = sheet.getRange(startRow, CONFIG.COL.LIBELLE, n, 1).getValues();
  for (let i = 0; i < values.length; i++) {
    const v = values[i][0];
    if (v === null || v === undefined) return startRow + i;
    if (String(v).trim() === '') return startRow + i;
  }
  return startRow + values.length;
}

function chargerTransactionsExistantes_(sheet) {
  const strict = new Map();
  const libelleMontant = new Map();

  const start = CONFIG.PREMIERE_LIGNE_DATA;
  const firstEmptyD = getFirstEmptyRowInColumnD_(sheet, start);
  const lastDataRow = firstEmptyD - 1;

  logImport_('DEBUG', 'Chargement existants', { start, firstEmptyD, lastDataRow });

  if (lastDataRow < start) return { strict, libelleMontant };

  const n = lastDataRow - start + 1;

  // Lire uniquement A, D, F (pas B)
  const dates = sheet.getRange(start, CONFIG.COL.DATE, n, 1).getValues();
  const libelles = sheet.getRange(start, CONFIG.COL.LIBELLE, n, 1).getValues();
  const montants = sheet.getRange(start, CONFIG.COL.MONTANT, n, 1).getValues();

  for (let i = 0; i < n; i++) {
    const dateVal = dates[i][0];
    const libVal = libelles[i][0];
    const mtVal = montants[i][0];

    if (!dateVal || !libVal || mtVal === '' || mtVal === null || mtVal === undefined) continue;

    const date = dateVal instanceof Date ? dateVal : new Date(dateVal);
    if (isNaN(date.getTime())) continue;

    const lib = String(libVal);
    const mt = Number(mtVal);

    const kStrict = cleDedoublonnage_(date, lib, mt);
    strict.set(kStrict, (strict.get(kStrict) || 0) + 1);

    const kLM = cleLibelleMontant_(lib, mt);
    if (!libelleMontant.has(kLM)) libelleMontant.set(kLM, []);
    libelleMontant.get(kLM).push(formatDateFR_(date));
  }

  logImport_('DEBUG', 'Existants chargés', { strictCount: strict.size, lmCount: libelleMontant.size });
  return { strict, libelleMontant };
}


// =============================================================================
//  ✅ ÉCRITURE BATCH — SANS COLONNES B ET H
//  - Écrit A, C→G, I→J (H jamais écrite)
// =============================================================================
function ecrireBatch_SANS_COL_B_ET_SANS_COL_H_(sheet, nouvelles) {
  if (!nouvelles || nouvelles.length === 0) {
    logImport_('WARN', 'ecrireBatch_ appelé avec 0 transactions');
    return;
  }

  const dateImport = Utilities.formatDate(new Date(), 'Europe/Paris', 'dd/MM/yyyy');
  const start = CONFIG.PREMIERE_LIGNE_DATA;

  const appendStart = getFirstEmptyRowInColumnD_(sheet, start);

  logImport_('INFO', 'Écriture batch (sans H)', {
    count: nouvelles.length,
    appendStart: appendStart,
    premiereLigne: start
  });

  // Index max existant en C
  let indexMax = 0;
  if (appendStart > start) {
    const nExisting = appendStart - start;
    const existingIndexes = sheet.getRange(start, CONFIG.COL.INDEX, nExisting, 1).getValues();
    for (let i = 0; i < existingIndexes.length; i++) {
      const v = Number(existingIndexes[i][0]);
      if (!isNaN(v) && v > indexMax) indexMax = v;
    }
  }

  const rowsA = [];
  const rowsCtoG = []; // C,D,E,F,G (5 colonnes)
  const rowsItoJ = []; // I,J (2 colonnes)

  for (let i = 0; i < nouvelles.length; i++) {
    const tx = nouvelles[i];
    indexMax++;

    const sig = 'LINXO|' + arrondirCentimes_(tx.montant) + '|' +
      Utilities.formatDate(tx.date, 'Europe/Paris', 'yyyy-MM-dd') + '|' + String(tx.libelle || '');

    const base = 'Import Gmail Linxo ' + dateImport + ' — ' + sig;
    const commentaireFinal = tx.commentaire ? (base + ' — ' + tx.commentaire) : base;

    rowsA.push([tx.date]);

    rowsCtoG.push([
      indexMax,      // C - Index
      tx.libelle,    // D - Libellé
      tx.compte,     // E - Compte
      tx.montant,    // F - Montant
      '',            // G - Remboursement (vide)
    ]);

    rowsItoJ.push([
      '',             // I - Pointé (vide)
      commentaireFinal // J - Commentaires
    ]);
  }

  const n = rowsA.length;

  // A
  sheet.getRange(appendStart, CONFIG.COL.DATE, n, 1).setValues(rowsA);

  // C→G (5 colonnes) : C(3) à G(7)
  sheet.getRange(appendStart, CONFIG.COL.INDEX, n, 5).setValues(rowsCtoG);

  // I→J (2 colonnes) : I(9) à J(10)
  sheet.getRange(appendStart, CONFIG.COL.POINTE, n, 2).setValues(rowsItoJ);

  // Formats
  sheet.getRange(appendStart, CONFIG.COL.DATE, n, 1).setNumberFormat('dd/MM/yyyy');
  sheet.getRange(appendStart, CONFIG.COL.MONTANT, n, 1).setNumberFormat('#,##0.00');

  SpreadsheetApp.flush();

  // ✅ Post-check sur D (libellé) + F (montant) pour prouver l’écriture effective
  const rbD = sheet.getRange(appendStart, CONFIG.COL.LIBELLE, n, 1).getValues();
  const rbF = sheet.getRange(appendStart, CONFIG.COL.MONTANT, n, 1).getValues();

  for (let i = 0; i < n; i++) {
    const expectedLib = String(nouvelles[i].libelle || '');
    const expectedMt = Number(nouvelles[i].montant);

    const gotLib = String(rbD[i][0] || '');
    const gotMt = Number(rbF[i][0]);

    if (gotLib !== expectedLib || Math.round(gotMt * 100) !== Math.round(expectedMt * 100)) {
      throw new Error(
        'Post-check KO ligne ' + (appendStart + i) +
        ' | attendu [' + expectedLib + ' | ' + expectedMt + '] ' +
        ' | lu [' + gotLib + ' | ' + gotMt + ']'
      );
    }
  }

  logImport_('INFO', 'Écriture terminée (sans H)', {
    lignesEcrites: n,
    plage: 'A' + appendStart + ':J' + (appendStart + n - 1) + ' (H non écrite)'
  });
}


// =============================================================================
//  MAPPING
// =============================================================================
function chargerMapping_(ss) {
  const sh = ss.getSheetByName(CONFIG.SHEET_MAPPING);
  const m = {};
  if (!sh) return m;
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const k = String(data[i][0] || '').trim();
    const v = String(data[i][1] || '').trim();
    if (k && v) m[k] = v;
  }
  return m;
}

function creerOuMettreAJourMapping() {
  if (!CONFIG.SPREADSHEET_ID || CONFIG.SPREADSHEET_ID === 'A_REMPLACER_PAR_TON_ID') {
    SpreadsheetApp.getUi().alert('❌ CONFIG.SPREADSHEET_ID non renseigné.');
    return;
  }

  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const ui = SpreadsheetApp.getUi();

  let sh = ss.getSheetByName(CONFIG.SHEET_MAPPING);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.SHEET_MAPPING);
    sh.getRange(1, 1, 1, 2).setValues([['Catégorie Linxo', 'Ma Catégorie']]).setFontWeight('bold');
    sh.setColumnWidth(1, 280);
    sh.setColumnWidth(2, 280);
  }

  const categoriesBudget = getCategoriesBudgetExistantes_(ss);
  const categoriesLinxo = collecterCategoriesLinxoDepuisHistorique_(ss);

  const existingData = sh.getDataRange().getValues();
  const mappingExistant = {};
  for (let i = 1; i < existingData.length; i++) {
    const catLinxo = String(existingData[i][0] || '').trim();
    const maCategorie = String(existingData[i][1] || '').trim();
    if (catLinxo) mappingExistant[catLinxo] = maCategorie;
  }

  const rows = categoriesLinxo.map(function(catLinxo) {
    return [catLinxo, mappingExistant[catLinxo] || ''];
  });

  sh.clearContents();
  sh.getRange(1, 1, 1, 2).setValues([['Catégorie Linxo', 'Ma Catégorie']]).setFontWeight('bold');

  if (rows.length > 0) {
    sh.getRange(2, 1, rows.length, 2).setValues(rows);
  }

  if (categoriesBudget.length > 0) {
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(categoriesBudget, true)
      .setAllowInvalid(true)
      .build();
    const nbRows = Math.max(rows.length, 1);
    sh.getRange(2, 2, nbRows, 1).setDataValidation(rule);
  }

  sh.setColumnWidth(1, 280);
  sh.setColumnWidth(2, 280);

  ui.alert(
    '✅ Mapping rafraîchi : ' +
    categoriesLinxo.length + ' catégorie(s) Linxo détectée(s), avec liste déroulante sur ' +
    categoriesBudget.length + ' catégorie(s) budget.'
  );
}

function getCategoriesBudgetExistantes_(ss) {
  const depenses = ss.getSheetByName(CONFIG.SHEET_DEPENSES);
  if (!depenses) return [];

  const lastRow = depenses.getLastRow();
  if (lastRow < CONFIG.PREMIERE_LIGNE_DATA) return [];

  const values = depenses
    .getRange(CONFIG.PREMIERE_LIGNE_DATA, CONFIG.COL.CATEGORIE, lastRow - CONFIG.PREMIERE_LIGNE_DATA + 1, 1)
    .getValues();

  const set = new Set();
  for (const row of values) {
    const v = String(row[0] || '').trim();
    if (v) set.add(v);
  }
  return Array.from(set).sort();
}

function collecterCategoriesLinxoDepuisHistorique_(ss) {
  const set = new Set();

  // 1) Onglet mapping existant (ne jamais perdre des catégories déjà connues)
  const mappingSh = ss.getSheetByName(CONFIG.SHEET_MAPPING);
  if (mappingSh) {
    const mappingData = mappingSh.getDataRange().getValues();
    for (let i = 1; i < mappingData.length; i++) {
      const cat = String(mappingData[i][0] || '').trim();
      if (cat) set.add(cat);
    }
  }

  // 2) Historique feuille Dépenses via commentaires existants
  const depenses = ss.getSheetByName(CONFIG.SHEET_DEPENSES);
  if (depenses) {
    const lastRow = depenses.getLastRow();
    if (lastRow >= CONFIG.PREMIERE_LIGNE_DATA) {
      const commentaires = depenses
        .getRange(
          CONFIG.PREMIERE_LIGNE_DATA,
          CONFIG.COL.COMMENTAIRES,
          lastRow - CONFIG.PREMIERE_LIGNE_DATA + 1,
          1
        )
        .getValues();

      for (const row of commentaires) {
        const c = String(row[0] || '');
        const m = c.match(/Catégorie Linxo\s+"([^"]+)"/i);
        if (m && m[1]) set.add(m[1].trim());
      }
    }
  }

  // 3) Historique Gmail Linxo : source la plus fiable pour récupérer les catégories d'origine
  const q =
    'from:(' + CONFIG.GMAIL_FROM + ') ' +
    'subject:(' + JSON.stringify(CONFIG.GMAIL_SUBJECT_CONTAINS) + ') ' +
    'newer_than:' + CONFIG.GMAIL_NEWER_THAN_DAYS + 'd';
  const threads = GmailApp.search(q, 0, CONFIG.MAX_EMAILS_PAR_BATCH);
  for (const th of threads) {
    const messages = th.getMessages();
    for (const msg of messages) {
      const html = getHtmlRobusteDepuisMessage_(msg);
      const parsed = parserEmailLinxoHTML_Robuste_(html);
      const txs = (parsed.transactions || []).slice(0, CONFIG.MAX_TRANSACTIONS_PAR_EMAIL);
      for (const tx of txs) {
        const catLinxo = String(tx.categorieLinxo || '').trim();
        if (catLinxo) set.add(catLinxo);
      }
    }
  }

  return Array.from(set).sort();
}


// =============================================================================
//  GMAIL UTILS
// =============================================================================
function getOrCreateGmailLabel_(name) {
  let label = GmailApp.getUserLabelByName(name);
  if (!label) label = GmailApp.createLabel(name);
  return label;
}


// =============================================================================
//  MESSAGE-LEVEL "déjà traité" via Script Properties
// =============================================================================
const PROCESSED_STORE_KEY = 'LINXO_PROCESSED_MSG_IDS';
const PROCESSED_STORE_MAX = 4000;

function loadProcessedMessageIds_() {
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty(PROCESSED_STORE_KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

function saveProcessedMessageIds_(arr) {
  const props = PropertiesService.getScriptProperties();
  const sliced = arr.length > PROCESSED_STORE_MAX ? arr.slice(arr.length - PROCESSED_STORE_MAX) : arr;
  props.setProperty(PROCESSED_STORE_KEY, JSON.stringify(sliced));
}

function isMessageAlreadyProcessed_(msgId) {
  const arr = loadProcessedMessageIds_();
  return arr.indexOf(msgId) !== -1;
}

function markMessageProcessed_(msgId) {
  const arr = loadProcessedMessageIds_();
  if (arr.indexOf(msgId) !== -1) return;
  arr.push(msgId);
  saveProcessedMessageIds_(arr);
}


// =============================================================================
//  DRIVE API (Service avancé) — dossiers + fichiers
// =============================================================================
function driveApi_getOrCreateFolder_(name, parentId) {
  const safeName = String(name).replace(/'/g, "\\'");
  const qParts = [
    "mimeType='application/vnd.google-apps.folder'",
    "trashed=false",
    "name='" + safeName + "'"
  ];
  if (parentId) qParts.push("'" + parentId + "' in parents");

  const res = Drive.Files.list({
    q: qParts.join(' and '),
    fields: 'files(id,name)',
    pageSize: 10
  });

  if (res.files && res.files.length) return res.files[0].id;

  const resource = {
    name: name,
    mimeType: 'application/vnd.google-apps.folder',
    parents: parentId ? [parentId] : undefined
  };

  const created = Drive.Files.create(resource);
  return created.id;
}

function driveApi_getImportFolderId_() {
  const rootId = driveApi_getOrCreateFolder_(CONFIG.DOSSIER_DRIVE, null);
  const importedId = driveApi_getOrCreateFolder_(CONFIG.SOUS_DOSSIER_DRIVE, rootId);
  return importedId;
}

function driveApi_createFile_(parentId, filename, blobOrString, mimeType) {
  let blob;
  if (blobOrString && typeof blobOrString.getBytes === 'function') {
    blob = blobOrString;
  } else {
    blob = Utilities.newBlob(String(blobOrString || ''), mimeType || 'application/octet-stream', filename);
  }

  const resource = {
    name: filename,
    parents: parentId ? [parentId] : undefined
  };

  return Drive.Files.create(resource, blob);
}


// =============================================================================
//  ARCHIVAGE EML (Drive API)
// =============================================================================
function archiverEmailDansDrive_API_(message) {
  const destId = driveApi_getImportFolderId_();

  const dateStr = Utilities.formatDate(message.getDate(), 'Europe/Paris', 'yyyy-MM-dd_HH-mm');
  const safeSubject = String(message.getSubject() || 'Linxo')
    .replace(/[\\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 80);

  const filename = dateStr + '__' + safeSubject + '.eml';

  const raw = message.getRawContent();
  const blob = Utilities.newBlob(raw, 'message/rfc822', filename);

  driveApi_createFile_(destId, filename, blob);
}


// =============================================================================
//  CSV AUDIT — export dans Drive (Drive API)
// =============================================================================
function genererCsvAuditDansDrive_API_(audit, stats) {
  const destId = driveApi_getImportFolderId_();

  const ts = Utilities.formatDate(new Date(), 'Europe/Paris', 'yyyy-MM-dd_HH-mm-ss');
  const filename = ts + '__audit_import_gmail_linxo.csv';

  const lines = [];
  const sep = ';';

  lines.push(['SECTION', 'KEY', 'VALUE'].join(sep));
  lines.push(['META', 'emails_scannes', String(stats.totalEmails || 0)].join(sep));
  lines.push(['META', 'transactions_vues', String(stats.totalTx || 0)].join(sep));
  lines.push(['META', 'importees', String(stats.nbImportees || 0)].join(sep));
  lines.push(['META', 'doublons_strict', String(stats.nbDoublonsStrict || 0)].join(sep));
  lines.push(['META', 'doublons_potentiels', String(stats.nbPotentiels || 0)].join(sep));
  lines.push(['META', 'filtrees_compte', String(stats.nbIgnorees || 0)].join(sep));
  lines.push(['META', 'importees_a_recategoriser', String(stats.nbCatARecategoriser || 0)].join(sep));
  lines.push(['META', 'invalides_parsing', String(stats.nbInvalides || 0)].join(sep));
  lines.push('');

  pushAuditSection_(lines, 'IMPORTED', audit.imported, sep, [
    'statut', 'date', 'libelle', 'montant',
    'compteLinxo', 'compteBudget',
    'categorieLinxo', 'categorieBudget', 'commentaire'
  ]);

  pushAuditSection_(lines, 'FILTERED_COMPTE', audit.filtered, sep, [
    'statut', 'date', 'libelle', 'montant',
    'compteLinxo', 'compteBudget', 'categorieLinxo'
  ]);

  pushAuditSection_(lines, 'STRICT_DUPLICATES', audit.strictDuplicates, sep, [
    'statut', 'date', 'libelle', 'montant',
    'compteLinxo', 'compteBudget', 'categorieLinxo'
  ]);

  pushAuditSection_(lines, 'POTENTIAL_DUPLICATES', audit.potentialDuplicates, sep, [
    'statut', 'date', 'libelle', 'montant',
    'compteLinxo', 'compteBudget', 'categorieLinxo', 'note'
  ]);

  lines.push(['SECTION', 'INVALID_PARSING'].join(sep));
  lines.push(['emailDate', 'subject', 'warning'].join(sep));
  for (const w of (audit.invalid || [])) {
    lines.push([
      csvCell_(formatDateTimeFR_(w.emailDate)),
      csvCell_(String(w.subject || '')),
      csvCell_(String(w.warning || '')),
    ].join(sep));
  }
  lines.push('');

  const csv = lines.join('\n');
  const blob = Utilities.newBlob(csv, 'text/csv;charset=utf-8', filename);
  driveApi_createFile_(destId, filename, blob);

  return filename;
}

function pushAuditSection_(lines, sectionName, rows, sep, headers) {
  lines.push(['SECTION', sectionName].join(sep));
  lines.push(headers.join(sep));

  const arr = rows || [];
  for (const r of arr) {
    const out = headers.map(h => {
      if (h === 'date') return csvCell_(formatDateFR_safe_(r.date));
      if (h === 'montant') return csvCell_(formatMontantFR_(r.montant));
      return csvCell_(r[h]);
    });
    lines.push(out.join(sep));
  }
  lines.push('');
}

function csvCell_(v) {
  const s = v === null || v === undefined ? '' : String(v);
  if (s.includes(';') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function formatDateFR_safe_(d) {
  if (!d) return '';
  try {
    const dt = d instanceof Date ? d : new Date(d);
    if (isNaN(dt.getTime())) return '';
    return Utilities.formatDate(dt, 'Europe/Paris', 'dd/MM/yyyy');
  } catch (e) {
    return '';
  }
}

function formatMontantFR_(m) {
  if (m === null || m === undefined || m === '') return '';
  const n = Number(m);
  if (isNaN(n)) return '';
  return n.toFixed(2).replace('.', ',');
}


// =============================================================================
//  DEBUG: Drive API minimal
// =============================================================================
function debugDriveApi_() {
  const destId = driveApi_getImportFolderId_();
  const name = Utilities.formatDate(new Date(), 'Europe/Paris', 'yyyy-MM-dd_HH-mm-ss') + '__TEST_drive_api.txt';
  const created = Drive.Files.create(
    { name: name, parents: [destId] },
    Utilities.newBlob('ok', 'text/plain', name)
  );
  SpreadsheetApp.getUi().alert('OK Drive API, fichier créé : ' + name + '\nID=' + (created && created.id));
}


// =============================================================================
//  VÉRIFICATION ET FUSION DES CATÉGORIES
//  Feuille "Fusion Catégories" :
//    A = Catégorie actuelle   B = Nb utilisations
//    C = Fusionner avec       D = Suggestions automatiques
// =============================================================================
const SHEET_FUSION_CATEGORIES = 'Fusion Catégories';

function verifierEtFusionnerCategories_UI() {
  const ui = SpreadsheetApp.getUi();
  const res = verifierEtFusionnerCategories_();
  ui.alert(
    res.startsWith('❌') ? '❌ Erreur' : '✅ Analyse terminée',
    res,
    ui.ButtonSet.OK
  );
}

function appliquerFusionCategories_UI() {
  const ui = SpreadsheetApp.getUi();
  const btn = ui.alert(
    '⚠️ Appliquer les fusions ?',
    'Cette action va renommer les catégories dans la colonne H selon le tableau "' +
    SHEET_FUSION_CATEGORIES + '".\n\nContinuer ?',
    ui.ButtonSet.OK_CANCEL
  );
  if (btn !== ui.Button.OK) return;
  const res = appliquerFusionCategories_();
  ui.alert(
    res.startsWith('❌') ? '❌ Erreur' : '✅ Fusions appliquées',
    res,
    ui.ButtonSet.OK
  );
}

/**
 * Lit toutes les catégories de la colonne H, calcule les occurrences,
 * détecte les doublons potentiels (même intitulé sans les précisions entre
 * parenthèses, ou l'un est préfixe de l'autre), et génère l'onglet
 * "Fusion Catégories" à compléter manuellement avant d'appeler
 * appliquerFusionCategories_().
 */
function verifierEtFusionnerCategories_() {
  if (!CONFIG.SPREADSHEET_ID || CONFIG.SPREADSHEET_ID === 'A_REMPLACER_PAR_TON_ID') {
    return '❌ CONFIG.SPREADSHEET_ID non renseigné.';
  }

  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEET_DEPENSES);
  if (!sheet) return '❌ Onglet "' + CONFIG.SHEET_DEPENSES + '" introuvable.';

  const lastRow = sheet.getLastRow();
  if (lastRow < CONFIG.PREMIERE_LIGNE_DATA) return '⚠️ Aucune transaction trouvée.';

  // Lecture de toutes les catégories (colonne H)
  const n = lastRow - CONFIG.PREMIERE_LIGNE_DATA + 1;
  const values = sheet
    .getRange(CONFIG.PREMIERE_LIGNE_DATA, CONFIG.COL.CATEGORIE, n, 1)
    .getValues();

  const counts = {};
  for (const row of values) {
    const cat = String(row[0] || '').trim();
    if (cat) counts[cat] = (counts[cat] || 0) + 1;
  }

  const categories = Object.keys(counts).sort();
  if (categories.length === 0) return '⚠️ Aucune catégorie renseignée en colonne H.';

  // Normalisation : suppression des précisions entre parenthèses en fin de chaîne
  // Ex: "Kdo Anniversaire nous 4 (500€/pers)" → "kdo anniversaire nous 4"
  function normaliser_(s) {
    return s.toLowerCase()
      .replace(/\s*\([^)]*\)\s*$/, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Détection des doublons potentiels
  const suggestions = {};
  for (let i = 0; i < categories.length; i++) {
    const a = categories[i];
    const aNorm = normaliser_(a);
    const best = [];
    for (let j = 0; j < categories.length; j++) {
      if (i === j) continue;
      const b = categories[j];
      const bNorm = normaliser_(b);
      // Même racine une fois les parenthèses retirées
      if (aNorm === bNorm && aNorm.length > 0) {
        best.push(b);
        continue;
      }
      // L'un est préfixe strict de l'autre (au moins 4 caractères)
      if (aNorm.length >= 4 && bNorm.length >= 4) {
        if (bNorm.startsWith(aNorm + ' ') || aNorm.startsWith(bNorm + ' ')) {
          best.push(b);
        }
      }
    }
    if (best.length > 0) suggestions[a] = best.join(', ');
  }

  // Écriture dans la feuille de fusion
  let fusionSheet = ss.getSheetByName(SHEET_FUSION_CATEGORIES);
  if (fusionSheet) {
    fusionSheet.clearContents();
    fusionSheet.clearFormats();
  } else {
    fusionSheet = ss.insertSheet(SHEET_FUSION_CATEGORIES);
  }

  const headers = [
    'Catégorie actuelle',
    'Nb utilisations',
    'Fusionner avec (à remplir)',
    'Suggestions auto',
  ];
  fusionSheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  fusionSheet.setFrozenRows(1);

  const rows = categories.map(cat => [
    cat,
    counts[cat],
    '',              // colonne C à remplir manuellement
    suggestions[cat] || '',
  ]);
  fusionSheet.getRange(2, 1, rows.length, headers.length).setValues(rows);

  // Validation colonne C : liste déroulante des catégories existantes
  if (categories.length > 0) {
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(categories, true)
      .setAllowInvalid(true)
      .build();
    fusionSheet.getRange(2, 3, rows.length, 1).setDataValidation(rule);
  }

  // Surlignage en jaune des lignes avec suggestion auto
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][3]) {
      fusionSheet.getRange(i + 2, 1, 1, headers.length).setBackground('#FFF3CD');
    }
  }

  fusionSheet.autoResizeColumns(1, headers.length);

  const nbSuggestions = Object.keys(suggestions).length;
  return [
    '✅ Analyse terminée.',
    '• ' + categories.length + ' catégorie(s) unique(s) trouvée(s).',
    '• ' + nbSuggestions + ' catégorie(s) avec doublon potentiel (surlignée(s) en jaune).',
    '• Onglet "' + SHEET_FUSION_CATEGORIES + '" créé/mis à jour.',
    '',
    'Étapes suivantes :',
    '1. Ouvre l\'onglet "' + SHEET_FUSION_CATEGORIES + '".',
    '2. Pour chaque ligne, remplis la colonne C avec la catégorie cible (ou laisse vide).',
    '3. Lance "⚡ Appliquer les fusions de catégories" dans le menu.',
  ].join('\n');
}

/**
 * Lit la colonne C de l'onglet "Fusion Catégories" et renomme en masse
 * toutes les cellules de la colonne H (Catégorie) de "Dépenses catégorisée".
 * Les lignes de C vides ou identiques à A sont ignorées.
 */
function appliquerFusionCategories_() {
  if (!CONFIG.SPREADSHEET_ID || CONFIG.SPREADSHEET_ID === 'A_REMPLACER_PAR_TON_ID') {
    return '❌ CONFIG.SPREADSHEET_ID non renseigné.';
  }

  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const fusionSheet = ss.getSheetByName(SHEET_FUSION_CATEGORIES);
  if (!fusionSheet) {
    return '❌ Onglet "' + SHEET_FUSION_CATEGORIES + '" introuvable.' +
      ' Lance d\'abord "🔍 Vérifier & fusionner les catégories".';
  }

  // Lecture du tableau de fusion (A = ancienne, C = cible)
  const data = fusionSheet.getDataRange().getValues();
  const fusionMap = {};
  for (let i = 1; i < data.length; i++) {
    const ancienne = String(data[i][0] || '').trim();
    const cible    = String(data[i][2] || '').trim();
    if (ancienne && cible && ancienne !== cible) {
      fusionMap[ancienne] = cible;
    }
  }

  if (Object.keys(fusionMap).length === 0) {
    return '⚠️ Aucune fusion à appliquer. Remplis la colonne C de l\'onglet "' +
      SHEET_FUSION_CATEGORIES + '" avec les catégories cibles.';
  }

  const sheet = ss.getSheetByName(CONFIG.SHEET_DEPENSES);
  if (!sheet) return '❌ Onglet "' + CONFIG.SHEET_DEPENSES + '" introuvable.';

  const lastRow = sheet.getLastRow();
  if (lastRow < CONFIG.PREMIERE_LIGNE_DATA) return '⚠️ Aucune transaction trouvée.';

  const n = lastRow - CONFIG.PREMIERE_LIGNE_DATA + 1;
  const range = sheet.getRange(CONFIG.PREMIERE_LIGNE_DATA, CONFIG.COL.CATEGORIE, n, 1);
  const values = range.getValues();

  let nbModif = 0;
  const compteurParFusion = {};
  for (let i = 0; i < values.length; i++) {
    const cat = String(values[i][0] || '').trim();
    if (cat && fusionMap[cat]) {
      const cle = cat + ' → ' + fusionMap[cat];
      compteurParFusion[cle] = (compteurParFusion[cle] || 0) + 1;
      values[i][0] = fusionMap[cat];
      nbModif++;
    }
  }

  if (nbModif === 0) {
    return '⚠️ Aucune cellule modifiée. Les catégories à fusionner ne se trouvent' +
      ' peut-être plus dans la feuille.';
  }

  range.setValues(values);
  SpreadsheetApp.flush();

  const detail = Object.entries(compteurParFusion)
    .sort((a, b) => b[1] - a[1])
    .map(([label, nb]) => '  ' + nb + 'x  ' + label)
    .join('\n');

  return [
    '✅ Fusions appliquées : ' + nbModif + ' cellule(s) modifiée(s).',
    '',
    'Détail :',
    detail,
  ].join('\n');
}


// =============================================================================
//  FIN DU CODE v6.3
// =============================================================================
