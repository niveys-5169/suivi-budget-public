"""
functions/firebase_db.py — Interface Firestore pour Cloud Functions
====================================================================

Version allégée de src/firebase_db.py adaptée à l'environnement Cloud Functions :
- Pas de FIREBASE_CREDENTIALS nécessaire : Firebase est initialisé via
  initialize_app() dans main.py en utilisant les droits natifs du runtime.
- Même logique de retry et de sauvegarde que src/firebase_db.py.

Divergence DÉLIBÉRÉE avec src/firebase_db.py (init Firebase différente +
fonctions propres à chaque environnement) : les deux fichiers ne doivent PAS
être fusionnés en copie unique. tests/test_shared_backend_sync.py fige ce choix.

Fonctions exposées :
  - charger_mapping_categories_linxo()
  - sauvegarder_transactions()
  - charger_ids_transactions_supprimees()
  - charger_transactions_existantes_pour_dedoublonnage()
  - charger_account_owners_mapping()
  - get_owner_for_account()
  - calcul_coherence_solde()
  - sauvegarder_soldes_comptes()
"""

import logging
import random
import time
from datetime import datetime, timedelta, timezone

from firebase_admin import firestore
from google.api_core.exceptions import NotFound, ResourceExhausted, ServiceUnavailable, DeadlineExceeded
from google.cloud.firestore_v1.base_query import FieldFilter

log = logging.getLogger(__name__)

_db = None  # singleton Firestore


def _get_db():
    """Retourne le client Firestore. Firebase doit déjà être initialisé (via initialize_app() dans main.py)."""
    global _db
    if _db is None:
        _db = firestore.client()
    return _db


def _stream_with_backoff(query, operation_name: str, timeout_s: int = 30, max_attempts: int = 3):
    """Itère un stream Firestore avec retry court pour éviter de bloquer sur un 429."""
    delay_s = 1.0
    for attempt in range(1, max_attempts + 1):
        try:
            results = list(query.stream(timeout=timeout_s))
            yield from results
            return
        except (ResourceExhausted, ServiceUnavailable, DeadlineExceeded) as e:
            if attempt == max_attempts:
                raise RuntimeError(
                    f"{operation_name}: échec après {max_attempts} tentatives ({type(e).__name__}: {e})"
                ) from e
            log.warning(
                f"{operation_name}: tentative {attempt}/{max_attempts} échouée "
                f"({type(e).__name__}), retry dans {delay_s:.1f}s..."
            )
            time.sleep(delay_s)
            delay_s *= 2


def _run_with_backoff(operation, operation_name: str, max_attempts: int = 6):
    """Exécute une opération Firestore avec retry exponentiel."""
    delay_s = 1.0
    for attempt in range(1, max_attempts + 1):
        try:
            return operation()
        except (ResourceExhausted, ServiceUnavailable, DeadlineExceeded) as e:
            if attempt == max_attempts:
                raise RuntimeError(
                    f"{operation_name}: échec après {max_attempts} tentatives ({type(e).__name__}: {e})"
                ) from e
            sleep_s = delay_s + random.uniform(0, 0.5)
            log.warning(
                f"{operation_name}: tentative {attempt}/{max_attempts} échouée "
                f"({type(e).__name__}), retry dans {sleep_s:.1f}s..."
            )
            time.sleep(sleep_s)
            delay_s = min(delay_s * 2, 20)


def charger_mapping_categories_linxo() -> dict:
    """Charge le mapping Firestore des catégories Linxo -> catégories budget."""
    db = _get_db()
    mapping = {}
    for doc in _stream_with_backoff(db.collection("linxo_category_mappings"), "Chargement mapping catégories"):
        data = doc.to_dict() or {}
        cat_linxo = str(data.get("linxoCategory", "")).strip()
        cat_budget = str(data.get("budgetCategory", "")).strip()
        if cat_linxo and cat_budget:
            mapping[cat_linxo] = cat_budget
    log.info(f"Mapping Linxo chargé : {len(mapping)} catégories.")
    return mapping


def charger_recurrences_actives() -> list[dict]:
    """Charge les récurrences actives (label, expectedAmount). Sert au filtre
    du pipeline de catégorisation IA — voir src/ai_categorizer.is_likely_recurrence."""
    db = _get_db()
    out: list[dict] = []
    try:
        for doc in _stream_with_backoff(db.collection("recurrences"), "Chargement récurrences actives"):
            data = doc.to_dict() or {}
            if data.get("active") is False:
                continue
            label = str(data.get("label") or "").strip()
            if not label:
                continue
            out.append({"label": label, "expectedAmount": data.get("expectedAmount"), "active": True})
    except NotFound as e:
        log.warning(f"Collection recurrences non trouvée : {e}")
    return out


def charger_ids_transactions_supprimees() -> set:
    """Retourne les IDs de transactions marquées comme supprimées par l'utilisateur."""
    db = _get_db()
    deleted_ids = set()
    for doc in _stream_with_backoff(db.collection("deleted_transactions"), "Chargement transactions supprimées"):
        if doc.id:
            deleted_ids.add(doc.id)
    return deleted_ids


