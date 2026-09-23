"""
firebase_db.py — Interface Firestore pour Suivi-Budget
=======================================================

Structure Firestore :
  transactions/{id}/
      date          : str  "YYYY-MM-DD"
      libelle       : str
      compte        : str  "BforBank" | "LCL"
      montant       : float
      categorie     : str  (catégorie budgétaire)
      commentaire   : str
      source        : str  "gmail" | "historique" | "manuel"
      pointe        : bool  (false par défaut)
      importedAt    : timestamp

  metadata/history_import/
      done          : bool
      importedAt    : timestamp
      count         : int

--------------------------------------------------------------------------
Relation avec functions/firebase_db.py
--------------------------------------------------------------------------
Cette copie (src/) est exécutée par les GitHub Actions d'import et initialise
Firebase depuis le secret FIREBASE_CREDENTIALS (_get_db). La copie functions/
est déployée en Cloud Functions, s'appuie sur l'init native du runtime et
n'expose qu'un sous-ensemble de fonctions.

Les deux fichiers divergent DÉLIBÉRÉMENT (init différente + fonctions propres
à chaque environnement) : ils ne doivent PAS être fusionnés en copie unique.
tests/test_shared_backend_sync.py fige ce choix. À l'inverse, les autres
modules backend dupliqués (gmail_client, transaction_parser, ai_*,
balance_coherence) DOIVENT rester byte-identiques — tout changement s'y
répercute des deux côtés.
"""

import json
import logging
import os
import random
import time
from datetime import datetime, timedelta, timezone

import firebase_admin
from firebase_admin import credentials, firestore
from google.api_core.exceptions import NotFound, ResourceExhausted, ServiceUnavailable, DeadlineExceeded
from google.cloud.firestore_v1.base_query import FieldFilter

log = logging.getLogger(__name__)

_db = None          # instance Firestore (singleton)
_project_id = None  # project_id extrait des credentials


def _get_db():
    """Initialise Firebase une seule fois et retourne le client Firestore."""
    global _db, _project_id
    if _db is not None:
        return _db

    cred_json = os.environ.get("FIREBASE_CREDENTIALS")
    if cred_json:
        cred_dict = json.loads(cred_json)

        required_fields = ["type", "project_id", "private_key", "client_email"]
        missing = [f for f in required_fields if not cred_dict.get(f)]
        if missing:
            raise ValueError(
                f"FIREBASE_CREDENTIALS invalide : champs manquants ou vides : {', '.join(missing)}"
            )
        if cred_dict.get("project_id") == "<project_id>":
            raise ValueError("FIREBASE_CREDENTIALS invalide : project_id non configuré")

        _project_id = cred_dict["project_id"]
        cred = credentials.Certificate(cred_dict)

        if not firebase_admin._apps:
            firebase_admin.initialize_app(cred)
    else:
        # Fallback: Application Default Credentials (Cloud Shell, gcloud auth)
        log.info("FIREBASE_CREDENTIALS absent — utilisation des Application Default Credentials.")
        if not firebase_admin._apps:
            firebase_admin.initialize_app()
        _project_id = (
            os.environ.get("GCLOUD_PROJECT")
            or os.environ.get("GOOGLE_CLOUD_PROJECT")
            or "unknown"
        )

    _db = firestore.client()
    log.info(f"Firebase Firestore initialisé (projet: {_project_id}).")
    return _db


def _handle_not_found(e: NotFound):
    """Lève une RuntimeError claire quand la base Firestore n'existe pas encore."""
    url = f"https://console.cloud.google.com/datastore/setup?project={_project_id or '<project_id>'}"
    raise RuntimeError(
        f"La base Firestore n'existe pas encore pour le projet '{_project_id}'.\n"
        f"Crée-la ici (mode 'Native') : {url}"
    ) from e


def is_firebase_available() -> bool:
    """Vérifie si les credentials Firebase sont disponibles (secret ou ADC)."""
    return bool(
        os.environ.get("FIREBASE_CREDENTIALS")
        or os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
        or os.environ.get("GCLOUD_PROJECT")
        or os.environ.get("GOOGLE_CLOUD_PROJECT")
    )


def _stream_with_backoff(query, operation_name: str, timeout_s: int = 30, max_attempts: int = 3):
    """Itère un stream Firestore avec retry court pour éviter de bloquer 5+ minutes sur un 429."""
    delay_s = 1.0
    for attempt in range(1, max_attempts + 1):
        try:
            # Récupère tous les résultats avant de yield pour éviter les doublons 
            # si le stream coupe et retry en cours de route.
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
    """Exécute une opération Firestore (set/get/commit/...) avec retry exponentiel."""
    delay_s = 1.0
    for attempt in range(1, max_attempts + 1):
        try:
            return operation()
        except (ResourceExhausted, ServiceUnavailable, DeadlineExceeded) as e:
            if attempt == max_attempts:
                raise RuntimeError(
                    f"{operation_name}: échec après {max_attempts} tentatives ({type(e).__name__}: {e})"
                ) from e
            # Petit jitter pour éviter de retaper exactement en même temps qu'un autre run.
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
    try:
        query = db.collection("linxo_category_mappings")
        for doc in _stream_with_backoff(query, "Chargement mapping catégories Linxo"):
            data = doc.to_dict() or {}
            categorie_linxo = str(data.get("linxoCategory", "")).strip()
            categorie_budget = str(data.get("budgetCategory", "")).strip()
            if categorie_linxo and categorie_budget:
                mapping[categorie_linxo] = categorie_budget
    except NotFound as e:
        _handle_not_found(e)
    log.info(f"Mapping Linxo chargé depuis Firestore : {len(mapping)} catégories.")
    return mapping


