"""
src/importer.py
Script principal (Orchestrateur)
"""
import os
import logging
from collections import defaultdict
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass
from datetime import datetime, timezone
from gmail_client import GmailClient
from transaction_parser import parse_email_linxo
from google.oauth2.credentials import Credentials
from dedup import deduplicate, reconcile_pending
from balance_coherence import resolve_status

# Import de votre fichier firebase existant
from firebase_db import (
    is_firebase_available,
    _get_db,
    sauvegarder_transactions,
    sauvegarder_soldes_comptes,
    calcul_coherence_solde,
    charger_mapping_categories_linxo,
    charger_recurrences_actives,
    charger_transactions_categorisees,
    charger_transactions_existantes_pour_dedoublonnage,
    supprimer_transactions_par_ids,
    upsert_gmail_messages,
    charger_emails_exclus,
    lister_reparse_jobs_en_attente,
    marquer_reparse_job,
)
from ai_categorizer import categorize_batch

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

CONFIG = {
    "MONTANT_MIN": -50000,
    "MONTANT_MAX": 50000,
    "GMAIL_LABEL": "Linxo_Importé",
    "COMPTES_ACTIFS": {
        "BforBank Compte Courant": "BforBank",
        "LCL Compte Joint": "LCL",
    },
}

BALANCE_RECONCILIATION_TOLERANCE = float(os.environ.get("BALANCE_RECONCILIATION_TOLERANCE", "0.01"))

def get_credentials():
    # Logique inchangée pour charger le GOOGLE_TOKEN depuis l'environnement
    import json
    info = json.loads(os.environ["GOOGLE_TOKEN"])
    return Credentials.from_authorized_user_info(info)

def _collecter_messages(gmail, message_refs, mapping_categories, emails_exclus):
    """Récupère et parse un ensemble de mails Linxo, mappe vers les comptes budget.

    Renvoie (nouvelles_transactions, soldes_raw, messages_scannes, messages_traites).
    Un mail présent dans `emails_exclus` est listé (messages_scannes) mais ni collecté
    ni étiquetable (absent de messages_traites) : « Réintégrer » le rend ré-importable.
    """
    nouvelles_transactions = []
    soldes_raw = []
    messages_traites = []
    messages_scannes = []

    for msg_ref in message_refs:
        msg_id = msg_ref["id"]
        details = gmail.get_message_html(msg_id)
        email_datetime = datetime.fromtimestamp(details["internalDate"] / 1000, tz=timezone.utc)
        messages_scannes.append({
            "messageId": msg_id,
            "threadId": details.get("threadId", ""),
            "subject": details.get("subject", ""),
            "receivedAt": email_datetime,
            "lastStatus": "SCANNED",
        })

        if msg_id in emails_exclus:
            log.info(f"Email exclu ignoré (gmail_excluded) : {msg_id}")
            continue

        # Le parsing est délégué au module spécialisé (BeautifulSoup)
        txs, soldes = parse_email_linxo(details["html"], CONFIG)

        for tx in txs:
            compte_budget = CONFIG["COMPTES_ACTIFS"].get(tx["compteLinxo"])
            if not compte_budget:
                continue

            nouvelles_transactions.append({
                "date": tx["date"],
                "libelle": tx["libelle"],
                "compte": compte_budget,
                "montant": tx["montant"],
                "categorie": mapping_categories.get(tx["categorieLinxo"], ""),
                "source": "gmail",
                "emailDate": email_datetime,
                "enAttente": tx.get("enAttente", False),
            })

        # Conversion des soldes Linxo vers le mapping budget
        # On collecte ici les infos brutes ; le calcul de cohérence se fera
        # APRÈS la sauvegarde des transactions (voir _persister).
        for solde in soldes:
            compte_budget = CONFIG["COMPTES_ACTIFS"].get(solde["compte"])
            if compte_budget:
                soldes_raw.append({
                    "compte": compte_budget,
                    "solde": solde["solde"],
                    "emailDate": email_datetime,
                    "status": solde.get("status", "OK"),
                    "msg_id": msg_id,
                })

        messages_traites.append(msg_id)

    return nouvelles_transactions, soldes_raw, messages_scannes, messages_traites