def _transaction_id(compte: str, date: datetime, libelle: str, montant: float) -> str:
    """Génère un ID déterministe pour une transaction.

    Le compte fait partie de la clé : sans lui, deux opérations de comptes
    différents le même jour, même libellé, même montant produisent le même ID
    et s'écrasent silencieusement (batch.set merge=True). Le schéma d'ID reste
    volontairement mixte en base — les documents créés avant l'ajout du compte
    gardent leur ID (aucune migration), l'ID n'étant qu'un handle opaque jamais
    reparsé. La compat des tombstones est assurée par _legacy_transaction_id.
    """
    d = date.strftime("%Y-%m-%d")
    c = str(compte).lower().strip()[:40].replace(" ", "_").replace("/", "-")
    l = libelle.lower().strip()[:40].replace(" ", "_").replace("/", "-")
    m = str(round(montant * 100)).replace("-", "n")
    return f"{c}_{d}_{l}_{m}"


def _legacy_transaction_id(date: datetime, libelle: str, montant: float) -> str:
    """Format d'ID d'avant l'ajout du compte (date+libelle+montant).

    Utilisé uniquement pour honorer les tombstones `deleted_transactions` créés
    avant ce changement : une transaction supprimée avant la migration doit
    rester supprimée après."""
    d = date.strftime("%Y-%m-%d")
    l = libelle.lower().strip()[:40].replace(" ", "_").replace("/", "-")
    m = str(round(montant * 100)).replace("-", "n")
    return f"{d}_{l}_{m}"


def _resoudre_id_transaction(tx: dict, prefetch_map: dict) -> str:
    """Choisit l'ID de document d'une transaction, en préservant l'existant.

    Un document DÉJÀ EN BASE doit garder son ID : sinon l'import écrit un second
    exemplaire (avec pointe=False) au lieu de fusionner, ce qui a dupliqué ~286
    transactions lors du passage au format préfixé-compte.

      - doc hérité existant et de même compte -> on réutilise son ID ;
      - doc hérité existant d'un AUTRE compte -> collision inter-comptes,
        on prend le nouvel ID préfixé (le but initial du préfixe) ;
      - aucun doc hérité                       -> nouvel ID préfixé.

    `prefetch_map` : {doc_id: data} couvrant les deux formats d'ID.
    """
    legacy_id = _legacy_transaction_id(tx["date"], tx["libelle"], tx["montant"])
    legacy_doc = prefetch_map.get(legacy_id)
    if legacy_doc is not None and str(legacy_doc.get("compte", "")).strip() == str(tx["compte"]).strip():
        return legacy_id
    return _transaction_id(tx["compte"], tx["date"], tx["libelle"], tx["montant"])


def charger_transactions_existantes_pour_dedoublonnage(
    since_days: int = 365, email_date_min: datetime | None = None
) -> list[dict]:
    """Retourne les transactions existantes (date/libellé/montant) pour la déduplication."""
    db = _get_db()
    out = []
    try:
        query = db.collection("transactions").select(
            ["date", "libelle", "montant", "compte", "emailDate", "enAttente"]
        )
        if since_days > 0:
            cutoff = (datetime.now(timezone.utc) - timedelta(days=since_days)).strftime("%Y-%m-%d")
            query = query.where(filter=FieldFilter("date", ">=", cutoff))
        if email_date_min is not None:
            query = query.where(filter=FieldFilter("emailDate", ">=", email_date_min))
        for doc in _stream_with_backoff(query, "Chargement transactions pour dédoublonnage"):
            data = doc.to_dict() or {}
            date_str = str(data.get("date") or "").strip()
            libelle = str(data.get("libelle") or "").strip()
            montant = data.get("montant")
            if not date_str or not libelle or montant is None:
                continue
            out.append({
                "id": doc.id,
                "date": date_str,
                "libelle": libelle,
                "montant": float(montant),
                "compte": str(data.get("compte", "")).strip(),
                "emailDate": data.get("emailDate"),
                "enAttente": bool(data.get("enAttente", False)),
            })
    except NotFound as e:
        log.warning(f"Collection transactions non trouvée : {e}")
    return out


def charger_transactions_pour_coherence(comptes) -> list[dict]:
    """Transactions utiles au contrôle de cohérence des soldes de `comptes`.

    calcul_coherence_solde ne retient que les transactions dont l'emailDate
    (datetime) est postérieure à celle du solde stocké du compte : inutile de
    relire toute la collection. On borne donc la requête par la plus ancienne
    de ces emailDate. Un compte sans solde stocké n'a pas de contrôle (ignoré) ;
    un solde stocké sans emailDate exploitable impose le scan complet, comme
    avant.
    """
    from balance_coherence import ensure_utc
    db = _get_db()
    bornes = []
    for compte in set(comptes):
        snap = db.collection("account_balances").document(compte).get()
        if not snap.exists:
            continue
        email_date = ensure_utc((snap.to_dict() or {}).get("emailDate"))
        if email_date is None:
            return charger_transactions_existantes_pour_dedoublonnage(since_days=0)
        bornes.append(email_date)
    if not bornes:
        return []
    return charger_transactions_existantes_pour_dedoublonnage(since_days=0, email_date_min=min(bornes))


