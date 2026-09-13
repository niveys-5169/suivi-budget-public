# functions/main.py
import logging
import base64
import json
import os
from collections import defaultdict
from datetime import datetime, timedelta, timezone
import requests
from firebase_functions import https_fn, scheduler_fn, pubsub_fn
from firebase_admin import firestore, initialize_app
from google.oauth2.credentials import Credentials
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_auth_requests

from gmail_client import GmailClient
from transaction_parser import parse_email_linxo
from firebase_db import (
    calcul_coherence_solde,
    charger_mapping_categories_linxo,
    charger_recurrences_actives,
    charger_transactions_categorisees,
    charger_transactions_existantes_pour_dedoublonnage,
    sauvegarder_soldes_comptes,
    sauvegarder_transactions,
    supprimer_transactions_par_ids,
    take_patrimoine_snapshot,
    sync_portfolio_daily,
    charger_ids_emails_traites,
    marquer_email_traite,
    save_gmail_history_id,
    get_gmail_history_id,
    save_gmail_watch_status,
)
from balance_coherence import resolve_status
from dedup import reconcile_pending
from src.reconciliation_actions import record_reconciliation_action_logic
from src.auth import require_owner
from ai_categorizer import categorize_batch

# Initialisation de l'environnement Firebase
initialize_app()

CONFIG = {
    "MONTANT_MIN": -50000,
    "MONTANT_MAX": 50000,
    "GMAIL_LABEL": "Linxo_Importé",
    "COMPTES_ACTIFS": {"BforBank Compte Courant": "BforBank", "LCL Compte Joint": "LCL"}
}

LINXO_SENDER = "assistance@linxo.com"

GMAIL_PUBSUB_TOPIC = "gmail-linxo-notifications"
# Le topic doit être dans le projet de l'app OAuth Gmail : Gmail API l'exige et
# rejette tout autre topicName ("Invalid topicName does not match
# projects/<projet OAuth>/topics/*"). Le client OAuth vit désormais dans le
# projet Firebase, donc toute la chaîne — topic, subscription, compte de
# signature, handler — tient dans ce seul projet.
GMAIL_OAUTH_PROJECT_ID = "suivi-budget-ab888"

# Identité et audience attendues du jeton OIDC Pub/Sub (injectées par
# deploy-functions.yml, cf. --push-auth-service-account / --push-auth-token-audience
# de la push subscription). Absentes : le handler refuse tout par défaut.
GMAIL_PUSH_SERVICE_ACCOUNT = os.environ.get("GMAIL_PUSH_SERVICE_ACCOUNT", "")
GMAIL_PUSH_AUDIENCE = os.environ.get("GMAIL_PUSH_AUDIENCE", "")

BALANCE_RECONCILIATION_TOLERANCE = float(os.environ.get("BALANCE_RECONCILIATION_TOLERANCE", "0.01"))

# Nombre maximum d'emails récupérés par la recherche Gmail.
GMAIL_SEARCH_MAX = int(os.environ.get("GMAIL_SEARCH_MAX", "100"))
# Plafond d'emails traités par invocation : borne le temps mur pour ne jamais
# dépasser le timeout Cloud Functions sur un gros backlog. Le reste est drainé
# par les invocations suivantes (poll */15min), chaque email n'étant marqué
# traité qu'après persistance de ses transactions ET de son solde.
MAX_EMAILS_PER_RUN = int(os.environ.get("MAX_EMAILS_PER_RUN", "25"))

# Dépôt cible du repository_dispatch GitHub (cf. dispatch_github_workflow) —
# mêmes valeurs par défaut que celles historiquement codées côté client.
GITHUB_REPO_OWNER = os.environ.get("GITHUB_REPO_OWNER", "niveys-5169")
GITHUB_REPO_NAME = os.environ.get("GITHUB_REPO_NAME", "Suivi-Budget")
GITHUB_DISPATCH_TIMEOUT_S = 20


def _build_gmail_client() -> GmailClient:
    """Construit un GmailClient depuis la variable d'env GMAIL_TOKEN."""
    token_b64 = os.environ.get("GMAIL_TOKEN")
    if not token_b64:
        raise ValueError("Variable GMAIL_TOKEN introuvable dans l'environnement.")
    creds = Credentials.from_authorized_user_info(
        json.loads(base64.b64decode(token_b64).decode("utf-8"))
    )
    return GmailClient(creds)