def _persister(nouvelles_transactions, soldes_raw, dedup_since_days=60, admettre_probables=True):
    """Déduplique, réconcilie et sauvegarde les transactions, puis les soldes.

    Retourne le nombre de transactions effectivement écrites. Suppose Firebase
    disponible (le garde est posé par l'appelant).

    Args:
        dedup_since_days : fenêtre de déduplication. 60 j suffit pour l'import
            incrémental quotidien ; un reparse doit passer 0 (= tout l'historique),
            sinon les transactions plus anciennes sont invisibles à la dédup et
            réécrites en double.
        admettre_probables : réinjecte les quasi-doublons (même compte+montant à
            ±3 j, libellé différent). Pertinent en incrémental, jamais en reparse.
    """
    count_saved = 0

    # Déduplication et sauvegarde des transactions
    if nouvelles_transactions:
        # Chargement des transactions existantes pour déduplication croisée
        existantes = charger_transactions_existantes_pour_dedoublonnage(since_days=dedup_since_days)
        fenetre = f"{dedup_since_days}j" if dedup_since_days > 0 else "tout l'historique"
        log.info(f"Transactions existantes chargées pour dédup ({fenetre}) : {len(existantes)}")

        # Réconciliation « en attente » → « réalisée » : Linxo re-notifie
        # certains virements sous leur vrai libellé et leur date de valeur.
        # Les opérations en attente sans contrepartie (cartes, prélèvements)
        # sont conservées : elles ne seront jamais re-notifiées.
        nouvelles_transactions, pending_obsoletes = reconcile_pending(
            nouvelles_transactions, existantes
        )
        if pending_obsoletes:
            log.info(
                f"{len(pending_obsoletes)} opération(s) « en attente » remplacée(s) "
                f"par leur version réalisée."
            )

        a_importer, stricts, probables = deduplicate(nouvelles_transactions, existantes)
        log.info(
            f"Déduplication : {len(a_importer)} nouvelles | "
            f"{len(stricts)} doublons stricts | "
            f"{len(probables)} doublons probables (date+montant, inclus pour gmail)"
        )
        # Les "probables" sont inclus pour la source gmail EN INCRÉMENTAL : deux
        # opérations du même montant à 3 jours d'écart avec des libellés différents
        # sont deux vraies transactions distinctes (ex: deux achats Intermarché).
        # En reparse, au contraire, on rejoue des mails déjà importés : réinjecter
        # les quasi-doublons y crée de faux doublons.
        a_importer_gmail = a_importer + probables if admettre_probables else a_importer
        if a_importer_gmail:
            # Catégorisation IA (RAG) avant sauvegarde — corpus = toutes
            # les transactions déjà catégorisées. No-op si AI_API_KEY absente.
            try:
                corpus = charger_transactions_categorisees()
                recurrences = charger_recurrences_actives()
                categorize_batch(a_importer_gmail, corpus, recurrences)
            except Exception as e:
                log.warning("Catégorisation IA ignorée (%s) — import poursuivi.", e)

            log.info(f"Sauvegarde de {len(a_importer_gmail)} transactions...")
            sauvegarder_transactions(a_importer_gmail, source="gmail")
            count_saved = len(a_importer_gmail)

            # Invalidation du cache des budgets (V2)
            try:
                from budgets_manager import invalidate_cache_for_category
                db_inst = is_firebase_available() and _get_db()
                if db_inst:
                    categories_to_invalidate = set(t["categorie"] for t in a_importer_gmail if t.get("categorie"))
                    for cat in categories_to_invalidate:
                        invalidate_cache_for_category(db_inst, cat, a_importer_gmail[0]["date"].strftime("%Y-%m-%d"))
                    log.info(f"Cache des budgets invalidé pour {len(categories_to_invalidate)} catégories.")
            except Exception as e:
                log.warning(f"Erreur lors de l'invalidation du cache budget : {e}")
        else:
            log.info("Aucune nouvelle transaction à sauvegarder.")

        # Après sauvegarde uniquement : on ne retire l'ancienne ligne
        # « en attente » qu'une fois sa version réalisée écrite.
        supprimer_transactions_par_ids(pending_obsoletes)
    else:
        log.info("Aucune transaction extraite des emails.")

    # Écriture directe du solde Linxo dans account_balances.
    # Le solde est toujours présent dans l'email : c'est la valeur de
    # vérité, on l'écrit telle quelle (pas de recalcul). calcul_coherence_solde
    # ne renseigne qu'un champ d'audit `ecart` et bascule le statut en
    # pending_review si le solde diverge de (précédent + transactions).
    # Les transactions sont déjà persistées ci-dessus, donc linxoDelta
    # reflète bien les mouvements de ce batch.
    if soldes_raw:
        # Tri chronologique : plusieurs mails du même compte peuvent arriver
        # dans le même run. On les traite du plus ancien au plus récent pour
        # que le dernier solde écrit dans account_balances (last-wins) soit le
        # plus récent, et que chaque contrôle de cohérence soit borné par
        # l'emailDate de son propre mail (cf. upper_email_date).
        soldes_raw.sort(key=lambda r: r["emailDate"])
        soldes_payload = []
        # Un seul scan de la collection `transactions` pour tous les soldes de
        # ce run, plutôt qu'un scan complet par solde dans calcul_coherence_solde.
        tx_par_compte = defaultdict(list)
        for tx in charger_transactions_existantes_pour_dedoublonnage(since_days=0):
            tx_par_compte[tx.get("compte")].append(tx)
        for raw in soldes_raw:
            control = calcul_coherence_solde(
                raw["compte"], raw["solde"], raw["emailDate"],
                upper_email_date=raw["emailDate"],
                tx_all=tx_par_compte.get(raw["compte"], []),
            )
            payload = {
                "compte": raw["compte"],
                "solde": raw["solde"],
                "emailDate": raw["emailDate"],
            }
            if control["previousSolde"] is not None:
                payload.update({
                    "previousSolde": control["previousSolde"],
                    "linxoDelta": control["linxoDelta"],
                    "computedSolde": control["computedSolde"],
                    "ecart": control["ecart"],
                })
            payload["status"] = resolve_status(control["ecart"], BALANCE_RECONCILIATION_TOLERANCE)
            soldes_payload.append(payload)

        sauvegarder_soldes_comptes(soldes_payload, source="gmail")
        log.info(f"Soldes mis à jour : {[s['compte'] for s in soldes_payload]}")
    else:
        log.info("Aucun solde extrait des emails.")

    return count_saved


