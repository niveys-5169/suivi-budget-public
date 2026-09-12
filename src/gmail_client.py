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
        """Récupère l'email et extrait son HTML et ses métadonnées."""
        msg = self.service.users().messages().get(userId="me", id=msg_id, format="full").execute()
        html = self._extract_html_from_payload(msg.get("payload", {}))
        subject = self._extract_header(msg.get("payload", {}), "Subject")

        return {
            "id": msg_id,
            "html": html,
            "threadId": msg.get("threadId", ""),
            "internalDate": int(msg.get("internalDate", "0")),
            "subject": subject,
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

    def get_message_sender(self, msg_id: str) -> str:
        """Retourne le header From d'un message (fetch metadata uniquement)."""
        try:
            msg = self.service.users().messages().get(
                userId="me", id=msg_id, format="metadata",
                metadataHeaders=["From"]
            ).execute()
            headers = msg.get("payload", {}).get("headers", [])
            return next((h["value"] for h in headers if h["name"].lower() == "from"), "")
        except HttpError as e:
            log.error(f"Erreur get_message_sender Gmail : {e}")
            return ""