def _run_linxo_import_core(gmail: GmailClient) -> dict:
    """Logique d'import Linxo partagée entre le trigger on_call et le trigger Pub/Sub."""
    mapping_categories = charger_mapping_categories_linxo()
    processed_emails = charger_ids_emails_traites()

    after_date = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y/%m/%d")
    query = f"from:{LINXO_SENDER} subject:Notification after:{after_date}"
    messages = gmail.search_emails(query, max_results=GMAIL_SEARCH_MAX)

    # Gmail renvoie les résultats du plus récent au plus ancien. On traite du
    # plus ancien au plus récent pour que le dernier solde écrit (last-wins) soit
    # le plus récent, puis on borne la file à MAX_EMAILS_PER_RUN par invocation.
    queue = [m for m in reversed(messages) if m["id"] not in processed_emails]
    emails_remaining = max(0, len(queue) - MAX_EMAILS_PER_RUN)
    queue = queue[:MAX_EMAILS_PER_RUN]

    nouvelles_transactions = []
    soldes_a_traiter = []
    messages_traites_succes = []

    for msg_ref in queue:
        msg_id = msg_ref["id"]

        details = gmail.get_message_html(msg_id)
        txs, soldes = parse_email_linxo(details["html"], CONFIG)

        logging.info(
            f"Email {msg_id}: {len(txs)} transaction(s), {len(soldes)} solde(s). "
            f"Comptes: {list({tx['compteLinxo'] for tx in txs} | {s['compte'] for s in soldes})}"
        )

        email_datetime = datetime.fromtimestamp(details["internalDate"] / 1000, tz=timezone.utc)

        for tx in txs:
            compte_budget = CONFIG["COMPTES_ACTIFS"].get(tx["compteLinxo"])
            if compte_budget:
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
            else:
                logging.warning(f"Compte Linxo inconnu ignoré : '{tx['compteLinxo']}'")

        for solde in soldes:
            compte_budget = CONFIG["COMPTES_ACTIFS"].get(solde["compte"])
            if compte_budget:
                soldes_a_traiter.append({
                    "compte": compte_budget,
                    "solde": solde["solde"],
                    "emailDate": email_datetime,
                    "status": solde.get("status", "OK"),
                    "msg_id": msg_id,
                })
            else:
                logging.warning(f"Compte solde Linxo inconnu ignoré : '{solde['compte']}'")

        messages_traites_succes.append(msg_id)

    # Persiste les transactions avant de calculer la cohérence du solde pour que
    # linxoDelta reflète les mouvements de ce batch.
    transactions_saved = 0
    if nouvelles_transactions:
        # Réconciliation « en attente » → « réalisée » : Linxo re-notifie certains
        # virements sous leur vrai libellé et leur date de valeur. Les opérations
        # en attente sans contrepartie (cartes, prélèvements) sont conservées :
        # elles ne seront jamais re-notifiées.
        nouvelles_transactions, pending_obsoletes = reconcile_pending(
            nouvelles_transactions,
            charger_transactions_existantes_pour_dedoublonnage(since_days=60),
        )

        # Catégorisation IA (RAG) avant sauvegarde : ne touche que les
        # transactions sans catégorie (le mapping Linxo a déjà rempli celles
        # qu'il pouvait) et qui ne ressemblent pas à une récurrence active.
        # Corpus d'apprentissage = transactions déjà catégorisées.
        # No-op si AI_API_KEY absente.
        try:
            corpus = charger_transactions_categorisees()
            recurrences = charger_recurrences_actives()
            categorize_batch(nouvelles_transactions, corpus, recurrences)
        except Exception:
            logging.exception("Catégorisation IA ignorée — import poursuivi.")

        transactions_saved = sauvegarder_transactions(nouvelles_transactions, source="gmail")

        # Après sauvegarde uniquement : on ne retire l'ancienne ligne « en attente »
        # qu'une fois sa version réalisée écrite.
        supprimer_transactions_par_ids(pending_obsoletes)

    # Écriture directe du solde Linxo dans account_balances : le solde de l'email
    # est la valeur de vérité, on l'écrit telle quelle (pas de recalcul).
    # calcul_coherence_solde ne renseigne qu'un champ d'audit `ecart` et bascule
    # le statut en pending_review si le solde diverge de (précédent + transactions).
    # Tri chronologique : plusieurs mails du même compte dans un même run sont
    # traités du plus ancien au plus récent, pour que le dernier solde écrit
    # (last-wins) soit le plus récent et que chaque contrôle de cohérence soit
    # borné par l'emailDate de son propre mail (cf. upper_email_date).
    soldes_a_traiter.sort(key=lambda r: r["emailDate"])
    soldes_payload = []
    # Un seul scan de la collection `transactions` pour tous les soldes de ce
    # run, plutôt qu'un scan complet par solde dans calcul_coherence_solde.
    tx_par_compte = defaultdict(list)
    if soldes_a_traiter:
        for tx in charger_transactions_existantes_pour_dedoublonnage(since_days=0):
            tx_par_compte[tx.get("compte")].append(tx)
    for raw in soldes_a_traiter:
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

    soldes_count = len(soldes_payload)
    if soldes_payload:
        sauvegarder_soldes_comptes(soldes_payload, source="gmail")

    for msg_id in messages_traites_succes:
        marquer_email_traite(msg_id)
        try:
            gmail.add_label(msg_id, CONFIG["GMAIL_LABEL"])
        except Exception:
            # L'email reste marqué traité en Firestore (marquer_email_traite),
            # mais sans label Gmail il resterait candidat aux prochains scans :
            # on trace l'échec au lieu de l'avaler.
            logging.exception(f"Échec de l'ajout du label Gmail sur {msg_id}.")

    logging.info(
        f"Import terminé : {len(messages_traites_succes)} email(s), "
        f"{transactions_saved}/{len(nouvelles_transactions)} transaction(s), "
        f"{soldes_count} solde(s). Backlog restant : {emails_remaining}."
    )

    try:
        current_id = gmail.get_current_history_id()
        if current_id:
            save_gmail_history_id(current_id)
    except Exception:
        logging.exception("Impossible de sauvegarder le historyId Gmail.")

    return {
        "status": "success",
        "emailsScanned": len(messages),
        "emailsProcessed": len(messages_traites_succes),
        "emailsRemaining": emails_remaining,
        "transactionsParsed": len(nouvelles_transactions),
        "transactionsImported": transactions_saved,
        "soldesImported": soldes_count,
    }