_UNCATEGORIZED_LABELS = {"", "a catégoriser", "a categoriser", "non catégorisé", "non categorise"}


def charger_transactions_categorisees(since_days: int = 730, limit: int = 5000) -> list[dict]:
    """Corpus d'apprentissage du RAG : transactions déjà catégorisées par
    l'utilisateur. Voir src/firebase_db.charger_transactions_categorisees."""
    db = _get_db()
    out: list[dict] = []
    try:
        query = db.collection("transactions").select(
            ["date", "libelle", "montant", "compte", "categorie"]
        )
        if since_days > 0:
            cutoff = (datetime.now(timezone.utc) - timedelta(days=since_days)).strftime("%Y-%m-%d")
            query = query.where(filter=FieldFilter("date", ">=", cutoff))
        for doc in _stream_with_backoff(query, "Chargement transactions catégorisées"):
            data = doc.to_dict() or {}
            categorie = str(data.get("categorie") or "").strip()
            if categorie.lower() in _UNCATEGORIZED_LABELS:
                continue
            libelle = str(data.get("libelle") or "").strip()
            montant = data.get("montant")
            if not libelle or montant is None:
                continue
            out.append({
                "date": str(data.get("date") or "").strip(),
                "libelle": libelle,
                "montant": float(montant),
                "compte": str(data.get("compte", "")).strip(),
                "categorie": categorie,
            })
            if len(out) >= limit:
                break
    except NotFound as e:
        log.warning(f"Collection transactions non trouvée : {e}")
    log.info(f"Corpus catégorisation IA : {len(out)} transactions étiquetées.")
    return out


def charger_account_owners_mapping() -> dict:
    """Charge le mapping Firestore des comptes → propriétaires."""
    db = _get_db()
    try:
        doc = db.collection("metadata").document("account_owners_mapping").get()
        if doc.exists:
            data = doc.to_dict() or {}
            return {
                "accounts": data.get("accounts", {}),
                "savings_patterns": data.get("savings_patterns", {}),
                "default_owner": data.get("default_owner", "Nicolas"),
            }
    except NotFound as e:
        log.warning(f"Metadata non trouvée : {e}")
    except Exception as e:
        log.warning(f"Erreur chargement mapping compte→propriétaire : {e}")
    
    return {
        "accounts": {"BforBank": "Nicolas", "LCL": "Nicolas"},
        "savings_patterns": {},
        "default_owner": "Nicolas",
    }


def slugify_asset(s: str) -> str:
    """Convertit un nom en slug lisible sans accents (même logique que assetId.ts côté frontend)."""
    import unicodedata, re
    s = unicodedata.normalize('NFD', s)
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    s = s.lower()
    s = re.sub(r'[^a-z0-9]+', '-', s)
    return s.strip('-')


def get_owner_for_account(compte: str, mapping: dict | None = None) -> str:
    """Détermine le propriétaire d'un compte courant."""
    if mapping is None:
        mapping = charger_account_owners_mapping()
    compte = str(compte).strip()
    owner = mapping.get("accounts", {}).get(compte)
    if owner:
        return owner
    return mapping.get("default_owner", "Nicolas")


def get_owner_for_savings(compte_epargne: str, mapping: dict | None = None) -> str:
    """Détermine le propriétaire d'une épargne par pattern matching."""
    if mapping is None:
        mapping = charger_account_owners_mapping()
    compte_epargne = str(compte_epargne).strip()
    patterns = mapping.get("savings_patterns", {})
    if compte_epargne in patterns:
        return patterns[compte_epargne]
    for pattern, owner in patterns.items():
        if pattern.lower() in compte_epargne.lower():
            return owner
    return mapping.get("default_owner", "Nicolas")


