"""
src/transaction_parser.py
Gère uniquement l'extraction des données depuis le HTML de l'email Linxo.
"""
import re
from datetime import datetime, timedelta, timezone
from bs4 import BeautifulSoup
import logging

log = logging.getLogger(__name__)

def parse_date_fr(s: str):
    try:
        return datetime.strptime(s.strip(), "%d/%m/%Y")
    except (ValueError, AttributeError):
        return None

def parse_montant_fr(s: str):
    try:
        s = re.sub(r"[€\s\u00a0\u202f]", "", s).replace(",", ".")
        return float(s)
    except (ValueError, TypeError):
        return None

def nettoyer_libelle(lib: str) -> str:
    s = lib
    s = re.sub(r"PRELVT SEPA.*$", "", s, flags=re.IGNORECASE)
    s = re.sub(r"VIR\.PERMANENT\s*", "", s, flags=re.IGNORECASE)
    s = re.sub(r"CARTE \d{2}/\d{2}\s*", "", s, flags=re.IGNORECASE)
    s = re.sub(r"RETRAIT DAB\s*", "Retrait ", s, flags=re.IGNORECASE)
    s = re.sub(r"\s+", " ", s).strip()
    return s[:40] if s else ""

def _extract_solde_from_status_bloc(solde_bloc: str) -> tuple[float | None, str]:
    """Extrait le solde du bloc HTML STATUS ACCOUNT.

    Retourne (montant, status) où status ∈ {"OK", "parse_error", "masked"}.

    Durcissements vs l'ancien code :
    - Le texte est tronqué avant "Prévisionnel" pour ne jamais capturer le
      solde prévisionnel masqué (**** €).
    - Toute capture contenant "*" est rejetée (solde masqué).
    - Les patterns 3-5 (fallbacks sans €) exigent un séparateur décimal
      (virgule + 2 chiffres) pour rejeter les entiers longs (numéros de compte).
    """
    soup = BeautifulSoup(solde_bloc, 'html.parser')
    text = soup.get_text()
    # Tronquer avant "Prévisionnel" (comme le fallback Solde bas le fait déjà)
    text = re.split(r"Pr[ée]visionnel", text, maxsplit=1)[0]

    # Détecter explicitement un solde masqué (**** €) avant d'appliquer les patterns
    if re.search(r"(?:Solde|Balance)[^€\n]*\*+\s*€", text, re.IGNORECASE):
        return None, "masked"

    solde_patterns = [
        # 1. Avec colon/égal (strict)
        (r"(?:Solde|Balance)[^:=]*[:=]\s*([-+]?[   ]*[0-9][\s  \.,0-9]*€)", "colon_egal"),
        # 2. Sans colon, avec € à la fin
        (r"(?:Solde|Balance).*?([-+]?[   ]*[0-9]+(?:[   \.,][0-9]+)*\s*€)", "euro_final"),
        # 3-6. Fallbacks — exigent une virgule décimale ,\d{2} pour rejeter les entiers longs
        (r"Solde\s+du\s+compte\s+([-+]?[   ]*[0-9][\s  \.]*[0-9]*,[0-9]{2})(?!\s*[:=])", "solde_du_compte"),
        # Alerte « Solde bas » : même bloc STATUS, autre libellé (solde du jour)
        (r"Solde\s+bas\s+([-+]?[   ]*[0-9][\s  \.]*[0-9]*,[0-9]{2})(?!\s*[:=])", "solde_bas"),
        (r"Solde\s+actuel\s+([-+]?[   ]*[0-9][\s  \.]*[0-9]*,[0-9]{2})(?!\s*[:=])", "solde_actuel"),
        (r"Solde\s+([-+]?[   ]*[0-9][\s  \.]*[0-9]*,[0-9]{2})(?!\s*[:=])", "solde_direct"),
    ]

    for pattern, _ in solde_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            captured = match.group(1)
            if "*" in captured:
                return None, "masked"
            montant = parse_montant_fr(captured)
            if montant is not None:
                return montant, "OK"

    return None, "parse_error"