def _traiter_reparse_jobs(gmail, mapping_categories, emails_exclus, reparse_query, reparse_sync_limit):
    """Consomme les jobs de reparse déposés par la page « Reparse Gmail ».

    Chaque job re-récupère ses mails PAR ID (indépendamment du label
    Linxo_Importé) et rejoue le pipeline. Idempotent : doc-ID déterministe +
    deduplicate + reconcile_pending protègent des doublons. Un job passe de
    `requested` à `done`/`error`, donc n'est pas rejoué.
    """
    jobs = lister_reparse_jobs_en_attente()
    if not jobs:
        return
    log.info(f"{len(jobs)} job(s) de reparse à traiter.")

    for job in jobs:
        job_id = job["id"]
        try:
            if job_id == "full_scan_request":
                refs = gmail.search_emails(reparse_query, max_results=reparse_sync_limit)
                log.info(f"Reparse full-scan : {len(refs)} email(s).")
            else:
                message_id = job.get("messageId") or job_id
                refs = [{"id": message_id}]

            txs, soldes, _, _ = _collecter_messages(gmail, refs, mapping_categories, emails_exclus)
            # Un reparse rejoue des mails DÉJÀ importés : la dédup doit voir tout
            # l'historique (et non 60 j) et ne rien réinjecter au-delà du strictement
            # nouveau, sinon le re-scan duplique le passé.
            count = _persister(txs, soldes, dedup_since_days=0, admettre_probables=False)
            marquer_reparse_job(
                job_id, "done", f"{count} transaction(s) réimportée(s).", {"progressPct": 100}
            )
            log.info(f"Reparse job {job_id} terminé : {count} transaction(s).")
        except Exception as e:
            log.error(f"Reparse job {job_id} en échec : {e}")
            marquer_reparse_job(job_id, "error", str(e))


