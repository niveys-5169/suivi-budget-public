"""Create a runtime secret once; metadata failures never authorize rotation."""

import argparse
import base64
import json
import os
import re
import subprocess


def bootstrap_secret(name, project, value, *, run=subprocess.run):
    """Preserve existing versions and fail closed on an unusable latest version."""
    metadata = run(
        ["gcloud", "secrets", "describe", name, "--project", project, "--format=json"],
        capture_output=True,
        text=True,
        timeout=60,
    )
    if metadata.returncode:
        missing = re.search(r"(?:^|\)\s+)NOT_FOUND:", metadata.stderr)
        if not missing:
            error_code = re.search(r"\b(PERMISSION_DENIED|UNAUTHENTICATED):", metadata.stderr)
            code = error_code.group(1) if error_code else "UNKNOWN"
            raise RuntimeError(f"Secret {name}: metadata probe failed ({code}).")
        if not value:
            raise RuntimeError(f"Secret {name}: bootstrap value is missing.")
        created = run(
            [
                "firebase", "functions:secrets:set", name, "--data-file=-",
                "--project", project, "--non-interactive",
            ],
            input=value,
            capture_output=True,
            timeout=60,
        )
        if created.returncode:
            raise RuntimeError(f"Secret {name}: creation failed; check deployment IAM.")
        print(f"Secret {name}: created initial version.")
        return

    versions = run(
        [
            "gcloud", "secrets", "versions", "list", name,
            "--project", project, "--sort-by=~createTime", "--limit=1", "--format=json",
        ],
        capture_output=True,
        text=True,
        timeout=60,
    )
    if versions.returncode:
        raise RuntimeError(f"Secret {name}: version probe failed; deployment stopped.")
    latest = json.loads(versions.stdout)
    if not latest or latest[0].get("state") != "ENABLED":
        raise RuntimeError(f"Secret {name}: no enabled version at latest; rotate explicitly.")
    print(f"Secret {name}: existing enabled version preserved.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("name")
    parser.add_argument("--project", required=True)
    parser.add_argument("--source-env", required=True)
    parser.add_argument("--base64", action="store_true")
    args = parser.parse_args()
    value = os.environ.get(args.source_env, "").encode("utf-8")
    if args.base64 and value:
        value = base64.b64encode(value)
    try:
        bootstrap_secret(args.name, args.project, value)
    except (RuntimeError, ValueError, subprocess.SubprocessError, OSError) as error:
        parser.exit(1, f"{error}\n")


if __name__ == "__main__":
    main()
