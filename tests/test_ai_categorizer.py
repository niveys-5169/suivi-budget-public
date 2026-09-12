"""Tests pour src/ai_categorizer.py — orchestrateur RAG + client LLM OpenAI-compat.

Le client HTTP est mocké via `requests.post` ; aucun appel réseau réel.
"""
from unittest.mock import MagicMock, patch

import pytest

from ai_categorizer import AIConfig, call_openai_compatible, suggest_category


def _tx(libelle, categorie=None, montant=-10, date="2026-06-01", compte="LCL", id=None):
    return {"id": id, "libelle": libelle, "categorie": categorie,
            "montant": montant, "date": date, "compte": compte}


HISTORY = [
    _tx(id="1", libelle="CARREFOUR MARKET", categorie="Courses"),
    _tx(id="2", libelle="CARREFOUR CITY", categorie="Courses"),
]
CFG = AIConfig(api_key="sk-test", base_url="https://api.openai.com/v1", model="gpt-4o-mini")


# ── AIConfig.from_env ───────────────────────────────────────────────────────

def test_from_env_returns_none_without_key(monkeypatch):
    monkeypatch.delenv("AI_API_KEY", raising=False)
    assert AIConfig.from_env() is None


def test_from_env_picks_defaults(monkeypatch):
    monkeypatch.setenv("AI_API_KEY", "k")
    monkeypatch.delenv("AI_BASE_URL", raising=False)
    monkeypatch.delenv("AI_MODEL", raising=False)
    monkeypatch.delenv("AI_PROVIDER", raising=False)
    cfg = AIConfig.from_env()
    assert cfg.api_key == "k"
    assert cfg.base_url == "https://api.openai.com/v1"
    assert cfg.model == "gpt-4o-mini"
    assert cfg.provider == "openai"
    assert cfg.extra_headers == {}


def test_from_env_openrouter_adds_required_headers(monkeypatch):
    monkeypatch.setenv("AI_API_KEY", "k")
    monkeypatch.setenv("AI_PROVIDER", "openrouter")
    monkeypatch.setenv("AI_BASE_URL", "https://openrouter.ai/api/v1")
    monkeypatch.setenv("AI_MODEL", "google/gemini-2.0-flash-001")
    cfg = AIConfig.from_env()
    assert cfg.base_url == "https://openrouter.ai/api/v1"
    assert cfg.model == "google/gemini-2.0-flash-001"
    assert "X-Title" in cfg.extra_headers
    assert "HTTP-Referer" in cfg.extra_headers


def test_from_env_nvidia_uses_nvidia_base_url(monkeypatch):
    monkeypatch.setenv("AI_API_KEY", "k")
    monkeypatch.setenv("AI_PROVIDER", "nvidia")
    monkeypatch.setenv("AI_BASE_URL", "https://integrate.api.nvidia.com/v1")
    monkeypatch.setenv("AI_MODEL", "meta/llama-3.1-8b-instruct")
    cfg = AIConfig.from_env()
    assert cfg.base_url == "https://integrate.api.nvidia.com/v1"
    assert cfg.provider == "nvidia"
    assert cfg.extra_headers == {}  # pas de X-Title pour NVIDIA


# ── call_openai_compatible ──────────────────────────────────────────────────

def _ok_response(text: str) -> MagicMock:
    resp = MagicMock()
    resp.ok = True
    resp.json.return_value = {"choices": [{"message": {"content": text}}]}
    return resp


def _err_response(status: int, body: str = "boom") -> MagicMock:
    resp = MagicMock()
    resp.ok = False
    resp.status_code = status
    resp.text = body
    return resp


def test_call_uses_chat_completions_endpoint():
    with patch("ai_categorizer.requests.post", return_value=_ok_response("Courses")) as post:
        out = call_openai_compatible(CFG, "sys", "user")
    assert out == "Courses"
    url = post.call_args.args[0]
    assert url.endswith("/chat/completions")
    headers = post.call_args.kwargs["headers"]
    assert headers["Authorization"] == "Bearer sk-test"
    body = post.call_args.kwargs["json"]
    assert body["model"] == "gpt-4o-mini"
    assert body["temperature"] == 0
    assert body["messages"][0]["role"] == "system"


def test_call_forwards_openrouter_extra_headers():
    cfg = AIConfig(
        api_key="sk", base_url="https://openrouter.ai/api/v1",
        model="m", provider="openrouter",
        extra_headers={"X-Title": "Suivi Budget", "HTTP-Referer": "http://x"},
    )
    with patch("ai_categorizer.requests.post", return_value=_ok_response("X")) as post:
        call_openai_compatible(cfg, "s", "u")
    headers = post.call_args.kwargs["headers"]
    assert headers["X-Title"] == "Suivi Budget"
    assert headers["HTTP-Referer"] == "http://x"


