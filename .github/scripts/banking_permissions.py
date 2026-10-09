"""Read-only audit of project permissions; never print credentials or tokens."""
import json
import os

from google.auth.transport.requests import AuthorizedSession
from google.oauth2.service_account import Credentials

GROUPS = {
    "firebase_rules": ["firebaserules.rulesets.test", "firebaserules.rulesets.create",
                       "firebaserules.releases.get", "firebaserules.releases.create",
                       "firebaserules.releases.update"],
    "firestore_indexes": ["datastore.indexes.list", "datastore.indexes.create",
                          "datastore.indexes.update", "datastore.indexes.delete"],
    "scheduled_import": ["cloudscheduler.jobs.get", "cloudscheduler.jobs.create",
                         "cloudscheduler.jobs.update"],
    "functions": ["cloudfunctions.functions.get", "cloudfunctions.functions.list",
                  "cloudfunctions.functions.create", "cloudfunctions.functions.update"],
    "runtime_invocation": ["run.services.get", "run.services.setIamPolicy"],
}


def main():
    credentials = Credentials.from_service_account_info(
        json.loads(os.environ["FIREBASE_CREDENTIALS"]),
        scopes=["https://www.googleapis.com/auth/cloud-platform"])
    session = AuthorizedSession(credentials)
    response = session.post(
        "https://cloudresourcemanager.googleapis.com/v1/projects/suivi-budget-ab888:testIamPermissions",
        json={"permissions": [p for group in GROUPS.values() for p in group]}, timeout=30)
    if not response.ok:
        print(json.dumps({"auditHttpStatus": response.status_code}))
        return 1
    granted = set(response.json().get("permissions", []))
    report = {group: {"missingAtProjectLevel": [p for p in permissions if p not in granted]}
              for group, permissions in GROUPS.items()}
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