def parse_email_linxo(html: str, config: dict) -> tuple[list, list]:
    """Extrait les transactions et les soldes avec BeautifulSoup pour plus de robustesse."""
    transactions = []
    soldes = []
    # Ancré sur UTC (rendu naïf pour rester comparable aux dates parsées naïves),
    # indépendant du fuseau de la machine hôte.
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    two_years_ago = now - timedelta(days=730)
    thirty_ahead = now + timedelta(days=30)

    if not html:
        return [], []

    blocs = html.split("<!-- Account Name -->")

    for bloc in blocs[1:]:
        # Isoler la partie transactions de la partie solde
        # Les emails Linxo contiennent souvent une section status/solde après les transactions
        parts_solde = bloc.split("<!--STATUS ACCOUNT")
        tx_bloc = parts_solde[0]
        solde_bloc = parts_solde[1] if len(parts_solde) > 1 else ""

        soup_tx = BeautifulSoup(tx_bloc, 'html.parser')

        # Le premier <strong> contient le nom du compte
        compte_node = soup_tx.find('strong')
        if not compte_node:
            continue
        compte_linxo = compte_node.get_text(strip=True)

        tx_parts = tx_bloc.split("<!-- Name of the notification -->")
        for i, part in enumerate(tx_parts[1:], start=1):
            # Le type de notification ("Opération en attente", "Dépenses", …)
            # précède le libellé : il se trouve donc à la fin du segment
            # précédent, après le dernier marqueur "Type of the notification".
            # On remonte l'information sans filtrer : Linxo notifie la plupart
            # des opérations une seule fois, souvent « en attente » (cartes,
            # prélèvements). Seuls certains virements sont re-notifiés une fois
            # réalisés ; ce doublon-là est traité par dedup.reconcile_pending.
            type_marker = tx_parts[i - 1].rsplit("<!-- Type of the notification -->", 1)[-1]
            type_text = BeautifulSoup(type_marker, 'html.parser').get_text()
            en_attente = "en attente" in type_text.lower()

            part_soup = BeautifulSoup(part, 'html.parser')
            strongs = part_soup.find_all('strong')

            if len(strongs) < 2:
                continue

            # Libellé et Montant
            libelle = nettoyer_libelle(strongs[0].get_text(strip=True))
            montant = parse_montant_fr(strongs[1].get_text(strip=True))

            if not libelle or montant is None or montant == 0:
                continue
            if not (config["MONTANT_MIN"] <= montant <= config["MONTANT_MAX"]):
                continue

            # Date (on cherche le texte contenant le format date)
            date = None
            date_text = part_soup.find(string=re.compile(r"\d{2}/\d{2}/\d{4}"))
            if date_text:
                m_date = re.search(r"(\d{2}/\d{2}/\d{4})", date_text)
                if m_date:
                    date = parse_date_fr(m_date.group(1))

            if not date or not (two_years_ago <= date <= thirty_ahead):
                continue

            # Catégorie (via icône bullet pour plus de robustesse)
            cat = ""
            bullet_img = part_soup.find('img', alt='bullet')
            if bullet_img:
                cat_node = bullet_img.find_next('font')
                if cat_node:
                    cat = cat_node.get_text(strip=True)

            # Fallback sur le dernier font tag si bullet non trouvé
            if not cat:
                font_tags = part_soup.find_all('font')
                if font_tags:
                    cat = font_tags[-1].get_text(strip=True)

            transactions.append({
                "compteLinxo": compte_linxo,
                "libelle": libelle,
                "montant": montant,
                "date": date,
                "categorieLinxo": cat,
                "enAttente": en_attente,
            })

        # Extraction du solde depuis le bloc dédié
        if solde_bloc:
            solde_montant, solde_status = _extract_solde_from_status_bloc(solde_bloc)
            if solde_status == "OK" and solde_montant is not None:
                soldes.append({
                    "compte": compte_linxo,
                    "solde": solde_montant,
                    "emailDate": now,
                    "status": "OK",
                })
            elif solde_status == "masked":
                log.debug(f"Solde masqué pour {compte_linxo}, ignoré.")
            else:
                log.warning(f"parse_error solde pour {compte_linxo} : bloc STATUS présent mais aucun montant reconnu.")
        else:
            # Fallback for "Solde bas" alert emails (no <!--STATUS ACCOUNT delimiter)
            soup_full = BeautifulSoup(bloc, 'html.parser')
            full_text = soup_full.get_text(" ", strip=True)

            # Truncate before "Prévisionnel" to avoid masked balance
            text_avant_previ = re.split(r"Pr[ée]visionnel", full_text, maxsplit=1)[0]

            # Look for "Solde bas" pattern, excluding masked amounts
            m = re.search(
                r"Solde\s+bas[^\d*-]{0,30}([-+]?[   ]*[0-9]+(?:[   \.,][0-9]+)*\s*€)",
                text_avant_previ,
                re.IGNORECASE,
            )
            if m and "*" not in m.group(1):
                solde_montant = parse_montant_fr(m.group(1))
                if solde_montant is not None:
                    soldes.append({
                        "compte": compte_linxo,
                        "solde": solde_montant,
                        "emailDate": now,
                        "status": "OK",
                    })

    return transactions, soldes