def charger_recurrences_actives() -> list[dict]:
    """Charge les récurrences actives (label, expectedAmount) pour filtrer le
    pipeline de catégorisation IA : une transaction qui ressemble à une
    récurrence connue n'a pas besoin d'un appel LLM (la récurrence finira par
    lui assigner sa propre catégorie via le mapping côté UI)."""
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
            out.append({
                "label": label,
                "expectedAmount": data.get("expectedAmount"),
                "active": True,
            })
    except NotFound as e:
        _handle_not_found(e)
    return out


def charger_account_owners_mapping() -> dict:
    """
    Charge le mapping Firestore des comptes → propriétaires.
    
    Structure Firestore (metadata/account_owners_mapping):
    {
      "accounts": { "BforBank": "Nicolas", "LCL": "Nicolas", ... },
      "savings_patterns": { "Livret Romane": "Romane", ... },
      "default_owner": "Nicolas"
    }
    
    Retourne : { "accounts": {...}, "savings_patterns": {...}, "default_owner": "..." }
    """
    db = _get_db()
    try:
        doc = db.collection("metadata").document("account_owners_mapping").get()
        if doc.exists:
            data = doc.to_dict() or {}
            mapping = {
                "accounts": data.get("accounts", {}),
                "savings_patterns": data.get("savings_patterns", {}),
                "default_owner": data.get("default_owner", "Nicolas"),
            }
            log.debug(f"✓ Mapping compte→propriétaire chargé : {len(mapping['accounts'])} comptes, {len(mapping['savings_patterns'])} patterns épargne.")
            return mapping
    except NotFound as e:
        _handle_not_found(e)
    except Exception as e:
        log.warning(f"Erreur chargement mapping compte→propriétaire : {e}")
    
    # Fallback : config défaut si Firestore non dispo
    log.debug("Utilisation du mapping par défaut (Nicolas).")
    return {
        "accounts": {"BforBank": "Nicolas", "LCL": "Nicolas"},
        "savings_patterns": {},
        "default_owner": "Nicolas",
    }


def get_owner_for_account(compte: str, mapping: dict | None = None) -> str:
    """
    Détermine le propriétaire d'un compte courant.
    
    Args:
        compte: nom du compte (ex: "BforBank", "LCL")
        mapping: mapping chargé avec charger_account_owners_mapping() (optional)
    
    Returns:
        Nom du propriétaire, ou "Nicolas" par défaut
    """
    if mapping is None:
        mapping = charger_account_owners_mapping()
    
    compte = str(compte).strip()
    owner = mapping.get("accounts", {}).get(compte)
    if owner:
        return owner
    return mapping.get("default_owner", "Nicolas")


def get_owner_for_savings(compte_epargne: str, mapping: dict | None = None) -> str:
    """
    Détermine le propriétaire d'une épargne par pattern matching sur le nom Linxo.
    
    Exemple: "Livret Romane" → cherche pattern "Livret Romane" dans savings_patterns
    
    Args:
        compte_epargne: nom du compte épargne depuis Linxo (ex: "Livret Romane")
        mapping: mapping chargé avec charger_account_owners_mapping() (optional)
    
    Returns:
        Nom du propriétaire trouvé, ou default_owner sinon
    """
    if mapping is None:
        mapping = charger_account_owners_mapping()
    
    compte_epargne = str(compte_epargne).strip()
    patterns = mapping.get("savings_patterns", {})
    
    # Recherche exacte
    if compte_epargne in patterns:
        return patterns[compte_epargne]
    
    # Recherche par substring (ex: "Livret Romane" contient "Romane")
    for pattern, owner in patterns.items():
        if pattern.lower() in compte_epargne.lower():
            return owner
    
    return mapping.get("default_owner", "Nicolas")


def enregistrer_categories_linxo(categories: set, mapping: dict | None = None) -> int:
    """Upsert les catégories Linxo vues dans Firestore pour faciliter le mapping manuel."""
    if not categories:
        return 0

    db = _get_db()
    col = db.collection("linxo_category_mappings")
    batch = db.batch()
    now = datetime.now(timezone.utc)
    count = 0
    mapping = mapping or {}

    for cat in sorted(categories):
        linxo_cat = str(cat).strip()
        if not linxo_cat:
            continue
        doc_id = linxo_cat.replace("/", "_")[:140]
        doc_ref = col.document(doc_id)
        payload = {
            "linxoCategory": linxo_cat,
            "budgetCategory": mapping.get(linxo_cat, ""),
            "updatedAt": now,
        }
        batch.set(doc_ref, payload, merge=True)
        count += 1

        if count % 500 == 0:
            try:
                _run_with_backoff(
                    lambda b=batch: b.commit(),
                    "Commit batch catégories Linxo",
                )
            except NotFound as e:
                _handle_not_found(e)
            batch = db.batch()

    try:
        _run_with_backoff(
            lambda b=batch: b.commit(),
            "Commit final catégories Linxo",
        )
    except NotFound as e:
        _handle_not_found(e)

    log.info(f"Firestore : {count} catégories Linxo synchronisées.")
    return count




# ─── GMAIL MESSAGES / REPARSE JOBS ───────────────────────────────────────────