def calcul_coherence_solde(
    compte: str,
    nouveau_solde: float,
    email_date: datetime | None = None,
    upper_email_date: datetime | None = None,
    tx_all: list[dict] | None = None,
) -> dict:
    """Wrapper Firestore autour des fonctions pures de balance_coherence.

    Lit l'ancien solde depuis account_balances/{compte}, charge les transactions
    existantes, puis délègue le calcul à compute_coherence() et
    filter_window_transactions().

    `upper_email_date` borne la fenêtre de transactions par le haut (inclus) :
    quand plusieurs mails Linxo du même compte arrivent le même jour, valider le
    solde d'un mail ne doit compter que les transactions jusqu'à ce mail.

    `tx_all` : si fourni, remplace le chargement interne de
    charger_transactions_existantes_pour_dedoublonnage(since_days=0). Permet à
    l'appelant qui traite plusieurs soldes dans la même invocation de ne
    scanner la collection `transactions` qu'une seule fois au lieu d'une fois
    par solde.
    """
    from balance_coherence import ensure_utc, filter_window_transactions, compute_coherence
    db = _get_db()
    empty = {"previousSolde": None, "computedSolde": None, "linxoDelta": None, "ecart": None}

    try:
        latest_balance_doc = db.collection("account_balances").document(compte).get()
        if not latest_balance_doc.exists:
            return empty

        latest_balance = latest_balance_doc.to_dict() or {}
        previous_solde = latest_balance.get("solde")
        if previous_solde is None or not isinstance(previous_solde, (int, float)):
            return empty

        previous_solde = float(previous_solde)
        old_email_date = ensure_utc(latest_balance.get("emailDate"))
        upper_utc = ensure_utc(upper_email_date)

        if tx_all is None:
            tx_all = charger_transactions_existantes_pour_dedoublonnage(since_days=0)
        window_txs = filter_window_transactions(tx_all, compte, old_email_date, upper_utc)
        result = compute_coherence(previous_solde, nouveau_solde, window_txs)

        log.debug(
            f"Cohérence {compte}: "
            f"ancien={previous_solde:.2f}€ + transactions={result['linxoDelta']:.2f}€ "
            f"= attendu {result['computedSolde']:.2f}€ vs récupéré {nouveau_solde:.2f}€ "
            f"(écart: {result['ecart']:.2f}€)"
        )
        return result

    except NotFound:
        log.debug(f"Contrôle cohérence pour {compte} : Firestore non disponible")
    except Exception as e:
        log.warning(f"Erreur calcul cohérence solde {compte}: {e}")

    return empty


def charger_ids_emails_traites() -> set:
    """Retourne les IDs Gmail traités au cours des 30 derniers jours.

    La fenêtre de 30 jours est cohérente avec la recherche Gmail de
    _run_linxo_import_core (after_date = now - 30j), ce qui évite de charger
    des IDs anciens jamais rencontrés dans la file à traiter et réduit
    significativement les lectures Firestore lors des polls toutes les 15 min.
    """
    db = _get_db()
    processed_ids = set()
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(days=30)
        query = db.collection("processed_emails").where(
            filter=FieldFilter("processedAt", ">=", cutoff)
        )
        for doc in _stream_with_backoff(query, "Chargement emails traités"):
            processed_ids.add(doc.id)
    except Exception as e:
        log.warning(f"Erreur chargement IDs emails traités : {e}")
    return processed_ids


def marquer_email_traite(msg_id: str):
    """Enregistre un ID Gmail comme étant traité."""
    db = _get_db()
    doc_ref = db.collection("processed_emails").document(msg_id)
    _run_with_backoff(lambda: doc_ref.set({
        "processedAt": datetime.now(timezone.utc),
        "msgId": msg_id
    }), f"Marquage email traité {msg_id}")


def _email_date_solde_stocke(latest_col, compte: str) -> datetime | None:
    """emailDate (UTC) du solde courant stocké pour `compte`, None si inconnue."""
    from balance_coherence import ensure_utc
    snap = latest_col.document(compte).get()
    if not snap.exists:
        return None
    return ensure_utc((snap.to_dict() or {}).get("emailDate"))


def sauvegarder_soldes_comptes(soldes: list, source: str = "gmail") -> int:
    """Sauvegarde les soldes détectés et le contrôle de cohérence."""
    if not soldes:
        return 0
    from balance_coherence import ensure_utc
    db = _get_db()
    latest_col = db.collection("account_balances")
    history_col = db.collection("account_balance_history")
    now = datetime.now(timezone.utc)
    owner_mapping = charger_account_owners_mapping()
    batch = db.batch()
    email_date_courante = {}
    for s in soldes:
        compte = str(s.get("compte", "")).strip()
        if not compte:
            continue
        email_date = s.get("emailDate") or now
        if not isinstance(email_date, datetime):
            email_date = now
        owner = get_owner_for_account(compte, owner_mapping)
        payload = {
            "compte": compte,
            "current_balance": float(s["solde"]),
            "solde": float(s["solde"]),
            "previousSolde": s.get("previousSolde"),
            "linxoDelta": s.get("linxoDelta"),
            "computedSolde": s.get("computedSolde"),
            "ecart": s.get("ecart"),
            "status": s.get("status", "UNKNOWN"),
            "emailDate": email_date,
            "source": source,
            "owner": owner,
            "updatedAt": now,
            "last_updated": now,
        }
        if source == "gmail":
            payload["linxo_solde"] = float(s["solde"])
            payload["linxo_date"] = email_date
        if s.get("cross_ecart") is not None:
            payload["cross_ecart"] = float(s["cross_ecart"])
        if s.get("cross_status") is not None:
            payload["cross_status"] = s.get("cross_status")
        ts = email_date.strftime("%Y%m%d%H%M%S")
        history_id = f"{compte}_{ts}".replace("/", "-").replace(" ", "_")
        # Last-wins par emailDate, pas par ordre d'écriture : un mail plus ancien
        # que le solde stocké (reparse, mail retraité par un autre importeur…)
        # ne va que dans l'historique, sans régresser le solde courant.
        if compte not in email_date_courante:
            email_date_courante[compte] = _email_date_solde_stocke(latest_col, compte)
        courante = email_date_courante[compte]
        if courante is not None and ensure_utc(email_date) < courante:
            log.warning(
                f"Solde {compte} du {email_date:%Y-%m-%d %H:%M} plus ancien que le solde "
                f"stocké ({courante:%Y-%m-%d %H:%M}) : historique seul."
            )
        else:
            batch.set(latest_col.document(compte), payload, merge=True)
            email_date_courante[compte] = ensure_utc(email_date)
        batch.set(history_col.document(history_id), payload, merge=True)
    
    _run_with_backoff(lambda b=batch: b.commit(), "Commit soldes comptes")
    return len(soldes)


