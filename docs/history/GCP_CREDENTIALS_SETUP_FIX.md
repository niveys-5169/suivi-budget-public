# GCP Credentials Setup Fix - Eventarc Firestore Triggers

## Problem

Firebase Cloud Functions deployment fails when creating the `trigger_balance_reconciliation` Firestore trigger:

```
Permission denied while using the Eventarc Service Agent
```

## Root Cause

The Eventarc infrastructure (which powers Firestore event triggers) requires proper IAM role configuration:

1. The **Eventarc Service Agent** (`service-{PROJECT_NUMBER}@gcp-sa-eventarc.iam.gserviceaccount.com`) needs roles to manage Pub/Sub topics and access Firestore
2. The **deployment service account** needs the ability to create Eventarc resources

## Solution Implemented

The GitHub Actions workflow now includes two additional steps:

### Step 1: Grant Eventarc Service Agent Permissions

```bash
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${EVENTARC_SA}" \
  --role="roles/eventarc.serviceAgent"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${EVENTARC_SA}" \
  --role="roles/pubsub.editor"
```

### Step 2: Grant Deployment Service Account Permissions

```bash
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/eventarc.admin"
```

## Troubleshooting

### If gcloud commands fail with "Permission denied"

The deployment service account may lack IAM administration permissions. Verify in GCP Console:

1. Go to IAM & Admin → Service Accounts
2. Find the service account used in `FIREBASE_CREDENTIALS` secret
3. Ensure it has one of:
   - `roles/owner` (broad, not recommended for production)
   - `roles/iam.securityAdmin` (recommended)
   - `roles/editor` (or similar with `iam.serviceAccounts.setIamPolicy`)

### If error persists after re-deployment

1. Check GCP Console → Cloud Functions → trigger_balance_reconciliation
2. Verify the Eventarc trigger is created and connected properly
3. Check Cloud Monitoring logs for more detailed error messages
4. May need to wait a few minutes for IAM changes to propagate across GCP services

## Firestore Trigger Configuration

The `trigger_balance_reconciliation` function is configured as:

```python
@firestore_fn.on_document_written(
  document="proposed_account_balances/{docId}",
  region="europe-west1"
)
```

This automatically creates an Eventarc trigger that watches the Firestore collection and invokes the function on document changes.

## References

- [Firebase Cloud Functions - Firestore Triggers](https://firebase.google.com/docs/functions/firestore-events)
- [Eventarc IAM Roles](https://cloud.google.com/eventarc/docs/access-control#service-agent-role)
- [GCP Service Agent Documentation](https://cloud.google.com/iam/docs/service-account-understanding)
