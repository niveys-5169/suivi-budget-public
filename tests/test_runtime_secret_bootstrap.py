"""Tests for the fail-closed Secret Manager bootstrap helper."""

import importlib.util
from pathlib import Path
from subprocess import CompletedProcess

import pytest


@pytest.fixture
def bootstrap_module():
    script = (
        Path(__file__).parents[1]
        / ".github"
        / "scripts"
        / "bootstrap_runtime_secret.py"
    )
    spec = importlib.util.spec_from_file_location("bootstrap_runtime_secret", script)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_existing_enabled_version_is_preserved(bootstrap_module):
    calls = []

    def run(command, **kwargs):
        calls.append(command)
        if command[2] == "describe":
            return CompletedProcess(command, 0, stdout="projects/p/secrets/TOKEN\n", stderr="")
        return CompletedProcess(command, 0, stdout='[{"state": "ENABLED"}]', stderr="")

    bootstrap_module.bootstrap_secret("TOKEN", "project", b"new-value", run=run)

    assert all("functions:secrets:set" not in command for command in calls)


def test_not_found_bootstraps_secret(bootstrap_module):
    calls = []

    def run(command, **kwargs):
        calls.append((command, kwargs))
        if command[0] == "gcloud":
            return CompletedProcess(
                command, 1, stdout="",
                stderr="ERROR: (gcloud.secrets.describe) NOT_FOUND: secret TOKEN",
            )
        return CompletedProcess(command, 0, stdout="[]", stderr="")

    bootstrap_module.bootstrap_secret("TOKEN", "project", b"new-value", run=run)

    firebase_call = calls[-1]
    assert firebase_call[0][:3] == ["firebase", "functions:secrets:set", "TOKEN"]
    assert firebase_call[1]["input"] == b"new-value"


def test_probe_error_fails_without_creating_version(bootstrap_module):
    calls = []

    def run(command, **kwargs):
        calls.append(command)
        return CompletedProcess(command, 1, stdout="", stderr="PERMISSION_DENIED: access refused")

    with pytest.raises(RuntimeError, match="PERMISSION_DENIED"):
        bootstrap_module.bootstrap_secret("TOKEN", "project", b"new-value", run=run)

    assert all("functions:secrets:set" not in command for command in calls)


def test_version_probe_error_fails_without_creating_version(bootstrap_module):
    calls = []

    def run(command, **kwargs):
        calls.append(command)
        if command[2] == "describe":
            return CompletedProcess(command, 0, stdout="{}", stderr="")
        return CompletedProcess(command, 1, stdout="", stderr="network failure")

    with pytest.raises(RuntimeError, match="version probe failed"):
        bootstrap_module.bootstrap_secret("TOKEN", "project", b"value", run=run)

    assert len(calls) == 2
    assert all("functions:secrets:set" not in command for command in calls)


def test_existing_secret_without_enabled_version_fails_closed(bootstrap_module):
    calls = []

    def run(command, **kwargs):
        calls.append(command)
        if command[2] == "describe":
            return CompletedProcess(command, 0, stdout="projects/p/secrets/TOKEN\n", stderr="")
        return CompletedProcess(command, 0, stdout="[]", stderr="")

    with pytest.raises(RuntimeError, match="no enabled version"):
        bootstrap_module.bootstrap_secret("TOKEN", "project", b"new-value", run=run)

    assert all("functions:secrets:set" not in command for command in calls)