def take_patrimoine_snapshot() -> int:
    """Effectue un snapshot complet du patrimoine (placements, soldes, épargne, portefeuille).

    Convention unifiée pour placement_history :
      - Doc ID : {assetId}_{YYYY-MM-DD}
      - Section #1  placements manuels  → assetId = doc.id (Firestore)
      - Section #2  comptes courants    → assetId = {owner}_courant_{slugify(compte)}
      - Section #3  épargne/livrets     → assetId = {owner}_livret_{slugify(compte)}
      - Section #4  portefeuille        → assetId = portfolio_{isin}_{owner}_{envelope}
                                          (carry-forward depuis placement_history)
                                          Fallback : portefeuille_boursier si aucun holding connu
    """
    db = _get_db()
    now = datetime.now(timezone.utc)
    date_str = now.strftime("%Y-%m-%d")
    mapping = charger_account_owners_mapping()

    history_col = db.collection("placement_history")
    batch = db.batch()
    batch_size = 0
    count = 0

    def _write(doc_ref, payload):
        nonlocal batch, batch_size, count
        batch.set(doc_ref, payload, merge=True)
        batch_size += 1
        count += 1
        if batch_size >= 500:
            _run_with_backoff(lambda b=batch: b.commit(), "Commit snapshot patrimoine (chunk)")
            batch = db.batch()
            batch_size = 0

    # 1. Placements manuels (livrets, épargne salariale, etc.)
    try:
        for doc in db.collection("placements").stream():
            p = doc.to_dict() or {}
            asset_id = doc.id
            doc_id = f"{asset_id}_{date_str}"
            payload = {
                "date": date_str,
                "assetId": asset_id,
                "nom": p.get("nom", "Inconnu"),
                "montant": float(p.get("montant", 0)),
                "type": p.get("type", "autre"),
                "owner": p.get("owner", "Nicolas"),
                "snapshotAt": now
            }
            _write(history_col.document(doc_id), payload)
    except Exception as e:
        log.error(f"Erreur snapshot placements: {e}")

    # 2. Comptes courants
    try:
        for doc in db.collection("account_balances").stream():
            b = doc.to_dict() or {}
            compte = b.get("compte") or doc.id
            owner = (b.get("owner") or get_owner_for_account(compte, mapping)).lower()
            asset_id = f"{owner}_courant_{slugify_asset(compte)}"
            doc_id = f"{asset_id}_{date_str}"
            payload = {
                "date": date_str,
                "assetId": asset_id,
                "nom": compte,
                "montant": float(b.get("solde", 0)),
                "type": "courants",
                "owner": owner,
                "snapshotAt": now
            }
            _write(history_col.document(doc_id), payload)
    except Exception as e:
        log.error(f"Erreur snapshot comptes courants: {e}")

    # 3. Épargne (Livrets Linxo)
    try:
        for doc in db.collection("savings_balances").stream():
            s = doc.to_dict() or {}
            compte = s.get("compte") or doc.id
            owner = (s.get("owner") or get_owner_for_savings(compte, mapping)).lower()
            asset_id = f"{owner}_livret_{slugify_asset(compte)}"
            doc_id = f"{asset_id}_{date_str}"
            payload = {
                "date": date_str,
                "assetId": asset_id,
                "nom": compte,
                "montant": float(s.get("solde", 0)),
                "type": "epargne",
                "owner": owner,
                "snapshotAt": now
            }
            _write(history_col.document(doc_id), payload)
    except Exception as e:
        log.error(f"Erreur snapshot épargne: {e}")


    # 4. Portefeuille — carry-forward des dernières valeurs connues par holding
    try:
        # Récupère toutes les entrées portefeuille (per-holding) de placement_history
        portfolio_stream = (
            db.collection("placement_history")
            .where("type", "==", "portefeuille")
            .stream()
        )

        latest_by_asset: dict = {}
        for ph_doc in portfolio_stream:
            ph = ph_doc.to_dict() or {}
            asset_id = ph.get("assetId", "")
            # Ignore les anciens agrégats
            if not asset_id or asset_id in ("portefeuille_boursier", "portfolio_global"):
                continue
            existing = latest_by_asset.get(asset_id)
            if not existing or ph.get("date", "") > existing.get("date", ""):
                latest_by_asset[asset_id] = ph

        if latest_by_asset:
            # Garde-fou : ne pas écraser une valeur fraîche déjà écrite aujourd'hui
            # par sync_portfolio_daily() (cours réels) avec un simple carry-forward.
            fresh_today = set()
            try:
                today_refs = [
                    history_col.document(f"{asset_id}_{date_str}") for asset_id in latest_by_asset
                ]
                for snap in db.get_all(today_refs):
                    if snap.exists and (snap.to_dict() or {}).get("source") == "portfolio_daily_sync":
                        fresh_today.add((snap.to_dict() or {}).get("assetId", ""))
            except Exception as e:
                log.warning(f"Garde-fou carry-forward portefeuille indisponible: {e}")

            for asset_id, ph in latest_by_asset.items():
                if asset_id in fresh_today:
                    continue  # valeur du jour déjà à jour (cours réels)
                doc_id = f"{asset_id}_{date_str}"
                payload = {
                    "date": date_str,
                    "assetId": asset_id,
                    "nom": ph.get("nom", asset_id),
                    "montant": float(ph.get("montant", 0)),
                    "netInvested": float(ph.get("netInvested", 0)),
                    "type": "portefeuille",
                    "owner": ph.get("owner", "Commun"),
                    "envelope": ph.get("envelope", ""),
                    "isin": ph.get("isin", ""),
                    "source": "daily_snapshot",
                    "snapshotAt": now,
                }
                _write(history_col.document(doc_id), payload)
        else:
            # Fallback : aucun holding per-position connu, on lit l'agrégat metadata
            meta_doc = db.collection("metadata").document("patrimoine_settings").get()
            if meta_doc.exists:
                data = meta_doc.to_dict() or {}
                portfolio_value = float(data.get("portfolioValue", 0))
                if portfolio_value:
                    asset_id = "portefeuille_boursier"
                    doc_id = f"{asset_id}_{date_str}"
                    payload = {
                        "date": date_str,
                        "assetId": asset_id,
                        "nom": "Portefeuille Boursier",
                        "montant": portfolio_value,
                        "type": "portefeuille",
                        "owner": "Nicolas",
                        "snapshotAt": now,
                    }
                    _write(history_col.document(doc_id), payload)
    except Exception as e:
        log.error(f"Erreur snapshot portefeuille: {e}")

    if batch_size > 0:
        _run_with_backoff(lambda b=batch: b.commit(), "Commit snapshot patrimoine")
        log.info(f"Snapshot patrimoine effectué : {count} entrées.")

    return count