def upsert_gmail_messages(messages: list) -> int:
    """Upsert des emails Gmail Linxo scannés pour affichage côté dashboard Firebase."""
    if not messages:
        return 0

    db = _get_db()
    batch = db.batch()
    col = db.collection("gmail_messages")
    now = datetime.now(timezone.utc)
    count = 0

    for m in messages:
        message_id = str(m.get("messageId") or "").strip()
        if not message_id:
            continue
        doc = col.document(message_id)
        payload = {
            "messageId": message_id,
            "threadId": str(m.get("threadId") or ""),
            "subject": str(m.get("subject") or ""),
            "receivedAt": m.get("receivedAt") or now,
            "updatedAt": now,
        }
        if m.get("lastStatus"):
            payload["lastStatus"] = str(m.get("lastStatus"))
        batch.set(doc, payload, merge=True)
        count += 1
        if count % 500 == 0:
            try:
                _run_with_backoff(
                    lambda b=batch: b.commit(),
                    "Commit batch gmail_messages",
                )
            except NotFound as e:
                _handle_not_found(e)
            batch = db.batch()

    try:
        _run_with_backoff(
            lambda b=batch: b.commit(),
            "Commit final gmail_messages",
        )
    except NotFound as e:
        _handle_not_found(e)

    return count


def lister_reparse_jobs_en_attente(limit: int = 50) -> list:
    """Retourne les jobs de reparse en attente (status=requested)."""
    db = _get_db()
    jobs = []
    seen_ids = set()
    try:
        # Pas de order_by pour éviter d'exiger un index composite Firestore.
        # Un simple filtre sur un seul champ utilise l'index single-field automatique.
        query = (
            db.collection("reparse_jobs")
            .where(filter=FieldFilter("status", "==", "requested"))
            .limit(limit)
        )
        for doc in _stream_with_backoff(query, "Chargement jobs reparse"):
            data = doc.to_dict() or {}
            jobs.append({"id": doc.id, **data})
            seen_ids.add(doc.id)

        # Le bouton "Rafraîchir mails" s'appuie sur ce job sentinelle.
        # Si la collection contient beaucoup de jobs "requested", la limite
        # peut l'exclure : on le lit explicitement pour garantir sa prise en compte.
        if "full_scan_request" not in seen_ids:
            sentinel = db.collection("reparse_jobs").document("full_scan_request").get()
            if sentinel.exists:
                data = sentinel.to_dict() or {}
                if str(data.get("status", "")).lower() == "requested":
                    jobs.append({"id": sentinel.id, **data})
    except NotFound as e:
        _handle_not_found(e)
    return jobs


def charger_emails_exclus() -> set:
    """Retourne l'ensemble des message_id Gmail à ne pas importer (collection gmail_excluded)."""
    db = _get_db()
    excluded = set()
    try:
        for doc in _stream_with_backoff(db.collection("gmail_excluded"), "Chargement emails exclus"):
            if doc.id:
                excluded.add(doc.id)
    except NotFound as e:
        _handle_not_found(e)
    log.info(f"Emails exclus chargés depuis Firestore : {len(excluded)}")
    return excluded


def marquer_reparse_job(message_id: str, status: str, result_message: str, details: dict | None = None):
    """Met à jour le statut d'un job de reparse."""
    if not message_id:
        return
    db = _get_db()
    payload = {
        "messageId": message_id,
        "status": status,
        "resultMessage": result_message,
        "processedAt": datetime.now(timezone.utc),
    }
    if details:
        payload.update(details)
    try:
        _run_with_backoff(
            lambda: db.collection("reparse_jobs").document(message_id).set(payload, merge=True),
            f"Écriture reparse_job {message_id}",
        )
    except NotFound as e:
        _handle_not_found(e)

# ─── TRANSACTIONS ─────────────────────────────────────────────────────────────

