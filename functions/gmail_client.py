"""
gmail_client.py
Gère exclusivement la communication avec l'API Gmail.

Module partagé maintenu byte-identique entre src/ et functions/.
Garde-fou : tests/test_shared_backend_sync.py échoue si les copies divergent.
"""
import base64
import quopri
import re
import logging
from email.utils import parseaddr
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

log = logging.getLogger(__name__)

class GmailClient:
    def __init__(self, credentials):
        self.service = build("gmail", "v1", credentials=credentials)

    def search_emails(self, query: str, max_results: int = 15) -> list:
        try:
            result = self.service.users().messages().list(userId="me", q=query, maxResults=max_results).execute()
            return result.get("messages", [])
        except HttpError as e:
            log.error(f"Erreur recherche Gmail : {e}")
            return []

    def get_message_html(self, msg_id: str) -> dict:
        """Récupère l'email, son HTML et les en-têtes nécessaires à son contrôle."""
        msg = self.service.users().messages().get(userId="me", id=msg_id, format="full").execute()
        payload = msg.get("payload", {})
        html = self._extract_html_from_payload(payload)
        subject = self._extract_header(payload, "Subject")

        return {
            "id": msg_id,
            "html": html,
            "threadId": msg.get("threadId", ""),
            "internalDate": int(msg.get("internalDate", "0")),
            "subject": subject,
            "headers": payload.get("headers", []),
        }

    def get_message_metadata(self, msg_id: str) -> dict:
        """Récupère uniquement les métadonnées utiles pour alimenter la liste reparse."""
        msg = self.service.users().messages().get(
            userId="me",
            id=msg_id,
            format="metadata",
            metadataHeaders=["Subject"],
        ).execute()
        subject = self._extract_header(msg.get("payload", {}), "Subject")
        return {
            "id": msg_id,
            "threadId": msg.get("threadId", ""),
            "internalDate": int(msg.get("internalDate", "0")),
            "subject": subject,
        }

    def _extract_html_from_payload(self, payload: dict) -> str:
        # Logique de décodage (Base64 / Quoted-printable)
        mime = payload.get("mimeType", "")
        if mime == "text/html":
            data = payload.get("body", {}).get("data", "")
            if data:
                raw = base64.urlsafe_b64decode(data + "==")
                html = raw.decode("utf-8", errors="replace")
                # Appliquer QP seulement si des séquences QP sont détectées.
                # Certains emails Linxo arrivent avec du QP résiduel que Gmail
                # ne décode pas ; appliquer quopri sur du HTML propre corrompt
                # les séquences =XX présentes dans les URLs et attributs.
                if "=3D" in html or re.search(r"=[A-Fa-f][0-9A-Fa-f]", html):
                    html = quopri.decodestring(raw).decode("utf-8", errors="replace")
                return html

        for part in payload.get("parts", []):
            result = self._extract_html_from_payload(part)
            if result:
                return result
        return ""

    def add_label(self, msg_id: str, label_name: str):
        # Récupérer ou créer le label
        labels = self.service.users().labels().list(userId="me").execute().get("labels", [])
        label_id = next((l["id"] for l in labels if l["name"] == label_name), None)

        if not label_id:
            created = self.service.users().labels().create(userId="me", body={"name": label_name}).execute()
            label_id = created["id"]

        self.service.users().messages().modify(
            userId="me", id=msg_id, body={"addLabelIds": [label_id], "removeLabelIds": ["INBOX", "UNREAD"]}
        ).execute()

    def remove_label(self, msg_id: str, label_name: str):
        """Retire un label d'un message. No-op si le label n'existe pas.

        Symétrique de add_label : sert au rattrapage, pour rendre à nouveau
        éligibles des emails déjà marqués comme importés.
        """
        labels = self.service.users().labels().list(userId="me").execute().get("labels", [])
        label_id = next((l["id"] for l in labels if l["name"] == label_name), None)
        if not label_id:
            return

        self.service.users().messages().modify(
            userId="me", id=msg_id, body={"removeLabelIds": [label_id]}
        ).execute()

    @staticmethod
    def _extract_header(payload: dict, header_name: str) -> str:
        for h in payload.get("headers", []):
            if str(h.get("name", "")).lower() == header_name.lower():
                return str(h.get("value", "")).strip()
        return ""

    @staticmethod
    def is_authenticated_sender(message: dict, expected_sender: str) -> bool:
        """Valide l'origine d'un message avant de confier son HTML à l'importeur.

        Gmail peut retourner un message trouvé par une recherche ``from:`` alors
        que le champ From a été usurpé. On exige donc l'adresse exacte et le
        résultat DMARC ajouté par Gmail pour le domaine affiché. Le contrôle est
        volontairement fail-closed : une preuve d'authentification absente ou
        ambiguë ne peut pas alimenter les écritures financières.
        """
        headers = message.get("headers", [])
        from_header = next(
            (
                str(header.get("value", "")).strip()
                for header in headers
                if str(header.get("name", "")).lower() == "from"
            ),
            "",
        )
        sender = parseaddr(from_header)[1].casefold()
        expected = expected_sender.casefold()
        if sender != expected:
            return False

        expected_domain = expected.rsplit("@", 1)[-1]
        authentication_results = [
            str(header.get("value", "")).strip()
            for header in headers
            if str(header.get("name", "")).lower() == "authentication-results"
        ]

        # Gmail prepends its Authentication-Results header. Rejecting multiple
        # values prevents a sender-supplied header from being accepted as Gmail's
        # authentication evidence.
        if len(authentication_results) != 1:
            return False

        authentication_result = authentication_results[0]
        if not re.match(r"^mx\.google\.com\s*;", authentication_result, re.IGNORECASE):
            return False
        if not re.search(r"\bdmarc\s*=\s*pass\b", authentication_result, re.IGNORECASE):
            return False

        domain_pattern = rf"\bheader\.from\s*=\s*{re.escape(expected_domain)}(?=\s|;|\(|$)"
        return bool(re.search(domain_pattern, authentication_result, re.IGNORECASE))

    def setup_watch(self, topic_name: str) -> dict:
        """Enregistre un Gmail Watch pour pousser les notifications vers un topic Pub/Sub."""
        return self.service.users().watch(
            userId="me",
            body={
                "topicName": topic_name,
            }
        ).execute()

    def stop_watch(self) -> None:
        """Arrête le Gmail Watch en cours."""
        self.service.users().stop(userId="me").execute()

    def get_new_message_ids_from_history(self, start_history_id: str) -> list:
        """Retourne les IDs des messages ajoutés à l'INBOX depuis le historyId donné.

        Lève HttpError si l'API Gmail échoue (ex: historyId invalide/expiré),
        afin que l'appelant puisse distinguer erreur API et «aucun nouveau message».
        """
        result = self.service.users().history().list(
            userId="me",
            startHistoryId=start_history_id,
            historyTypes=["messageAdded"],
        ).execute()
        ids = []
        for record in result.get("history", []):
            for added in record.get("messagesAdded", []):
                msg_id = added.get("message", {}).get("id")
                if msg_id:
                    ids.append(msg_id)
        return ids

    def get_current_history_id(self) -> str | None:
        """Retourne le historyId courant de la boîte Gmail via getProfile()."""
        try:
            profile = self.service.users().getProfile(userId="me").execute()
            return str(profile.get("historyId", "")) or None
        except HttpError as e:
            log.error(f"Erreur getProfile Gmail : {e}")
            return None

    def is_authenticated_message_from(self, msg_id: str, expected_sender: str) -> bool:
        """Vérifie l'origine d'un message sans télécharger son corps."""
        try:
            msg = self.service.users().messages().get(
                userId="me", id=msg_id, format="metadata",
                metadataHeaders=["From", "Authentication-Results"],
            ).execute()
            return self.is_authenticated_sender(msg.get("payload", {}), expected_sender)
        except HttpError as e:
            log.error(f"Erreur de vérification d'origine Gmail : {e}")
            return False