# ── Synchro quotidienne du portefeuille (projet Firebase séparé) ──────────────
# Le portefeuille boursier vit dans un projet Google distinct (`suivi-placements-nico`)
# qui rafraîchit ses cours côté serveur. On y lit les valeurs actuelles par position
# via le SDK Admin (accès gouverné par un droit IAM croisé : le compte de service des
# Functions budget doit être `roles/datastore.viewer` sur le projet portefeuille) et on
# les historise dans `placement_history` — sans qu'aucune app n'ait besoin d'être ouverte.

PORTFOLIO_PROJECT_ID = "suivi-placements-nico"

_portfolio_db = None  # singleton Firestore du projet portefeuille


def _safe_segment(s: str) -> str:
    """Miroir Python de safeSegment (portfolioReconstruction.ts) : minuscule, non-alphanum → '_'."""
    import re
    return re.sub(r"[^a-z0-9]", "_", str(s or "").lower())


def _holding_asset_id(isin: str, owner: str, envelope: str) -> str:
    """assetId stable d'une position boursière (identique à holdingAssetId côté frontend)."""
    return f"portfolio_{_safe_segment(isin)}_{_safe_segment(owner)}_{_safe_segment(envelope)}"


def _get_portfolio_db():
    """Client Firestore du projet portefeuille (via ADC + droit IAM croisé).

    On construit un client google.cloud.firestore ciblant EXPLICITEMENT le projet
    portefeuille : passer par firebase_admin risque de retomber sur le projet du
    runtime (budget) et de lire une collection vide sans erreur.
    """
    global _portfolio_db
    if _portfolio_db is None:
        from google.cloud import firestore as gcf
        _portfolio_db = gcf.Client(project=PORTFOLIO_PROJECT_ID)
    return _portfolio_db


def _num(*vals) -> float:
    """Premier nombre exploitable parmi vals (fallbacks de mapping)."""
    for v in vals:
        if v is None:
            continue
        try:
            return float(v)
        except (TypeError, ValueError):
            continue
    return 0.0