def _tronity_transaction_id(session_id: str, compte: str) -> str:
    """ID déterministe pour une recharge Tronity, basé sur l'ID session API.

    Utiliser l'ID session rend l'import idempotent même si les tarifs changent
    (le montant recalculé ne fait pas partie de la clé).
    """
    s = str(session_id).strip()[:80].replace(" ", "_").replace("/", "-")
    c = str(compte).lower().strip()[:40].replace(" ", "_").replace("/", "-")
    return f"tronity_{c}_{s}"


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

    Pour Tronity : l'ID session API rend l'import idempotent même si les tarifs
    changent (le montant recalculé ne fait pas partie de la clé).

    Pour les autres sources :
      - doc hérité existant et de même compte -> on réutilise son ID ;
      - doc hérité existant d'un AUTRE compte -> collision inter-comptes,
        on prend le nouvel ID préfixé (le but initial du préfixe) ;
      - aucun doc hérité                       -> nouvel ID préfixé.

    `prefetch_map` : {doc_id: data} couvrant les deux formats d'ID.
    """
    session_id = str(tx.get("tronity_session_id", "")).strip()
    if session_id:
        return _tronity_transaction_id(session_id, tx.get("compte", ""))

    legacy_id = _legacy_transaction_id(tx["date"], tx["libelle"], tx["montant"])
    legacy_doc = prefetch_map.get(legacy_id)
    if legacy_doc is not None and str(legacy_doc.get("compte", "")).strip() == str(tx["compte"]).strip():
        return legacy_id
    return _transaction_id(tx["compte"], tx["date"], tx["libelle"], tx["montant"])


def sauvegarder_transactions(nouvelles: list, source: str = "gmail"):
    """
    Sauvegarde une liste de transactions dans Firestore.

    Args:
        nouvelles : liste de dicts {date, libelle, compte, montant, commentaire}
        source    : "gmail" (import quotidien) ou "historique" (import one-shot)

    Returns:
        int : nombre de transactions effectivement écrites
    """
    if not nouvelles:
        return 0

    # Transactions explicitement supprimées depuis le dashboard.
    # Elles ne doivent plus être recréées par un import automatique.
    deleted_ids: set[str] = set()
    preserve_user_edits_sources = {"gmail", "tronity"}
    if source in preserve_user_edits_sources:
        deleted_ids = charger_ids_transactions_supprimees()

    if deleted_ids:
        original_count = len(nouvelles)

        def _est_supprimee(tx: dict) -> bool:
            session_id = str(tx.get("tronity_session_id", "")).strip()
            if session_id and _tronity_transaction_id(session_id, tx.get("compte", "")) in deleted_ids:
                return True
            return (
                _transaction_id(tx["compte"], tx["date"], tx["libelle"], tx["montant"]) in deleted_ids
                or _legacy_transaction_id(tx["date"], tx["libelle"], tx["montant"]) in deleted_ids
            )

        nouvelles = [tx for tx in nouvelles if not _est_supprimee(tx)]
        skipped = original_count - len(nouvelles)
        if skipped:
            log.info(f"{skipped} transaction(s) ignorée(s) car supprimée(s) manuellement depuis le dashboard.")

    if not nouvelles:
        return 0

    db = _get_db()
    col = db.collection("transactions")
    batch = db.batch()
    count = 0
    now = datetime.now(timezone.utc)

    # Champs modifiables côté dashboard : ils ne doivent jamais être écrasés
    # par un nouvel import Gmail/reparse.
    editable_fields = ("libelle", "categorie", "commentaire", "pointe", "moisAffectation")

    # ─── Résolution des IDs ───────────────────────────────────────────────────
    # Un document DÉJÀ EN BASE doit garder son ID, sinon l'import en crée un
    # second exemplaire (avec pointe=False) au lieu de fusionner : c'est ce qui
    # a dupliqué ~286 transactions lors du passage au format préfixé-compte.
    # On précharge donc les DEUX formats en un seul get_all, puis :
    #   - doc hérité existant et de même compte  -> on réutilise son ID ;
    #   - doc hérité existant d'un AUTRE compte  -> collision inter-comptes,
    #     on prend le nouvel ID préfixé (le but initial du préfixe) ;
    #   - aucun doc hérité                        -> nouvel ID préfixé.
    prefetch_map: dict = {}
    if source in preserve_user_edits_sources and nouvelles:
        candidate_ids = set()
        for tx in nouvelles:
            candidate_ids.add(_transaction_id(tx["compte"], tx["date"], tx["libelle"], tx["montant"]))
            candidate_ids.add(_legacy_transaction_id(tx["date"], tx["libelle"], tx["montant"]))
            if tx.get("tronity_session_id"):
                candidate_ids.add(_tronity_transaction_id(tx["tronity_session_id"], tx.get("compte", "")))
        doc_refs = [col.document(doc_id) for doc_id in sorted(candidate_ids)]
        snaps = _run_with_backoff(
            lambda: list(db.get_all(doc_refs)),
            "Pré-chargement transactions existantes",
        )
        for snap in snaps:
            if snap.exists:
                prefetch_map[snap.id] = snap.to_dict() or {}
        log.debug(f"Pré-fetch batch : {len(prefetch_map)}/{len(doc_refs)} documents existants.")

    # Calcul des IDs en gérant les doublons dans le même batch : si deux transactions
    # ont le même ID de base, la 2e reçoit un suffixe _2, la 3e _3, etc.
    # Cela permet d'importer deux virements identiques le même jour (ex: 2×100€).
    # Exception Tronity : l'ID de base vient de l'ID de session API, donc une
    # collision dans le lot est forcément la MÊME recharge (page répétée par
    # l'API) et jamais deux opérations distinctes. La suffixer créerait autant
    # de documents que de répétitions ; on ignore simplement la répétition.
    ids_in_batch: dict[str, int] = {}
    retenues: list[dict] = []
    tx_ids: list[str] = []
    doublons_session = 0
    for tx in nouvelles:
        base_id = _resoudre_id_transaction(tx, prefetch_map)
        count_seen = ids_in_batch.get(base_id, 0)
        ids_in_batch[base_id] = count_seen + 1
        if count_seen and tx.get("tronity_session_id"):
            doublons_session += 1
            continue
        retenues.append(tx)
        tx_ids.append(base_id if count_seen == 0 else f"{base_id}_{count_seen + 1}")

    if doublons_session:
        log.info(
            f"{doublons_session} recharge(s) répétée(s) dans le lot ignorée(s) "
            "(même ID de session Tronity)."
        )
    nouvelles = retenues

    # Champs éditables : on ne les relit que pour l'ID finalement retenu.
    existing_map: dict = {tx_id: prefetch_map[tx_id] for tx_id in tx_ids if tx_id in prefetch_map}

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
        if source == "tronity" and "tronity_raw" in tx:
            data["tronity_raw"] = tx["tronity_raw"]
        if source == "tronity" and tx.get("tronity_session_id"):
            data["tronity_session_id"] = tx["tronity_session_id"]
        if "edf_compte" in tx:
            data["edf_compte"] = tx["edf_compte"]

        # La transaction peut déjà exister et avoir été ajustée par l'utilisateur
        # (libellé/catégorie/commentaire/pointé/mois d'affectation).
        # Sans cette protection, un import automatique écraserait ces corrections.
        if source in preserve_user_edits_sources and tx_id in existing_map:
            existing_data = existing_map[tx_id]
            for field in editable_fields:
                if field in existing_data:
                    data[field] = existing_data[field]

        batch.set(doc_ref, data, merge=True)
        count += 1

        # Firestore limite les batches à 500 opérations
        if count % 500 == 0:
            try:
                _run_with_backoff(
                    lambda b=batch: b.commit(),
                    "Commit batch transactions",
                )
            except NotFound as e:
                _handle_not_found(e)
            log.info(f"Batch Firebase {count} transactions envoyées...")
            batch = db.batch()

    try:
        _run_with_backoff(
            lambda b=batch: b.commit(),
            "Commit final transactions",
        )
    except NotFound as e:
        _handle_not_found(e)
    log.info(f"Firebase : {count} transactions sauvegardées (source={source})")
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
            try:
                _run_with_backoff(lambda b=batch: b.commit(), "Commit batch suppressions")
            except NotFound as e:
                _handle_not_found(e)
            batch = db.batch()

    try:
        _run_with_backoff(lambda b=batch: b.commit(), "Commit final suppressions")
    except NotFound as e:
        _handle_not_found(e)
    log.info(f"Firebase : {count} transaction(s) « en attente » remplacée(s) supprimée(s).")
    return count


def charger_ids_transactions_supprimees() -> set[str]:
    """Retourne les IDs de transactions marquées comme supprimées par l'utilisateur."""
    db = _get_db()
    deleted_ids = set()
    try:
        for doc in _stream_with_backoff(db.collection("deleted_transactions"), "Chargement transactions supprimées"):
            if doc.id:
                deleted_ids.add(doc.id)
    except NotFound as e:
        _handle_not_found(e)
    return deleted_ids