@https_fn.on_call(region="europe-west1")
def reconcile_balance_action(req: https_fn.CallableRequest) -> dict:
    """Exposes record_reconciliation_action_logic as an on_call function."""
    return record_reconciliation_action_logic(req)

@https_fn.on_call(region="europe-west1")
def trigger_patrimoine_snapshot(req: https_fn.CallableRequest) -> dict:
    """Déclenche manuellement un snapshot du patrimoine."""
    try:
        require_owner(req)

        count = take_patrimoine_snapshot()
        return {"status": "success", "entries": count}
    except https_fn.HttpsError:
        raise
    except Exception as e:
        logging.exception("Erreur dans trigger_patrimoine_snapshot")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=str(e)
        )

@scheduler_fn.on_schedule(schedule="5 0 * * *", region="europe-west1")
def scheduled_patrimoine_snapshot_daily(event: scheduler_fn.ScheduledEvent) -> None:
    """Snapshot quotidien (tous les jours à 00:05 UTC)."""
    try:
        take_patrimoine_snapshot()
    except Exception:
        logging.exception("Échec du snapshot patrimoine quotidien")


@scheduler_fn.on_schedule(schedule="0 21 * * *", region="europe-west1")
def scheduled_portfolio_daily_sync(event: scheduler_fn.ScheduledEvent) -> None:
    """Synchro quotidienne des cours du portefeuille (21:00 UTC, après clôture EU)."""
    try:
        sync_portfolio_daily()
    except Exception:
        logging.exception("Échec de la synchro portefeuille quotidienne")


@https_fn.on_call(region="europe-west1")
def trigger_portfolio_daily_sync(req: https_fn.CallableRequest) -> dict:
    """Déclenche manuellement la synchro des cours du portefeuille."""
    try:
        require_owner(req)
        count = sync_portfolio_daily()
        return {"status": "success", "entries": count}
    except https_fn.HttpsError:
        raise
    except Exception as e:
        logging.exception("Erreur dans trigger_portfolio_daily_sync")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=str(e)
        )

@https_fn.on_call(region="europe-west1")
def import_linxo_transactions(req: https_fn.CallableRequest) -> dict:
    try:
        require_owner(req)
        gmail = _build_gmail_client()
        return _run_linxo_import_core(gmail)
    except https_fn.HttpsError:
        raise
    except Exception as e:
        logging.exception("Erreur non gérée dans import_linxo_transactions")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Erreur inattendue : {type(e).__name__}: {e}"
        )