def sync_portfolio_daily() -> int:
    """Historise les valeurs ACTUELLES par position du portefeuille (cours réels du jour).

    Lit `users/{portfolioUid}/holdings` dans le projet portefeuille et écrit un point du
    jour par position dans `placement_history` (projet budget), source 'portfolio_daily_sync'.
    Idempotent (docId {assetId}_{date} + merge). Retourne le nombre d'entrées écrites.
    """
    db = _get_db()

    # Identifiant du compte portefeuille, renseigné côté client lors de la synchro.
    settings = db.collection("metadata").document("patrimoine_settings").get()
    uid = (settings.to_dict() or {}).get("portfolioUid") if settings.exists else None
    if not uid:
        log.warning("sync_portfolio_daily: portfolioUid absent de metadata/patrimoine_settings.")
        return 0

    try:
        pdb = _get_portfolio_db()
    except Exception as e:
        log.error(f"sync_portfolio_daily: accès projet portefeuille impossible: {e}")
        return 0

    now = datetime.now(timezone.utc)
    date_str = now.strftime("%Y-%m-%d")
    history_col = db.collection("placement_history")
    batch = db.batch()
    count = 0

    try:
        holdings = list(pdb.collection(f"users/{uid}/holdings").stream())
    except Exception as e:
        log.error(f"sync_portfolio_daily: lecture holdings échouée: {e}")
        return 0

    log.info(
        f"sync_portfolio_daily: {len(holdings)} holdings lus "
        f"(projet={PORTFOLIO_PROJECT_ID}, uid={uid})."
    )

    for hdoc in holdings:
        h = hdoc.to_dict() or {}
        isin = str(h.get("isin") or hdoc.id or "").strip()
        if not isin:
            continue
        current_value = _num(h.get("current_value"), h.get("currentValue"), h.get("value"))
        if current_value <= 0:
            continue
        owner = str(h.get("owner") or "Nicolas").strip() or "Nicolas"
        envelope = str(h.get("envelope") or h.get("account") or "").strip()
        net_invested = _num(h.get("total_invested"), h.get("total_cost"), h.get("totalCost"))
        nom = str(h.get("name") or h.get("short_name") or isin.upper())

        asset_id = _holding_asset_id(isin, owner, envelope or "default")
        payload = {
            "date": date_str,
            "assetId": asset_id,
            "nom": nom,
            "montant": round(current_value, 2),
            "netInvested": round(net_invested, 2),
            "type": "portefeuille",
            "owner": owner,
            "envelope": envelope,
            "isin": isin,
            "source": "portfolio_daily_sync",
            "snapshotAt": now,
        }
        batch.set(history_col.document(f"{asset_id}_{date_str}"), payload, merge=True)
        count += 1
        if count % 500 == 0:
            _run_with_backoff(lambda b=batch: b.commit(), "Commit sync portefeuille (chunk)")
            batch = db.batch()

    if count % 500 != 0 and count > 0:
        _run_with_backoff(lambda b=batch: b.commit(), "Commit sync portefeuille")
    log.info(f"Sync portefeuille quotidienne : {count} positions écrites.")

    return count


def get_gmail_history_id() -> str | None:
    """Retourne le dernier historyId Gmail Watch persisté en Firestore."""
    db = _get_db()
    try:
        doc = db.collection("metadata").document("gmail_watch_state").get()
        if doc.exists:
            val = (doc.to_dict() or {}).get("lastHistoryId")
            if val:
                return str(val)
    except Exception as e:
        log.warning(f"Erreur lecture gmail_watch_state : {e}")
    return None


def save_gmail_history_id(history_id: str) -> None:
    """Persiste le historyId Gmail dans Firestore."""
    db = _get_db()
    payload: dict = {"updatedAt": datetime.now(timezone.utc)}
    if history_id:
        payload["lastHistoryId"] = str(history_id)
    try:
        _run_with_backoff(
            lambda: db.collection("metadata").document("gmail_watch_state").set(
                payload, merge=True
            ),
            "Sauvegarde gmail_watch_state",
        )
    except Exception as e:
        log.warning(f"Erreur sauvegarde gmail_watch_state : {e}")


def save_gmail_watch_status(expiration: str | None, error: str | None) -> None:
    """Persiste le résultat de la dernière tentative d'enregistrement du watch.

    Le watch Gmail expire au bout de 7 jours : sans cette trace, un
    renouvellement en échec ne laissait qu'une ligne de log, et Gmail Push
    mourait silencieusement jusqu'à ce que quelqu'un s'en aperçoive.
    `lastWatchError` est remis à None dès qu'un enregistrement réussit.
    """
    db = _get_db()
    payload: dict = {
        "lastWatchAttemptAt": datetime.now(timezone.utc),
        "lastWatchError": error,
    }
    if expiration:
        payload["watchExpiration"] = str(expiration)
    try:
        _run_with_backoff(
            lambda: db.collection("metadata").document("gmail_watch_state").set(
                payload, merge=True
            ),
            "Sauvegarde gmail_watch_status",
        )
    except Exception as e:
        log.warning(f"Erreur sauvegarde gmail_watch_status : {e}")