def test_call_raises_on_http_error():
    with patch("ai_categorizer.requests.post", return_value=_err_response(429, "rate")):
        with pytest.raises(RuntimeError, match="LLM HTTP 429"):
            call_openai_compatible(CFG, "s", "u")


def test_call_raises_on_empty_content():
    resp = MagicMock(); resp.ok = True
    resp.json.return_value = {"choices": [{"message": {"content": ""}}]}
    with patch("ai_categorizer.requests.post", return_value=resp):
        with pytest.raises(RuntimeError, match="vide"):
            call_openai_compatible(CFG, "s", "u")


# ── suggest_category (orchestrateur) ────────────────────────────────────────

def test_suggest_returns_none_without_config(monkeypatch):
    monkeypatch.delenv("AI_API_KEY", raising=False)
    with patch("ai_categorizer.requests.post") as post:
        out = suggest_category(_tx(libelle="CARREFOUR EXPRESS"), HISTORY)
    assert out is None
    post.assert_not_called()


def test_suggest_returns_none_when_no_relevant_example():
    with patch("ai_categorizer.requests.post") as post:
        out = suggest_category(_tx(libelle="ZUT INCONNU"), HISTORY, config=CFG)
    assert out is None
    post.assert_not_called()


def test_suggest_returns_validated_category():
    with patch("ai_categorizer.requests.post", return_value=_ok_response("Courses")):
        out = suggest_category(_tx(libelle="CARREFOUR EXPRESS"), HISTORY, config=CFG, min_confidence=0)
    assert out is not None
    assert out["categorie"] == "Courses"
    assert out["confidence"] > 0
    assert out["examples"]


def test_suggest_rejects_answer_outside_vocabulary():
    with patch("ai_categorizer.requests.post", return_value=_ok_response("Voyages")):
        out = suggest_category(_tx(libelle="CARREFOUR EXPRESS"), HISTORY, config=CFG)
    assert out is None


def test_suggest_returns_none_below_min_confidence():
    # Avec une seule catégorie dans l'historique, la confiance est 95 → on monte
    # le seuil au-dessus pour vérifier le gate.
    with patch("ai_categorizer.requests.post", return_value=_ok_response("Courses")):
        out = suggest_category(
            _tx(libelle="CARREFOUR EXPRESS"), HISTORY, config=CFG, min_confidence=99
        )
    assert out is None


def test_suggest_returns_none_on_llm_failure_without_raising():
    with patch("ai_categorizer.requests.post", return_value=_err_response(500)):
        out = suggest_category(_tx(libelle="CARREFOUR EXPRESS"), HISTORY, config=CFG)
    assert out is None  # log warning + skip, ne casse pas l'import


# ── is_likely_recurrence ────────────────────────────────────────────────────

from ai_categorizer import categorize_batch, is_likely_recurrence  # noqa: E402

RECURRENCES = [
    {"label": "Netflix", "expectedAmount": -13.99, "active": True},
    {"label": "Abo Salle Sport", "expectedAmount": -29.90, "active": True},
    {"label": "Désactivée", "expectedAmount": -10.00, "active": False},
]


def test_recurrence_match_label_substring_and_amount():
    assert is_likely_recurrence(_tx(libelle="NETFLIX.COM", montant=-13.99), RECURRENCES) is True


def test_recurrence_match_tolerates_25pct_amount_drift():
    # 13.99 * 1.2 = 16.79 → dans la tolérance
    assert is_likely_recurrence(_tx(libelle="NETFLIX", montant=-16.50), RECURRENCES) is True


def test_recurrence_no_match_when_amount_too_far():
    # 50 vs 13.99 → bien hors tolérance
    assert is_likely_recurrence(_tx(libelle="NETFLIX", montant=-50), RECURRENCES) is False


def test_recurrence_no_match_when_label_unrelated():
    assert is_likely_recurrence(_tx(libelle="BOULANGERIE", montant=-13.99), RECURRENCES) is False


def test_recurrence_ignores_inactive_records():
    assert is_likely_recurrence(_tx(libelle="DESACTIVEE", montant=-10), RECURRENCES) is False


# ── categorize_batch ────────────────────────────────────────────────────────

