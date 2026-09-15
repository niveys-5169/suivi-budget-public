"""Regression tests for the trusted-origin gate on imported email."""

from gmail_client import GmailClient


LINXO_SENDER = "assistance@linxo.com"


def _message(*headers):
    return {"headers": [{"name": name, "value": value} for name, value in headers]}


def _authenticated_message():
    return _message(
        ("From", "Linxo <assistance@linxo.com>"),
        (
            "Authentication-Results",
            "mx.google.com; dmarc=pass (p=REJECT) header.from=linxo.com",
        ),
    )


def test_authenticated_linxo_message_is_accepted():
    assert GmailClient.is_authenticated_sender(_authenticated_message(), LINXO_SENDER)


def test_forged_from_header_is_rejected_even_with_dmarc_result():
    forged = _message(
        ("From", "Linxo <assistance@linxo.com>"),
        (
            "Authentication-Results",
            "mx.google.com; dmarc=pass (p=REJECT) header.from=attacker.example",
        ),
    )

    assert not GmailClient.is_authenticated_sender(forged, LINXO_SENDER)


def test_ambiguous_authentication_results_are_rejected():
    ambiguous = _message(
        ("From", "Linxo <assistance@linxo.com>"),
        (
            "Authentication-Results",
            "mx.google.com; dmarc=pass (p=REJECT) header.from=linxo.com",
        ),
        (
            "Authentication-Results",
            "attacker.example; dmarc=pass header.from=linxo.com",
        ),
    )

    assert not GmailClient.is_authenticated_sender(ambiguous, LINXO_SENDER)