# ─── HISTORIQUE ONE-TIME ───────────────────────────────────────────────────────

def historique_deja_importe() -> bool:
    """Retourne True si l'import historique a déjà été effectué."""
    db = _get_db()
    try:
        doc = db.collection("metadata").document("history_import").get()
    except NotFound as e:
        _handle_not_found(e)
    if doc.exists:
        return doc.to_dict().get("done", False)
    return False


def marquer_historique_importe(count: int):
    """Marque l'import historique comme terminé dans Firestore."""
    db = _get_db()
    try:
        _run_with_backoff(
            lambda: db.collection("metadata").document("history_import").set({
                "done": True,
                "importedAt": datetime.now(timezone.utc),
                "count": count,
            }),
            "Écriture metadata/history_import",
        )
    except NotFound as e:
        _handle_not_found(e)
    log.info(f"Import historique marqué comme terminé ({count} transactions).")


# ─── RÉ-IMPORT (ÉCRASE TOUT, PRESERVE POINTÉ) ───────────────────────────────

def get_all_dashboard_overrides() -> dict:
    """Récupère les valeurs pointé et catégorie modifiées depuis le dashboard.

    Utilise une projection de champs pour ne lire que les champs nécessaires
    et réduire la bande passante Firestore.
    """
    db = _get_db()
    overrides = {}
    try:
        query = db.collection("transactions").select(["pointe", "categorie"])
        for doc in _stream_with_backoff(query, "Chargement overrides dashboard"):
            data = doc.to_dict() or {}
            entry = {}
            if data.get("pointe"):
                entry["pointe"] = data["pointe"]
            if data.get("categorie"):
                entry["categorie"] = data["categorie"]
            if entry:
                overrides[doc.id] = entry
    except NotFound as e:
        _handle_not_found(e)
    log.info(f"Récupéré {len(overrides)} overrides dashboard (pointé/catégorie).")
    return overrides


def charger_transactions_existantes_pour_dedoublonnage(
    since_days: int = 365, email_date_min: datetime | None = None
) -> list[dict]:
    """Retourne les transactions existantes (date/libellé/montant) pour la déduplication.

    Args:
        since_days: fenêtre de recherche en jours (défaut 365). Passer 0 pour tout charger.
                    Réduit drastiquement les lectures Firestore lors des imports quotidiens.
    """
    db = _get_db()
    out = []
    try:
        query = db.collection("transactions").select(
            ["date", "libelle", "montant", "compte", "emailDate", "enAttente", "tronity_session_id"]
        )
        if since_days > 0:
            cutoff = (datetime.now(timezone.utc) - timedelta(days=since_days)).strftime("%Y-%m-%d")
            query = query.where(filter=FieldFilter("date", ">=", cutoff))
            log.debug(f"Déduplication : fenêtre {since_days} jours (depuis {cutoff}).")
        if email_date_min is not None:
            query = query.where(filter=FieldFilter("emailDate", ">=", email_date_min))
        for doc in _stream_with_backoff(query, "Chargement transactions pour dédoublonnage"):
            data = doc.to_dict() or {}
            date_str = str(data.get("date") or "").strip()
            libelle = str(data.get("libelle") or "").strip()
            montant = data.get("montant")
            if not date_str or not libelle or montant is None:
                continue
            entry = {
                "id": doc.id,
                "date": date_str,
                "libelle": libelle,
                "montant": float(montant),
                "compte": str(data.get("compte", "")).strip(),
                "emailDate": data.get("emailDate"),
                "enAttente": bool(data.get("enAttente", False)),
            }
            if data.get("tronity_session_id"):
                entry["tronity_session_id"] = str(data["tronity_session_id"])
            out.append(entry)
    except NotFound as e:
        _handle_not_found(e)
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