def _dispatch_github_workflow_logic(req: https_fn.CallableRequest) -> dict:
    """Logique de dispatch_github_workflow, testable indépendamment du wrapper on_call."""
    try:
        require_owner(req)

        event_type = req.data.get("event_type")
        if not event_type:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
                message="event_type manquant."
            )
        client_payload = req.data.get("client_payload")

        token = os.environ.get("GITHUB_DISPATCH_TOKEN")
        if not token:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
                message="Variable GITHUB_DISPATCH_TOKEN introuvable dans l'environnement."
            )

        body = {"event_type": event_type}
        if client_payload:
            body["client_payload"] = client_payload

        resp = requests.post(
            f"https://api.github.com/repos/{GITHUB_REPO_OWNER}/{GITHUB_REPO_NAME}/dispatches",
            headers={
                "Authorization": f"token {token}",
                "Accept": "application/vnd.github.v3+json",
                "Content-Type": "application/json",
            },
            json=body,
            timeout=GITHUB_DISPATCH_TIMEOUT_S,
        )
        if resp.status_code != 204:
            raise RuntimeError(f"GitHub HTTP {resp.status_code}: {resp.text[:200]}")

        return {"status": "success"}
    except https_fn.HttpsError:
        raise
    except Exception as e:
        logging.exception("Erreur dans dispatch_github_workflow")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=str(e)
        )

@https_fn.on_call(region="europe-west1")
def dispatch_github_workflow(req: https_fn.CallableRequest) -> dict:
    """Déclenche un repository_dispatch GitHub Action.

    Le jeton GitHub (GITHUB_DISPATCH_TOKEN) reste côté serveur : il ne transite
    plus jamais par le navigateur ni par Firestore.
    """
    return _dispatch_github_workflow_logic(req)


def _verify_pubsub_push(req: https_fn.Request) -> bool:
    """Vérifie que la requête provient bien de la push subscription Pub/Sub attendue.

    gmail_watch_handler est un endpoint public (allUsers/run.invoker, requis
    pour les Firebase Callables du même déploiement) : sans cette vérification,
    n'importe qui connaissant l'URL pourrait forger une notification et
    déclencher un import Gmail complet à volonté. Pub/Sub signe chaque requête
    push d'un jeton OIDC Google pour le compte de service configuré au
    --push-auth-service-account de la subscription (voir deploy-functions.yml,
    étape "Provision Gmail Pub/Sub") ; on vérifie ici que le jeton est valide,
    non expiré, pour la bonne audience, et émis pour ce compte de service précis.

    GMAIL_PUSH_SERVICE_ACCOUNT / GMAIL_PUSH_AUDIENCE absents (déploiement pas
    encore réarmé, ou configuration incomplète) : refuse tout par défaut
    (fail-closed) plutôt que d'accepter une requête non authentifiée.
    """
    if not GMAIL_PUSH_SERVICE_ACCOUNT or not GMAIL_PUSH_AUDIENCE:
        logging.error(
            "gmail_watch_handler : GMAIL_PUSH_SERVICE_ACCOUNT/GMAIL_PUSH_AUDIENCE "
            "non configurés — requête refusée par défaut."
        )
        return False

    auth_header = req.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return False

    try:
        claims = google_id_token.verify_oauth2_token(
            auth_header[len("Bearer "):],
            google_auth_requests.Request(),
            audience=GMAIL_PUSH_AUDIENCE,
        )
    except Exception:
        # ValueError = jeton invalide/expiré/mauvaise audience, mais
        # verify_oauth2_token récupère aussi les certificats Google par le
        # réseau à chaque appel et peut lever une TransportError : toute
        # défaillance vaut refus (403 maîtrisé, que Pub/Sub réessaiera) plutôt
        # qu'une exception non rattrapée remontée en 500.
        logging.warning("gmail_watch_handler : vérification du jeton OIDC impossible.", exc_info=True)
        return False

    return (
        claims.get("email") == GMAIL_PUSH_SERVICE_ACCOUNT
        and claims.get("email_verified") is True
    )