# Corpus catégorisé pour les tests batch — pour atteindre une confiance lexicale
# >= 85 (seuil par défaut du fast-path), on répète exactement le même libellé.
LEX_HISTORY = (
    [_tx(libelle="CARREFOUR EXPRESS", categorie="Courses") for _ in range(4)]
    + [_tx(libelle="CARREFOUR MARKET", categorie="Courses")]
    + [_tx(libelle="CARREFOUR CITY", categorie="Courses")]
)


def test_batch_no_llm_call_when_no_config_but_lexical_still_runs(monkeypatch):
    """Sans clé IA, le fast-path lexical reste actif (gratuit, hors-ligne)."""
    monkeypatch.delenv("AI_API_KEY", raising=False)
    txs = [_tx(libelle="CARREFOUR EXPRESS", categorie="")]
    with patch("ai_categorizer.requests.post") as post:
        out = categorize_batch(txs, LEX_HISTORY, RECURRENCES)
    post.assert_not_called()
    # Le libellé existe à l'identique dans le corpus → fast-path doit catégoriser
    assert out["lexical"] >= 1
    assert txs[0]["ai_method"] == "lexical"


def test_batch_skips_already_categorized():
    txs = [_tx(libelle="CARREFOUR", categorie="Restaurant")]
    with patch("ai_categorizer.requests.post") as post:
        out = categorize_batch(txs, LEX_HISTORY, RECURRENCES, config=CFG)
    assert out["total"] == 0
    assert txs[0]["categorie"] == "Restaurant"
    post.assert_not_called()


def test_batch_skips_recurrences():
    txs = [_tx(libelle="NETFLIX", montant=-13.99, categorie="")]
    with patch("ai_categorizer.requests.post") as post:
        out = categorize_batch(txs, LEX_HISTORY, RECURRENCES, config=CFG)
    assert out["total"] == 0
    post.assert_not_called()


def test_batch_lexical_fast_path_avoids_llm_call():
    """Quand le lexical est très confiant, le LLM n'est PAS appelé (coût évité)."""
    txs = [_tx(libelle="CARREFOUR EXPRESS", categorie="")]
    with patch("ai_categorizer.requests.post") as post:
        out = categorize_batch(txs, LEX_HISTORY, RECURRENCES, config=CFG)
    post.assert_not_called()
    assert out["lexical"] == 1
    assert out["rag"] == 0
    assert txs[0]["categorie"] == "Courses"
    assert txs[0]["ai_method"] == "lexical"
    assert txs[0]["ai_confidence"] >= 85


def test_batch_falls_back_to_rag_when_lexical_confidence_too_low():
    """Une occurrence ancienne sans compte → exact-match confidence=62 < 85 →
    fast-path déclenche le fallback RAG. Le LLM valide la catégorie."""
    weak_history = [_tx(libelle="MONOPRIX RIVOLI 75001", categorie="Courses",
                         date="2023-01-01", compte="")]
    txs = [_tx(libelle="MONOPRIX RIVOLI 75001", categorie="", compte="")]
    with patch("ai_categorizer.requests.post", return_value=_ok_response("Courses")) as post:
        out = categorize_batch(txs, weak_history, RECURRENCES,
                                config=CFG, min_confidence=0)
    post.assert_called_once()
    assert out["lexical"] == 0
    assert out["rag"] == 1
    assert txs[0]["ai_method"] == "rag"


def test_batch_mixed_pipeline_lexical_and_rag_combined():
    """Un batch mixte : un libellé sur-représenté (lexical), un faible (RAG)."""
    mixed_history = LEX_HISTORY + [
        _tx(libelle="MONOPRIX RIVOLI 75001", categorie="Courses",
             date="2023-01-01", compte=""),
    ]
    txs = [
        _tx(libelle="CARREFOUR EXPRESS", categorie=""),                   # lexical hit
        _tx(libelle="MONOPRIX RIVOLI 75001", categorie="", compte=""),   # RAG (lex=62)
        _tx(libelle="NETFLIX", montant=-13.99, categorie=""),             # skipped recurrence
        _tx(libelle="DEJA", categorie="Courses"),                          # skipped already-cat
    ]
    with patch("ai_categorizer.requests.post", return_value=_ok_response("Courses")) as post:
        out = categorize_batch(txs, mixed_history, RECURRENCES,
                                config=CFG, min_confidence=0)
    # Un seul appel LLM (pour la tx ambiguë) — le fast-path en a évité un
    assert post.call_count == 1
    assert out["lexical"] == 1
    assert out["rag"] == 1
    assert out["eligible"] == 2  # netflix et déjà-cat exclus
    assert txs[0]["ai_method"] == "lexical"
    assert txs[1]["ai_method"] == "rag"
    assert "ai_categorized" not in txs[2]
    assert "ai_categorized" not in txs[3]