def main():
    if str(os.environ.get("DISABLE_LINXO_IMPORT", "")).lower() in ("true", "1", "yes"):
        log.info("DISABLE_LINXO_IMPORT=true — import Linxo désactivé, sortie propre.")
        return

    log.info("=== Début import Linxo (Architecture Clean) ===")
    
    if "LCL Compte Joint" in CONFIG["COMPTES_ACTIFS"]:
        log.info("⚠️ MODE FALLBACK ACTIF : Le parsing des e-mails pour LCL est réactivé.")
    
    # 1. Initialisation des clients
    creds = get_credentials()
    gmail = GmailClient(creds)
    mapping_categories = charger_mapping_categories_linxo() if is_firebase_available() else {}

    # 2. Recherche des emails non traités
    query = f"from:assistance@linxo.com subject:Notification -label:{CONFIG['GMAIL_LABEL']}"
    messages = gmail.search_emails(query, max_results=15)
    reparse_sync_limit = int(os.environ.get("GMAIL_REPARSE_LIST_LIMIT", "200"))
    reparse_query = "from:assistance@linxo.com subject:Notification"
    log.info(f"{len(messages)} emails trouvés à traiter.")

    # Liste des mails exclus par l'utilisateur (page Reparse Gmail).
    emails_exclus = charger_emails_exclus() if is_firebase_available() else set()

    # 3. Traitement du batch normal
    nouvelles_transactions, soldes_raw, messages_scannes, messages_traites = _collecter_messages(
        gmail, messages, mapping_categories, emails_exclus
    )

    # 4. Déduplication + Sauvegarde Base de données
    if is_firebase_available():
        try:
            _persister(nouvelles_transactions, soldes_raw)

            # 5. Marquage Gmail (même si 0 nouvelles — évite le re-traitement de l'email)
            for msg_id in messages_traites:
                gmail.add_label(msg_id, CONFIG["GMAIL_LABEL"])

            # Synchroniser aussi la liste Reparse avec les derniers emails Linxo
            # (y compris déjà importés) pour éviter les trous dans l'UI.
            recent_for_reparse = gmail.search_emails(reparse_query, max_results=reparse_sync_limit)
            known_ids = {m.get("messageId") for m in messages_scannes}
            for msg_ref in recent_for_reparse:
                msg_id = str(msg_ref.get("id", "")).strip()
                if not msg_id or msg_id in known_ids:
                    continue
                meta = gmail.get_message_metadata(msg_id)
                received_at = datetime.fromtimestamp(meta["internalDate"] / 1000, tz=timezone.utc)
                messages_scannes.append({
                    "messageId": msg_id,
                    "threadId": meta.get("threadId", ""),
                    "subject": meta.get("subject", ""),
                    "receivedAt": received_at,
                })
                known_ids.add(msg_id)

            if messages_scannes:
                upsert_gmail_messages(messages_scannes)

            # 6. Jobs de reparse déposés par la page « Reparse Gmail »
            _traiter_reparse_jobs(
                gmail, mapping_categories, emails_exclus, reparse_query, reparse_sync_limit
            )

        except Exception as e:
            log.error(f"Échec de l'écriture Firebase, les emails ne seront pas marqués : {e}")

    log.info("=== Import terminé ===")

if __name__ == "__main__":
    main()