@https_fn.on_request(region="europe-west1")
def gmail_watch_handler(req: https_fn.Request) -> https_fn.Response:
    """Reçoit les notifications Gmail Watch via Pub/Sub push subscription HTTP.

    Gmail pousse une notification vers suivi-budget-ab888/topics/gmail-linxo-notifications,
    et une push subscription HTTP livre le message à cet endpoint.
    On récupère uniquement les messages ajoutés depuis le dernier historyId connu,
    on filtre ceux de Linxo, et on lance l'import seulement si nécessaire.
    """
    if not _verify_pubsub_push(req):
        logging.warning("gmail_watch_handler : requête refusée (authentification Pub/Sub absente ou invalide).")
        return https_fn.Response("Forbidden", status=403)

    try:
        envelope = req.get_json(silent=True) or {}
        message = envelope.get("message", {})
        data_b64 = message.get("data", "")
        if data_b64:
            notification = json.loads(base64.b64decode(data_b64 + "==").decode("utf-8"))
        else:
            notification = {}
        new_history_id = str(notification.get("historyId", ""))
        logging.info(f"Gmail Watch notification reçue. historyId={new_history_id}")
    except Exception:
        logging.exception("Impossible de décoder la notification Pub/Sub Gmail")
        return https_fn.Response("Bad Request", status=400)

    try:
        gmail = _build_gmail_client()
        stored_history_id = get_gmail_history_id()

        if not stored_history_id:
            logging.warning("Aucun historyId stocké — import complet lancé")
            _run_linxo_import_core(gmail)
            return https_fn.Response("OK", status=200)

        try:
            new_ids = gmail.get_new_message_ids_from_history(stored_history_id)
        except Exception as e:
            # historyId expiré ou invalide (ex: > 7 jours) — fallback sur import complet
            logging.warning(f"get_new_message_ids_from_history échoué ({e}) — import complet lancé")
            _run_linxo_import_core(gmail)
            return https_fn.Response("OK", status=200)

        linxo_ids = [
            mid for mid in new_ids
            if LINXO_SENDER in gmail.get_message_sender(mid)
        ]
        logging.info(f"{len(new_ids)} nouveau(x) message(s) depuis historyId={stored_history_id}, {len(linxo_ids)} Linxo.")

        if linxo_ids:
            # _run_linxo_import_core sauvegarde le historyId courant en fin d'exécution
            _run_linxo_import_core(gmail)
        elif new_history_id:
            # Aucun email Linxo : avance quand même le curseur pour éviter de re-scanner
            save_gmail_history_id(new_history_id)

        return https_fn.Response("OK", status=200)

    except Exception:
        logging.exception("Erreur dans gmail_watch_handler")
        return https_fn.Response("Internal Server Error", status=500)


def _register_gmail_watch() -> dict:
    """Enregistre le Gmail Watch et persiste le résultat de la tentative.

    Partagé par setup_gmail_watch (bouton Maintenance) et renew_gmail_watch
    (planificateur) : les deux chemins doivent laisser la même trace dans
    `metadata/gmail_watch_state`, sinon un échec du renouvellement automatique
    reste invisible. Relève l'exception à l'appelant après l'avoir enregistrée.
    """
    gmail = _build_gmail_client()
    topic = f"projects/{GMAIL_OAUTH_PROJECT_ID}/topics/{GMAIL_PUBSUB_TOPIC}"
    try:
        result = gmail.setup_watch(topic)
    except Exception as e:
        save_gmail_watch_status(expiration=None, error=str(e))
        raise

    history_id = str(result.get("historyId", ""))
    if history_id:
        save_gmail_history_id(history_id)
    expiration = str(result.get("expiration", "")) or None
    save_gmail_watch_status(expiration=expiration, error=None)
    logging.info(f"Gmail Watch enregistré. historyId={history_id}, expiration={expiration}")
    return {"historyId": history_id, "expiration": expiration}


@https_fn.on_call(region="europe-west1")
def setup_gmail_watch(req: https_fn.CallableRequest) -> dict:
    """Enregistre ou renouvelle le Gmail Watch Pub/Sub (expire après 7 jours max).

    Sert à réarmer le watch immédiatement (changement de topic, expiration) sans
    attendre le passage quotidien de renew_gmail_watch.
    """
    try:
        require_owner(req)
        state = _register_gmail_watch()
        return {
            "status": "success",
            "historyId": state["historyId"],
            "expiration": state["expiration"],
        }
    except https_fn.HttpsError:
        raise
    except Exception as e:
        logging.exception("Erreur dans setup_gmail_watch")
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.INTERNAL, str(e))


@scheduler_fn.on_schedule(schedule="0 6 * * *", region="europe-west1")
def renew_gmail_watch(event: scheduler_fn.ScheduledEvent) -> None:
    """Renouvelle le Gmail Watch chaque jour à 06:00 UTC.

    Quotidien et non hebdomadaire : le watch expire au bout de 7 jours, donc un
    passage par semaine ne laisse aucune marge — un seul échec (erreur API
    transitoire, jeton momentanément invalide) tuait Gmail Push pendant 7 jours.
    Six renouvellements de rattrapage valent mieux qu'une panne silencieuse.
    """
    try:
        _register_gmail_watch()
    except Exception:
        logging.exception("Échec du renouvellement du Gmail Watch")