def patcher_edf_compte_manquant(edf_compte: str) -> int:
    """Ajoute le champ edf_compte aux recharges Tronity qui ne l'ont pas encore.

    Les transactions importées avant l'ajout du champ edf_compte (commit cc135b0)
    ne peuvent pas être re-importées normalement (bloquées par la déduplication
    stricte). Cette fonction les met à jour directement en Firestore.

    Returns:
        Nombre de documents mis à jour.
    """
    if not edf_compte:
        return 0

    from google.cloud.firestore_v1.base_query import FieldFilter

    db = _get_db()
    col = db.collection("transactions")

    query = (
        col
        .where(filter=FieldFilter("source", "==", "tronity"))
        .where(filter=FieldFilter("libelle", "==", "Recharge domicile EV"))
    )

    to_patch: list[str] = []
    for doc in _stream_with_backoff(query, "Scan recharges Tronity"):
        data = doc.to_dict() or {}
        if not data.get("edf_compte"):
            to_patch.append(doc.id)

    if not to_patch:
        log.debug("patcher_edf_compte_manquant : aucune recharge à corriger.")
        return 0

    log.info("patcher_edf_compte_manquant : %d recharge(s) sans edf_compte → patch.", len(to_patch))
    updated = 0
    batch = db.batch()
    for i, doc_id in enumerate(to_patch):
        batch.update(col.document(doc_id), {"edf_compte": edf_compte})
        updated += 1
        if updated % 500 == 0:
            _run_with_backoff(lambda b=batch: b.commit(), "Patch edf_compte batch")
            log.info("Patch edf_compte : %d/%d…", updated, len(to_patch))
            batch = db.batch()

    if updated % 500 != 0:
        _run_with_backoff(lambda b=batch: b.commit(), "Patch edf_compte final")

    log.info("✓ patcher_edf_compte_manquant : %d recharge(s) corrigée(s).", updated)
    return updated


_UNCATEGORIZED_LABELS = {"", "a catégoriser", "a categoriser", "non catégorisé", "non categorise"}


def charger_transactions_categorisees(since_days: int = 730, limit: int = 5000) -> list[dict]:
    """Retourne les transactions DÉJÀ catégorisées (corpus d'apprentissage du RAG).

    C'est la base de connaissances : la catégorisation IA retrouve, parmi ces
    exemples étiquetés par l'utilisateur, les plus proches de chaque nouvelle
    transaction. On borne par fenêtre temporelle (récence) et par `limit` pour
    maîtriser les lectures Firestore.

    Champs renvoyés : date, libelle, montant, compte, categorie.
    """
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
        _handle_not_found(e)
    log.info(f"Corpus catégorisation IA : {len(out)} transactions étiquetées.")
    return out


def clear_all_transactions() -> int:
    """Supprime toutes les transactions de Firestore."""
    db = _get_db()
    col = db.collection("transactions")
    batch = db.batch()
    count = 0
    try:
        for doc in _stream_with_backoff(col, "Suppression transactions (stream)"):
            batch.delete(doc.reference)
            count += 1
            if count % 500 == 0:
                _run_with_backoff(
                    lambda b=batch: b.commit(),
                    "Suppression batch transactions",
                )
                batch = db.batch()
                log.info(f"Suppression batch : {count} transactions...")
        _run_with_backoff(
            lambda b=batch: b.commit(),
            "Suppression finale transactions",
        )
    except NotFound as e:
        _handle_not_found(e)
    log.info(f"Firebase : {count} transactions supprimées.")
    return count


def restaurer_dashboard_overrides(overrides: dict) -> int:
    """Restaure les valeurs pointé et catégorie après un re-import."""
    if not overrides:
        return 0
    db = _get_db()
    col = db.collection("transactions")
    batch = db.batch()
    count = 0
    try:
        for doc_id, fields in overrides.items():
            doc_ref = col.document(doc_id)
            # set(merge=True) ne nécessite pas de lire le doc au préalable
            # (contrairement à update() qui échoue si le doc n'existe pas).
            batch.set(doc_ref, fields, merge=True)
            count += 1
            if count % 500 == 0:
                _run_with_backoff(
                    lambda b=batch: b.commit(),
                    "Restauration batch overrides",
                )
                batch = db.batch()
        _run_with_backoff(
            lambda b=batch: b.commit(),
            "Restauration finale overrides",
        )
    except NotFound as e:
        _handle_not_found(e)
    log.info(f"Firebase : {count} overrides dashboard restaurés (pointé/catégorie).")
    return count


def reset_history_import_flag():
    """Remet le flag history_import à False pour permettre un re-import."""
    db = _get_db()
    try:
        _run_with_backoff(
            lambda: db.collection("metadata").document("history_import").set({
                "done": False,
            }),
            "Reset metadata/history_import",
        )
    except NotFound as e:
        _handle_not_found(e)
    log.info("Flag history_import remis à False.")


# ─── SOLDES COMPTES & CONTRÔLE LINXO ────────────────────────────────────────

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
            log.debug(f"Aucun solde antérieur pour {compte}, contrôle de cohérence impossible.")
            return empty

        latest_balance = latest_balance_doc.to_dict() or {}
        previous_solde = latest_balance.get("solde")
        if previous_solde is None or not isinstance(previous_solde, (int, float)):
            log.debug(f"Solde antérieur invalide pour {compte}.")
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