def sauvegarder_transactions(nouvelles: list, source: str = "gmail") -> int:
    """
    Sauvegarde une liste de transactions dans Firestore.
    Préserve les champs modifiés depuis le dashboard (libellé, catégorie, commentaire, pointé).

    Args:
        nouvelles : liste de dicts {date, libelle, compte, montant, categorie, source}
        source    : "gmail" | "historique" | "manuel"

    Returns:
        int : nombre de transactions effectivement écrites
    """
    if not nouvelles:
        return 0

    db = _get_db()

    # Ignorer les transactions supprimées manuellement depuis le dashboard
    deleted_ids = charger_ids_transactions_supprimees()
    if deleted_ids:
        original = len(nouvelles)
        nouvelles = [
            tx for tx in nouvelles
            if _transaction_id(tx["compte"], tx["date"], tx["libelle"], tx["montant"]) not in deleted_ids
            and _legacy_transaction_id(tx["date"], tx["libelle"], tx["montant"]) not in deleted_ids
        ]
        skipped = original - len(nouvelles)
        if skipped:
            log.info(f"{skipped} transaction(s) ignorée(s) car supprimée(s) depuis le dashboard.")

    if not nouvelles:
        return 0

    col = db.collection("transactions")
    now = datetime.now(timezone.utc)

    # Champs modifiables côté dashboard : ne jamais écraser les modifications utilisateur
    editable_fields = ("libelle", "categorie", "commentaire", "pointe", "moisAffectation")

    # Pré-chargement batch pour préserver les champs éditables.
    # On précharge les DEUX formats d'ID : un document déjà en base doit garder
    # son ID, sinon l'import en crée un second exemplaire (avec pointe=False)
    # au lieu de fusionner. Cf. _resoudre_id_transaction.
    candidate_ids = set()
    for tx in nouvelles:
        candidate_ids.add(_transaction_id(tx["compte"], tx["date"], tx["libelle"], tx["montant"]))
        candidate_ids.add(_legacy_transaction_id(tx["date"], tx["libelle"], tx["montant"]))
    doc_refs = [col.document(doc_id) for doc_id in sorted(candidate_ids)]
    snaps = _run_with_backoff(lambda: list(db.get_all(doc_refs)), "Pré-chargement transactions existantes")
    prefetch_map = {snap.id: snap.to_dict() or {} for snap in snaps if snap.exists}
    existing_map = prefetch_map
    log.debug(f"Pré-fetch : {len(prefetch_map)}/{len(doc_refs)} documents existants.")

    # Calcul des IDs en gérant les doublons dans le même batch : si deux transactions
    # ont le même ID de base, la 2e reçoit un suffixe _2, la 3e _3, etc.
    # Cela permet d'importer deux virements identiques le même jour (ex: 2×100€).
    ids_in_batch: dict[str, int] = {}
    tx_ids: list[str] = []
    for tx in nouvelles:
        base_id = _resoudre_id_transaction(tx, prefetch_map)
        count_seen = ids_in_batch.get(base_id, 0)
        tx_id = base_id if count_seen == 0 else f"{base_id}_{count_seen + 1}"
        ids_in_batch[base_id] = count_seen + 1
        tx_ids.append(tx_id)

    batch = db.batch()
    count = 0

    for tx, tx_id in zip(nouvelles, tx_ids):
        doc_ref = col.document(tx_id)

        data = {
            "date": tx["date"].strftime("%Y-%m-%d"),
            "libelle": tx["libelle"],
            "compte": tx["compte"],
            "montant": tx["montant"],
            "categorie": tx.get("categorie", ""),
            "commentaire": tx.get("commentaire", ""),
            "source": source,
            "pointe": tx.get("pointe", False),
            "importedAt": now,
            # Opération notifiée « en attente » par Linxo : sert à la
            # réconciliation lors de la notification « réalisée » (dedup.reconcile_pending).
            "enAttente": bool(tx.get("enAttente", False)),
        }
        if isinstance(tx.get("emailDate"), datetime):
            data["emailDate"] = tx["emailDate"]

        # Préserver les modifications utilisateur si le doc existe déjà
        if tx_id in existing_map:
            existing = existing_map[tx_id]
            for field in editable_fields:
                if field in existing:
                    data[field] = existing[field]

        batch.set(doc_ref, data, merge=True)
        count += 1

        if count % 500 == 0:
            _run_with_backoff(lambda b=batch: b.commit(), "Commit batch transactions")
            log.info(f"Batch : {count} transactions envoyées...")
            batch = db.batch()

    _run_with_backoff(lambda b=batch: b.commit(), "Commit final transactions")
    log.info(f"Firestore : {count} transactions sauvegardées (source={source}).")
    return count


def supprimer_transactions_par_ids(ids: list[str]) -> int:
    """Supprime des transactions par ID de document.

    Utilisé pour retirer une opération « en attente » que sa notification
    « réalisée » vient de remplacer. Suppression dure, sans tombstone dans
    `deleted_transactions` : sinon un rattrapage ultérieur ne pourrait plus
    réimporter l'opération.
    """
    if not ids:
        return 0

    db = _get_db()
    col = db.collection("transactions")
    batch = db.batch()
    count = 0

    for tx_id in ids:
        batch.delete(col.document(tx_id))
        count += 1
        if count % 500 == 0:
            _run_with_backoff(lambda b=batch: b.commit(), "Commit batch suppressions")
            batch = db.batch()

    _run_with_backoff(lambda b=batch: b.commit(), "Commit final suppressions")
    log.info(f"Firestore : {count} transaction(s) « en attente » remplacée(s) supprimée(s).")
    return count
