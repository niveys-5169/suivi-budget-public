"""Deployment-contract tests for sensitive Cloud Functions configuration."""

import base64
import json
from pathlib import Path
from unittest.mock import MagicMock

import pytest


@pytest.fixture
def main_module(functions_import_path):
    """Import the deployed Functions entrypoint with its real decorators."""
    with functions_import_path():
        import main

    return main


def _bound_secret_names(function) -> set[str]:
    endpoint = function.__firebase_endpoint__
    return {secret["key"] for secret in endpoint.secretEnvironmentVariables}


@pytest.mark.parametrize(
    ("function_name", "expected_secrets"),
    [
        ("import_linxo_transactions", {"GMAIL_TOKEN"}),
        ("dispatch_github_workflow", {"GITHUB_DISPATCH_TOKEN"}),
        ("gmail_watch_handler", {"GMAIL_TOKEN"}),
        ("setup_gmail_watch", {"GMAIL_TOKEN"}),
        ("renew_gmail_watch", {"GMAIL_TOKEN"}),
        ("sync_banking", {"EB_APP_ID", "EB_PRIVATE_KEY", "GMAIL_TOKEN"}),
        ("scheduled_banking_sync", {"EB_APP_ID", "EB_PRIVATE_KEY", "GMAIL_TOKEN"}),
    ],
)
def test_each_consumer_is_bound_only_to_its_required_secrets(
    main_module, function_name, expected_secrets
):
    function = getattr(main_module, function_name)

    assert _bound_secret_names(function) == expected_secrets


def test_gmail_client_is_built_from_the_bound_secret(main_module, mocker):
    token_info = {"client_id": "client-id", "refresh_token": "refresh-token"}
    encoded_token = base64.b64encode(json.dumps(token_info).encode()).decode()
    mocker.patch.object(
        main_module,
        "GMAIL_TOKEN_SECRET",
        MagicMock(value=encoded_token),
    )
    credentials = MagicMock()
    from_authorized_user_info = mocker.patch.object(
        main_module.Credentials,
        "from_authorized_user_info",
        return_value=credentials,
    )
    gmail_client = mocker.patch.object(main_module, "GmailClient")

    main_module._build_gmail_client()

    from_authorized_user_info.assert_called_once_with(token_info)
    gmail_client.assert_called_once_with(credentials)


def test_gmail_client_fails_closed_when_bound_secret_is_empty(main_module, mocker):
    mocker.patch.object(
        main_module,
        "GMAIL_TOKEN_SECRET",
        MagicMock(value=""),
    )

    with pytest.raises(ValueError, match="GMAIL_TOKEN"):
        main_module._build_gmail_client()


def test_deploy_stores_sensitive_tokens_in_secret_manager_not_dotenv():
    workflow_path = (
        Path(__file__).parents[1] / ".github" / "workflows" / "deploy-functions.yml"
    )
    workflow = workflow_path.read_text(encoding="utf-8")

    assert "- '.github/workflows/deploy-functions.yml'" in workflow
    assert "bootstrap_runtime_secret.py GMAIL_TOKEN" in workflow
    assert "--source-env GOOGLE_TOKEN --base64" in workflow
    assert "bootstrap_runtime_secret.py GITHUB_DISPATCH_TOKEN" in workflow

    dotenv_writes = [
        line
        for line in workflow.splitlines()
        if "functions/.env.suivi-budget-ab888" in line
    ]
    assert all("GMAIL_TOKEN" not in line for line in dotenv_writes)
    assert all("GITHUB_DISPATCH_TOKEN" not in line for line in dotenv_writes)


def test_enable_banking_deploy_preserves_existing_secret_versions():
    workflow_path = (
        Path(__file__).parents[1] / ".github" / "workflows" / "deploy-functions.yml"
    )
    workflow = workflow_path.read_text(encoding="utf-8")

    for name in ("EB_APP_ID", "EB_PRIVATE_KEY"):
        assert f"bootstrap_runtime_secret.py {name} --project" in workflow
        assert f"--source-env {name}" in workflow
        assert f"firebase functions:secrets:set {name}" not in workflow