def get_latest_balances() -> dict:
    """Retourne les derniers soldes connus par compte depuis Firestore."""
    db = _get_db()
    out = {}
    try:
        for doc in db.collection("account_balances").stream():
            data = doc.to_dict() or {}
            compte = data.get("compte") or doc.id
            solde = data.get("solde")
            if compte and isinstance(solde, (int, float)):
                out[compte] = float(solde)
    except NotFound as e:
        _handle_not_found(e)
    return out



def sauvegarder_soldes_comptes(soldes: list, source: str = "gmail") -> int:
    """
    Sauvegarde les soldes détectés dans les emails Linxo et le contrôle de cohérence.

    Écrit dans :
      - account_balances/{compte} (dernier état) + owner
      - account_balance_history/{compte_YYYYMMDDHHMMSS} (historique) + owner
    """
    if not soldes:
        return 0

    db = _get_db()
    latest_col = db.collection("account_balances")
    history_col = db.collection("account_balance_history")
    now = datetime.now(timezone.utc)

    # Charger le mapping compte → propriétaire une seule fois
    owner_mapping = charger_account_owners_mapping()

    batch = db.batch()
    batch_ops = 0
    count = 0

    for s in soldes:
        compte = str(s.get("compte", "")).strip()
        if not compte:
            continue

        email_date = s.get("emailDate") or now
        if not isinstance(email_date, datetime):
            email_date = now

        # Déterminer le propriétaire du compte
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
            "owner": owner,  # ← AJOUTÉ
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

        batch.set(latest_col.document(compte), payload, merge=True)
        batch.set(history_col.document(history_id), payload, merge=True)
        batch_ops += 2
        count += 1

        if batch_ops >= 490:
            try:
                _run_with_backoff(
                    lambda b=batch: b.commit(),
                    "Commit batch soldes comptes",
                )
            except NotFound as e:
                _handle_not_found(e)
            batch = db.batch()
            batch_ops = 0

    if batch_ops:
        try:
            _run_with_backoff(
                lambda b=batch: b.commit(),
                "Commit final soldes comptes",
            )
        except NotFound as e:
            _handle_not_found(e)

    log.info(f"Firebase : {count} soldes comptes sauvegardés (source={source}).")
    return count


def sauvegarder_soldes_epargne(soldes: list, source: str = "gmail") -> int:
    """
    Sauvegarde les soldes des comptes d'épargne (livrets) détectés dans les emails Linxo.

    Écrit dans :
      - savings_balances/{compte_linxo} (dernier solde connu) + owner
    """
    if not soldes:
        return 0

    db = _get_db()
    col = db.collection("savings_balances")
    now = datetime.now(timezone.utc)

    # Charger le mapping épargne → propriétaire une seule fois
    owner_mapping = charger_account_owners_mapping()

    batch = db.batch()
    count = 0

    for s in soldes:
        compte = str(s.get("compte", "")).strip()
        if not compte:
            continue

        email_date = s.get("emailDate") or now
        if not isinstance(email_date, datetime):
            email_date = now

        # Déterminer le propriétaire de l'épargne par pattern matching
        owner = get_owner_for_savings(compte, owner_mapping)

        doc_id = compte.replace("/", "-").replace(" ", "_")
        payload = {
            "compte": compte,
            "solde": float(s["solde"]),
            "emailDate": email_date,
            "source": source,
            "owner": owner,  # ← AJOUTÉ
            "updatedAt": now,
        }

        batch.set(col.document(doc_id), payload, merge=True)
        count += 1

        if count % 500 == 0:
            try:
                _run_with_backoff(
                    lambda b=batch: b.commit(),
                    "Commit batch soldes épargne",
                )
            except NotFound as e:
                _handle_not_found(e)
            batch = db.batch()

    try:
        _run_with_backoff(
            lambda b=batch: b.commit(),
            "Commit final soldes épargne",
        )
    except NotFound as e:
        _handle_not_found(e)

    log.info(f"Firebase : {count} soldes épargne sauvegardés (source={source}).")
    return count


# ── Config Tronity (tarifs HP/HC) ─────────────────────────────────────────────

_CONFIG_TRONITY_DEFAULTS = {
    "tarif_hp": 0.2470,   # €/kWh — tarif réglementé EDF HP 2025
    "tarif_hc": 0.1941,   # €/kWh — tarif réglementé EDF HC 2025
    "network_loss_percent": 7.0,  # correction pertes réseau/charge (en %)
    "import_scope": "home",  # all | home — importe seulement les recharges à domicile
    "save_raw_api_payload": False,  # stocke la session brute API sur chaque transaction
    "hc_plages": [
        {"start_h": 22, "start_m": 0, "end_h": 6, "end_m": 0},
    ],
}


def charger_config_tronity() -> dict:
    """
    Lit la configuration Tronity (tarifs HP/HC + plages heures creuses)
    depuis Firestore (config/tronity).
    Retourne les valeurs par défaut si le document est absent.
    """
    db = _get_db()
    try:
        doc = db.collection("config").document("tronity").get()
        if doc.exists:
            data = doc.to_dict()
            # S'assurer que les clés obligatoires sont présentes
            for key, default in _CONFIG_TRONITY_DEFAULTS.items():
                if key not in data:
                    data[key] = default
            return data
    except Exception as e:
        log.warning(f"Impossible de lire config/tronity : {e} — valeurs par défaut utilisées.")
    return dict(_CONFIG_TRONITY_DEFAULTS)


def sauvegarder_config_tronity(config: dict) -> None:
    """
    Écrit/met à jour la configuration Tronity dans Firestore (config/tronity).
    """
    db = _get_db()
    now = datetime.now(timezone.utc)
    payload = {
        "tarif_hp": float(config.get("tarif_hp", _CONFIG_TRONITY_DEFAULTS["tarif_hp"])),
        "tarif_hc": float(config.get("tarif_hc", _CONFIG_TRONITY_DEFAULTS["tarif_hc"])),
        "network_loss_percent": float(
            config.get("network_loss_percent", _CONFIG_TRONITY_DEFAULTS["network_loss_percent"])
        ),
        "import_scope": (
            "home" if config.get("import_scope") == "home" else "all"
        ),
        "save_raw_api_payload": bool(
            config.get("save_raw_api_payload", _CONFIG_TRONITY_DEFAULTS["save_raw_api_payload"])
        ),
        "hc_plages": config.get("hc_plages", _CONFIG_TRONITY_DEFAULTS["hc_plages"]),
        "updatedAt": now,
    }
    try:
        db.collection("config").document("tronity").set(payload)
        log.info("Firebase : config/tronity sauvegardée.")
    except Exception as e:
        log.error(f"Erreur lors de la sauvegarde de config/tronity : {e}")


# ─── BUDGETS (V2) ─────────────────────────────────────────────────────────────

def add_budget(db, data: dict) -> str:
    """Crée un budget dans Firestore, retourne l'id."""
    now = datetime.now(timezone.utc)
    data["createdAt"] = now
    data["updatedAt"] = now
    doc_ref = db.collection("budgets").document()
    _run_with_backoff(lambda: doc_ref.set(data), f"Création budget {data.get('nom')}")
    return doc_ref.id


def get_budget_by_id(db, budget_id: str) -> dict | None:
    """Récupère un budget par son ID."""
    doc = _run_with_backoff(lambda: db.collection("budgets").document(budget_id).get(), f"Get budget {budget_id}")
    if doc.exists:
        data = doc.to_dict() or {}
        data["id"] = doc.id
        return data
    return None


def update_budget_doc(db, budget_id: str, updates: dict) -> None:
    """Met à jour un document budget."""
    updates["updatedAt"] = datetime.now(timezone.utc)
    _run_with_backoff(
        lambda: db.collection("budgets").document(budget_id).update(updates),
        f"Update budget {budget_id}"
    )


def delete_budget_doc(db, budget_id: str) -> None:
    """Supprime un document budget."""
    _run_with_backoff(
        lambda: db.collection("budgets").document(budget_id).delete(),
        f"Delete budget {budget_id}"
    )


def query_budgets(db, filters: dict = None) -> list[dict]:
    """Liste les budgets avec filtres optionnels."""
    query = db.collection("budgets")
    if filters:
        for field, value in filters.items():
            query = query.where(filter=FieldFilter(field, "==", value))
    
    docs = _stream_with_backoff(query, "List budgets")
    results = []
    for doc in docs:
        data = doc.to_dict() or {}
        data["id"] = doc.id
        results.append(data)
    return results


def get_transactions_by_category_period(db, categorie: str, debut: str, fin: str, compte: str | None = None) -> list[dict]:
    """Récupère les transactions pour une catégorie et une période donnée."""
    query = (
        db.collection("transactions")
        .where(filter=FieldFilter("categorie", "==", categorie))
        .where(filter=FieldFilter("date", ">=", debut))
        .where(filter=FieldFilter("date", "<=", fin))
    )
    if compte:
        query = query.where(filter=FieldFilter("compte", "==", compte))
    
    docs = _stream_with_backoff(query, f"Transactions {categorie} [{debut}, {fin}]")
    return [{"id": doc.id, **(doc.to_dict() or {})} for doc in docs]


def get_consumption_cache(db, cache_key: str) -> dict | None:
    """Récupère une entrée du cache de consommation."""
    doc = _run_with_backoff(
        lambda: db.collection("budget_consumption_cache").document(cache_key).get(),
        f"Get cache {cache_key}"
    )
    return doc.to_dict() if doc.exists else None


def set_consumption_cache(db, cache_key: str, data: dict) -> None:
    """Enregistre une entrée dans le cache de consommation."""
    data["computedAt"] = datetime.now(timezone.utc)
    _run_with_backoff(
        lambda: db.collection("budget_consumption_cache").document(cache_key).set(data),
        f"Set cache {cache_key}"
    )


def delete_consumption_cache(budget_id: str) -> None:
    """Supprime les entrées du cache pour un budget donné."""
    db_inst = _get_db()
    query = db_inst.collection("budget_consumption_cache").where(filter=FieldFilter("budgetId", "==", budget_id))
    docs = _stream_with_backoff(query, f"Delete cache for budget {budget_id}")
    
    batch = db_inst.batch()
    count = 0
    for doc_snap in docs:
        batch.delete(doc_snap.reference)
        count += 1
        if count % 500 == 0:
            _run_with_backoff(lambda: batch.commit(), f"Commit batch delete cache {budget_id}")
            batch = db_inst.batch()
    if count % 500 != 0:
        _run_with_backoff(lambda: batch.commit(), f"Commit final delete cache {budget_id}")
