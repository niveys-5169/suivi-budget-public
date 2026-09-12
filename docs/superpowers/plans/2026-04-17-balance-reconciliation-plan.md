# Perennial Balance Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a robust system for accurately importing and reconciling account balances, ensuring all data reflects the true account state.

**Architecture:** The solution involves enhancing Firestore data models, establishing a standardized balance import process from various sources (EB API, email, manual), implementing automated cross-validation with source prioritization and discrepancy detection, and providing a user interface for managing and resolving identified discrepancies. All actions are meticulously logged in an immutable audit trail.

**Tech Stack:** Firebase (Firestore, Cloud Functions), Python (for backend imports), JavaScript/TypeScript (for frontend and Cloud Functions), React (for UI components).

---

### Task 1: Update Firestore Security Rules

This task involves updating the Firestore security rules to accommodate the new data model fields and collections (`proposed_account_balances`, and the updated fields within `account_balances`, `savings_balances`, and `account_balance_history`). This needs to be done first to ensure the new data structures can be read and written correctly by Cloud Functions and the frontend.

**Files:**

- Modify: `firestore.rules`

- [ ] **Step 1: Add rules for `proposed_account_balances` collection**
  - Allow only Cloud Functions to `create`, `read`, `update`, `delete` documents in this collection.
  - This collection will serve as a staging area and should not be directly accessible by frontend users.

- [ ] **Step 2: Update rules for `account_balances` and `savings_balances` collections**
  - Allow Cloud Functions to `update` documents, especially for the new `current_balance`, `source`, `source_timestamp`, `last_reconciled_date`, `status`, and `discrepancies` fields.
  - Ensure existing read/write rules for users (if any) are compatible or adjusted for the new fields.
  - Specifically, `discrepancies` array should only be modifiable by Cloud Functions or specific user roles during a reconciliation process.

- [ ] **Step 3: Add rules for `account_balance_history` collection**
  - Allow only Cloud Functions to `create` documents in this collection (entries are immutable once created).
  - Allow users to `read` documents in this collection for auditing purposes.

- [ ] **Step 4: Commit**

```bash
git add firestore.rules
git commit -m "feat: Update Firestore security rules for balance reconciliation data model"
```

### Task 2: Implement Data Model Enhancements in Frontend Types/Interfaces

This task involves updating the TypeScript interfaces and types in the frontend to reflect the new data model for `AccountBalance`, `SavingsBalance`, and potentially a new type for `Discrepancy`. This is crucial for type safety and ensuring the frontend components correctly interpret the new data structure.

**Files:**

- Modify: `public/src/hooks/useBalances.tsx`
- Modify: `public/src/hooks/usePatrimoine.tsx`
- Create: `public/src/types/balances.ts` (for common balance types and discrepancy interface)

- [ ] **Step 1: Create `public/src/types/balances.ts`**
  - Define `Discrepancy` interface.
  - Define `ProposedBalance` interface.
  - Define `AccountBalance` and `SavingsBalance` interfaces that extend existing ones and include the new fields (`source`, `source_timestamp`, `current_balance`, `last_reconciled_date`, `status`, `discrepancies`).

```typescript
// public/src/types/balances.ts
import firebase from 'firebase/app'; // Adjust import based on your Firebase setup if needed

export interface Discrepancy {
  source_1: string;
  value_1: number;
  source_2: string;
  value_2: number;
  detected_on: firebase.firestore.Timestamp; // Or Date
  description: string;
  suggested_action: string;
  threshold_used: number;
  status: string; // e.g., "unresolved", "acknowledged"
  acknowledgements?: Array<{
    user_id: string;
    timestamp: firebase.firestore.Timestamp;
    reason?: string;
  }>;
}

export interface ProposedBalance {
  account_id: string;
  balance_value: number;
  balance_date: firebase.firestore.Timestamp;
  source: string;
  source_timestamp: firebase.firestore.Timestamp;
  raw_source_data: { [key: string]: any };
  owner?: string;
  processed_status?: string; // e.g., "pending_validation", "validated"
}

// Extend existing interfaces with new fields
// This will be used in useBalances.tsx and usePatrimoine.tsx
export interface AccountBalance {
  id: string;
  compte: string;
  current_balance: number; // New field, replaces 'solde'
  // ... other existing fields you want to retain (e.g., previousSolde, linxoDelta, computedSolde, emailDate, owner)
  source: string;
  source_timestamp: firebase.firestore.Timestamp;
  last_reconciled_date?: firebase.firestore.Timestamp;
  status: string; // e.g., "reconciled", "pending_review", "discrepancy_unresolved"
  discrepancies?: Discrepancy[];
}

export interface SavingsBalance {
  id: string;
  compte: string;
  current_balance: number; // New field, replaces 'solde'
  // ... other existing fields you want to retain
  source: string;
  source_timestamp: firebase.firestore.Timestamp;
  last_reconciled_date?: firebase.firestore.Timestamp;
  status: string; // e.g., "reconciled", "pending_review", "discrepancy_unresolved"
  discrepancies?: Discrepancy[];
}
```

- [ ] **Step 2: Update `public/src/hooks/useBalances.tsx`**
  - Import new `AccountBalance` interface.
  - Update `AccountBalance` interface to use `current_balance` instead of `solde` and include new reconciliation-related fields.
  - Adjust `setBalances` to map Firestore data to the new interface, providing default values for new fields if not present.

```typescript
// public/src/hooks/useBalances.tsx (partial update)
import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, getFirestore } from 'firebase/firestore'; // Assuming modular Firebase SDK
import { firebaseApp } from '../services/firebase'; // Adjust path as needed
import { AccountBalance } from '../types/balances'; // Import the new interface

const db = getFirestore(firebaseApp);

export const useBalances = () => {
  const [balances, setBalances] = useState<AccountBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const q = query(collection(db, 'account_balances'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const balancesData: AccountBalance[] = [];
        snap.forEach((doc) => {
          const data = doc.data();
          balancesData.push({
            id: doc.id,
            ...data,
            // Map 'solde' to 'current_balance' for initial compatibility
            current_balance: data.solde ?? 0, // Use existing 'solde' or default to 0
            // Set initial values for new fields, to be properly populated by Cloud Functions later
            source: data.source || 'legacy',
            source_timestamp: data.source_timestamp || firebase.firestore.Timestamp.now(),
            last_reconciled_date: data.last_reconciled_date || firebase.firestore.Timestamp.now(),
            status: data.status || 'reconciled',
            discrepancies: data.discrepancies || [],
          } as AccountBalance);
        });
        console.log('>>> useBalances: received', balancesData.length, 'balances');
        setBalances(balancesData);
        setLoading(false);
      },
      (err) => {
        console.error('>>> useBalances: Firestore error:', err);
        setError(err);
        setLoading(false);
      },
    );
    return () => unsub();
  }, []); // Empty dependency array means this effect runs once on mount

  return { balances, loading, error };
};
```

- [ ] **Step 3: Update `public/src/hooks/usePatrimoine.tsx`**
  - Import new `SavingsBalance` interface.
  - Update `SavingsBalance` interface to use `current_balance` instead of `solde` and include new reconciliation-related fields.
  - Adjust `setSavingsBalances` to map Firestore data to the new interface, providing default values for new fields if not present.

```typescript
// public/src/hooks/usePatrimoine.tsx (partial update)
import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, getFirestore } from 'firebase/firestore'; // Assuming modular Firebase SDK
import { firebaseApp } from '../services/firebase'; // Adjust path as needed
import { SavingsBalance } from '../types/balances'; // Import the new interface
// ... other imports

const db = getFirestore(firebaseApp);

// ... existing interfaces like Placement, OwnerMapping ...

export const usePatrimoine = () => {
  const [patrimoine, setPatrimoine] = useState<any>({}); // Replace 'any' with specific type if available
  const [placements, setPlacements] = useState<any[]>([]); // Replace 'any[]'
  const [savingsBalances, setSavingsBalances] = useState<SavingsBalance[]>([]);
  const [ownerMapping, setOwnerMapping] = useState<any>({}); // Replace 'any'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubSavings = onSnapshot(
      collection(db, 'savings_balances'),
      (snap) => {
        setSavingsBalances(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              ...data,
              current_balance: data.solde ?? 0, // Use existing 'solde' or default to 0
              source: data.source || 'legacy',
              source_timestamp: data.source_timestamp || firebase.firestore.Timestamp.now(),
              last_reconciled_date: data.last_reconciled_date || firebase.firestore.Timestamp.now(),
              status: data.status || 'reconciled',
              discrepancies: data.discrepancies || [],
            } as SavingsBalance;
          }),
        );
        // ... potentially other state updates ...
        setLoading(false);
      },
      (err) => {
        console.error('>>> usePatrimoine: Firestore savings_balances error:', err);
        setError(err);
        setLoading(false);
      },
    );

    // ... other onSnapshot listeners for placements, owner mapping ...

    return () => {
      unsubSavings();
      // ... return other unsubscribe functions ...
    };
  }, []); // Empty dependency array

  return { patrimoine, loading, error, placements, savingsBalances, ownerMapping };
};
```

- [ ] **Step 4: Commit**

```bash
git add public/src/hooks/useBalances.tsx public/src/hooks/usePatrimoine.tsx public/src/types/balances.ts
git commit -m "feat: Implement frontend types for enhanced balance data model"
```

### Task 3: Develop Cloud Function for Standardized Balance Ingestion

This task involves creating a new Cloud Function or modifying an existing one to handle the ingestion of `ProposedBalance` data into the `proposed_account_balances` collection. This function will be called by various import triggers (EB API, email parsing).

**Files:**

- Create: `functions/src/balance_ingestion.py`
- Modify: `functions/main.py` (to expose the new function)
- Modify: `functions/requirements.txt` (if new dependencies are needed)

- [ ] **Step 1: Create `functions/src/balance_ingestion.py`**
  - Define a function `ingest_proposed_balance(data)` that:
    - Validates incoming `data` against the `ProposedBalance` schema.
    - Adds a `processed_status: "pending_validation"` field.
    - Writes the validated data to the `proposed_account_balances` collection in Firestore.
    - Logs an entry to `account_balance_history` with `event_type: "imported_{source}"`.
    - Returns a success/failure status.

```python
# functions/src/balance_ingestion.py

import functions_framework
from google.cloud import firestore
from datetime import datetime

db = firestore.Client()

@functions_framework.http
def ingest_proposed_balance(request):
    """
    Cloud Function to ingest a proposed balance into the staging area.
    Expected request body:
    {
        "account_id": "...",
        "balance_value": 123.45,
        "balance_date": "YYYY-MM-DDTHH:MM:SSZ", // ISO format
        "source": "eb_api", // or "email_parser", "manual_entry"
        "source_timestamp": "YYYY-MM-DDTHH:MM:SSZ", // ISO format
        "raw_source_data": {...},
        "owner": "..." // optional
    }
    """
    request_json = request.get_json(silent=True)
    if not request_json:
        return {'status': 'error', 'message': 'Invalid JSON'}, 400

    required_fields = ['account_id', 'balance_value', 'balance_date', 'source', 'source_timestamp', 'raw_source_data']
    if not all(field in request_json for field in required_fields):
        return {'status': 'error', 'message': f'Missing required fields: {", ".join(required_fields)}'}, 400

    try:
        # Convert ISO date strings to datetime objects for Firestore
        balance_date = datetime.fromisoformat(request_json['balance_date'].replace('Z', '+00:00'))
        source_timestamp = datetime.fromisoformat(request_json['source_timestamp'].replace('Z', '+00:00'))

        proposed_balance_doc = {
            'account_id': request_json['account_id'],
            'balance_value': float(request_json['balance_value']),
            'balance_date': balance_date,
            'source': request_json['source'],
            'source_timestamp': source_timestamp,
            'raw_source_data': request_json['raw_source_data'],
            'owner': request_json.get('owner'),
            'processed_status': 'pending_validation',
            'created_at': firestore.SERVER_TIMESTAMP,
        }

        # Add to proposed_account_balances collection
        doc_ref = db.collection('proposed_account_balances').add(proposed_balance_doc)

        # Log to account_balance_history
        history_doc = {
            'account_id': proposed_balance_doc['account_id'],
            'balance_value': proposed_balance_doc['balance_value'],
            'timestamp': firestore.SERVER_TIMESTAMP, # Use SERVER_TIMESTAMP for consistency
            'event_type': f"imported_{proposed_balance_doc['source']}",
            'source': proposed_balance_doc['source'],
            'source_data': proposed_balance_doc['raw_source_data'],
            'previous_balance': None, # No previous balance for initial import
            'discrepancy_details': None,
            'user_id': 'system' # System import
        }
        db.collection('account_balance_history').add(history_doc)


        return {'status': 'success', 'message': 'Proposed balance ingested', 'id': doc_ref.id}, 200

    except Exception as e:
        print(f"Error ingesting proposed balance: {e}")
        return {'status': 'error', 'message': str(e)}, 500

```

- [ ] **Step 2: Expose `ingest_proposed_balance` in `functions/main.py`**
  - Import the new function and register it as an HTTP endpoint.

```python
# functions/main.py (partial update)

import functions_framework
from src.balance_ingestion import ingest_proposed_balance
# ... existing imports ...

# ... existing functions ...

# Expose the new ingestion function
@functions_framework.http
def ingest_balance(request):
    return ingest_proposed_balance(request)

```

- [ ] **Step 3: Update `functions/requirements.txt` if needed**
  - Ensure `functions-framework` and `google-cloud-firestore` are present.

```
# functions/requirements.txt
functions-framework==3.*
google-cloud-firestore==2.*
# ... other existing requirements ...
```

- [ ] **Step 4: Commit**

```bash
git add functions/src/balance_ingestion.py functions/main.py functions/requirements.txt
git commit -m "feat: Implement Cloud Function for standardized balance ingestion"
```

### Task 4: Adapt EB API Importer to Use New Ingestion Function

This task involves modifying the existing `eb_importer.py` to call the new `ingest_balance` Cloud Function instead of directly writing to `account_balances`.

**Files:**

- Modify: `src/eb_importer.py`
- Create: `src/cloud_function_client.py` (to encapsulate Cloud Function calls)
- Modify: `functions/requirements.txt` (for new Python dependencies)

- [ ] **Step 1: Create `src/cloud_function_client.py`**
  - Define a helper function to make authenticated calls to Cloud Functions.

```python
# src/cloud_function_client.py

import requests
import os
import google.auth.transport.requests
import google.oauth2.id_token

# Base URL for the Cloud Functions, fetch from environment variable
# IMPORTANT: In a deployed environment, this should point to your deployed CF endpoint.
# For local testing, ensure your functions emulator is running and accessible.
CLOUD_FUNCTIONS_BASE_URL = os.environ.get('CLOUD_FUNCTIONS_BASE_URL', 'http://localhost:8080') # Default for local testing

def call_cloud_function(function_name: str, payload: dict) -> dict:
    """
    Makes an authenticated POST request to a Cloud Function.
    """
    url = f"{CLOUD_FUNCTIONS_BASE_URL}/{function_name}"

    # For local development, or if unauthenticated calls are allowed for testing
    if os.environ.get('FUNCTIONS_EMULATOR') == 'true' or CLOUD_FUNCTIONS_BASE_URL.startswith('http://localhost'):
        headers = {'Content-Type': 'application/json'}
        response = requests.post(url, json=payload, headers=headers)
    else:
        # Generate an ID token for authentication for deployed functions
        # This requires the service account running the importer to have
        # 'Service Account Token Creator' role on the Cloud Function's service account.
        auth_req = google.auth.transport.requests.Request()
        id_token = google.oauth2.id_token.fetch_id_token(auth_req, url)

        headers = {
            'Authorization': f'Bearer {id_token}',
            'Content-Type': 'application/json'
        }
        response = requests.post(url, json=payload, headers=headers)

    response.raise_for_status() # Raise an exception for HTTP errors
    return response.json()

```

- [ ] **Step 2: Modify `src/eb_importer.py` to call `ingest_balance` CF**
  - Import `call_cloud_function`.
  - Replace direct Firestore write logic for balances with a call to the new ingestion function.
  - Ensure the `datetime` objects are converted to ISO 8601 strings for the JSON payload.

```python
# src/eb_importer.py (partial update)

import os
from datetime import datetime
from src.enable_banking_client import EnableBankingClient
# from src.firebase_db import db # No longer directly writing to db for balances
from src.cloud_function_client import call_cloud_function
import functions_framework

# ... existing BALANCE_TYPES_PREFERES and _extraire_meilleur_solde ...

def import_eb_balances(client: EnableBankingClient, owner: str):
    print(f"Importing balances for owner: {owner}")
    accounts = client.get_accounts()

    for account in accounts:
        account_id = account.get("id")
        account_name = account.get("name")
        currency = account.get("currency")

        if account_id:
            try:
                balances_data = client.get_balances(account_id)
                solde = _extraire_meilleur_solde(balances_data)

                if solde is not None:
                    print(f"  Found balance for {account_name}: {solde} {currency}")

                    # Prepare payload for Cloud Function
                    # Using datetime.utcnow() and isoformat() for Firestore compatibility
                    current_utc = datetime.utcnow()
                    payload = {
                        'account_id': account_id,
                        'balance_value': solde,
                        'balance_date': current_utc.isoformat() + 'Z', # Current UTC time in ISO format
                        'source': 'eb_api',
                        'source_timestamp': current_utc.isoformat() + 'Z', # Current UTC time in ISO format
                        'raw_source_data': {
                            'account_name': account_name,
                            'currency': currency,
                            'full_balances_response': balances_data
                        },
                        'owner': owner
                    }

                    # Call the Cloud Function
                    response = call_cloud_function('ingest_balance', payload)
                    if response.get('status') == 'success':
                        print(f"  Successfully ingested balance for {account_name} via CF.")
                    else:
                        print(f"  Error ingesting balance for {account_name} via CF: {response.get('message')}")

                else:
                    print(f"  No preferred balance found for account {account_name}")
            except Exception as e:
                print(f"  Error getting balances for account {account_name} (ID: {account_id}): {e}")

# If this script is run directly, e.g., in a Cloud Function
@functions_framework.http
def eb_import_balances_http(request):
    """
    HTTP Cloud Function to trigger EB balance import.
    This function should be secured as it can trigger external API calls.
    """
    owner_id = request.args.get('owner', os.environ.get('DEFAULT_EB_OWNER_ID', 'default_owner_id'))

    # In a real application, you'd retrieve client credentials based on owner_id
    # For now, let's assume EnableBankingClient can be initialized with a dummy user_id or fetches credentials
    client = EnableBankingClient(user_id=owner_id)

    import_eb_balances(client, owner_id)
    return 'EB Balances import initiated.', 200

```

- [ ] **Step 3: Update `functions/requirements.txt` for new dependency**
  - Add `requests`, `google-auth-transport-requests`, `google-oauthlib`, `google-auth`.

```
# functions/requirements.txt
functions-framework==3.*
google-cloud-firestore==2.*
requests==2.*
google-auth-httplib2==0.* # Or google-auth-oauthlib if you prefer
google-auth==2.*
google-oauthlib==0.* # Needed for fetch_id_token
# ... other existing requirements ...
```

- [ ] **Step 4: Commit**

```bash
git add src/eb_importer.py src/cloud_function_client.py functions/requirements.txt
git commit -m "feat: Adapt EB API importer to use new ingestion Cloud Function"
```

### Task 5: Develop Cloud Function for Automated Cross-Validation and Reconciliation

This task involves creating a new Cloud Function `run_balance_cross_validation` that will process the `proposed_account_balances`, perform source prioritization, detect discrepancies, and update the `account_balances` collection.

**Files:**

- Create: `functions/src/balance_reconciliation.py`
- Modify: `functions/main.py` (to expose the new function)

- [ ] **Step 1: Create `functions/src/balance_reconciliation.py`**
  - Define a function `run_balance_cross_validation` that:
    - Retrieves `proposed_account_balances` entries.
    - Groups them by `account_id` and `balance_date`.
    - Applies a configurable `SOURCE_PRIORITY` list.
    - Calculates `primary_source_balance`.
    - Detects discrepancies based on `DISCREPANCY_THRESHOLD`.
    - Updates `account_balances` documents as per design (reconciled or pending_review).
    - Logs events to `account_balance_history`.
    - Marks `proposed_account_balances` entries as processed.

```python
# functions/src/balance_reconciliation.py

import functions_framework
from google.cloud import firestore
from datetime import datetime
from collections import defaultdict
import os

db = firestore.Client()

# Configuration (can be externalized to Firestore config document or environment variables)
# Example: ['eb_api', 'manual_entry', 'email_parser']
SOURCE_PRIORITY = os.environ.get('BALANCE_SOURCE_PRIORITY', 'eb_api,manual_entry,email_parser').split(',')
DISCREPANCY_THRESHOLD = float(os.environ.get('BALANCE_DISCREPANCY_THRESHOLD', 0.01))

@functions_framework.cloud_event
def run_balance_cross_validation(cloud_event):
    """
    Cloud Function to perform automated cross-validation and reconciliation.
    Triggered by new documents in 'proposed_account_balances'.
    """
    print(f"Triggered by event ID: {cloud_event['id']}")
    print(f"Event data: {cloud_event.data}")

    # For now, we'll process all pending items, not just the one that triggered it
    # This approach ensures all pending balances are processed in a single run,
    # which can be efficient but might be too broad for very high volume.
    # A more granular approach would process only balances related to the triggering event.

    try:
        # 1. Fetch all pending proposed balances
        # It's crucial to use a transaction or batch write for atomicity if processing
        # a large number of documents or if consistency is paramount.
        proposed_balances_query = db.collection('proposed_account_balances').where('processed_status', '==', 'pending_validation').stream()

        proposed_balances_map = defaultdict(lambda: defaultdict(list))
        proposed_balance_docs_to_update = [] # To mark as validated later

        for doc in proposed_balances_query:
            data = doc.to_dict()
            account_id = data['account_id']
            # Normalize balance_date to just date for grouping, ignore time for now
            # Assuming balance_date is a Firestore Timestamp or Python datetime
            if isinstance(data['balance_date'], datetime):
                balance_date_str = data['balance_date'].strftime('%Y-%m-%d')
            else: # Assume Firestore Timestamp object
                balance_date_str = data['balance_date'].to_datetime().strftime('%Y-%m-%d')

            proposed_balances_map[account_id][balance_date_str].append(data)
            proposed_balance_docs_to_update.append({'ref': doc.reference}) # Store ref for batch update

        if not proposed_balances_map:
            print("No pending proposed balances to process.")
            return 'No pending proposed balances.', 200

        for account_id, dates_data in proposed_balances_map.items():
            for balance_date_str, balances_list in dates_data.items():
                print(f"Processing account {account_id} for date {balance_date_str}")

                # 2. Source Prioritization and Selection
                primary_source_balance_data = None
                for source in SOURCE_PRIORITY:
                    for bal in balances_list:
                        if bal['source'] == source:
                            primary_source_balance_data = bal
                            break
                    if primary_source_balance_data:
                        break

                if not primary_source_balance_data:
                    print(f"  No prioritized source balance found for account {account_id} on {balance_date_str}. Skipping.")
                    continue

                primary_balance_value = primary_source_balance_data['balance_value']

                # 3. Discrepancy Detection
                discrepancies = []
                for bal in balances_list:
                    if bal != primary_source_balance_data: # Don't compare primary with itself
                        if abs(primary_balance_value - bal['balance_value']) > DISCREPANCY_THRESHOLD:
                            discrepancies.append({
                                'source_1': primary_source_balance_data['source'],
                                'value_1': primary_balance_value,
                                'source_2': bal['source'],
                                'value_2': bal['balance_value'],
                                'detected_on': firestore.SERVER_TIMESTAMP,
                                'description': f"Mismatch: {primary_source_balance_data['source']} ({primary_balance_value}) vs. {bal['source']} ({bal['balance_value']})",
                                'suggested_action': f"Review values, consider {primary_source_balance_data['source']}",
                                'threshold_used': DISCREPANCY_THRESHOLD,
                                'status': 'unresolved'
                            })

                # 4. Update account_balances
                account_doc_ref = db.collection('account_balances').document(account_id)
                current_account_doc = account_doc_ref.get()
                current_balance_data = current_account_doc.to_dict() if current_account_doc.exists else {}

                new_status = 'reconciled' if not discrepancies else 'pending_review'
                event_type = 'reconciled_auto' if not discrepancies else 'discrepancy_detected'

                update_data = {
                    'current_balance': primary_balance_value,
                    'source': primary_source_balance_data['source'],
                    'source_timestamp': primary_source_balance_data['source_timestamp'],
                    'last_reconciled_date': firestore.SERVER_TIMESTAMP,
                    'status': new_status,
                    'discrepancies': discrepancies,
                    # Carry over or set other essential account metadata if not present
                    'compte': current_account_doc.get('compte', primary_source_balance_data.get('account_name', account_id)),
                    'owner': current_account_doc.get('owner', primary_source_balance_data.get('owner')),
                    'updated_at': firestore.SERVER_TIMESTAMP,
                }

                account_doc_ref.set(update_data, merge=True) # Use merge=True to preserve other fields like previousSolde, linxoDelta etc.

                # 5. Log to account_balance_history
                history_doc = {
                    'account_id': account_id,
                    'balance_value': primary_balance_value,
                    'timestamp': firestore.SERVER_TIMESTAMP,
                    'event_type': event_type,
                    'source': primary_source_balance_data['source'],
                    'source_data': primary_source_balance_data['raw_source_data'],
                    'previous_balance': current_account_data.get('current_balance'), # Log previous reconciled balance
                    'discrepancy_details': discrepancies if discrepancies else None,
                    'user_id': 'system'
                }
                db.collection('account_balance_history').add(history_doc)

        # 6. Cleanup proposed_account_balances
        # Mark all processed proposed balance docs as 'validated' using a batch write
        batch = db.batch()
        for doc_ref_obj in proposed_balance_docs_to_update:
            batch.update(doc_ref_obj['ref'], {'processed_status': 'validated'})
        batch.commit()

        print("Balance cross-validation and reconciliation completed.")
        return 'Balance cross-validation and reconciliation completed successfully.', 200

    except Exception as e:
        print(f"Error during balance cross-validation: {e}")
        # Log the full exception for debugging
        import traceback
        traceback.print_exc()
        return {'status': 'error', 'message': str(e)}, 500

```

- [ ] **Step 2: Expose `run_balance_cross_validation` in `functions/main.py`**
  - Import the new function and register it as a Cloud Event trigger (on new documents in `proposed_account_balances`).

```python
# functions/main.py (partial update)

import functions_framework
from src.balance_ingestion import ingest_proposed_balance
from src.balance_reconciliation import run_balance_cross_validation
# ... existing imports ...

# ... existing functions ...

# Expose the new ingestion function
@functions_framework.http
def ingest_balance(request):
    return ingest_proposed_balance(request)

# Trigger for cross-validation on new proposed balances
@functions_framework.cloud_event
def trigger_balance_reconciliation(cloud_event):
    """
    Triggered when a new document is written to the proposed_account_balances collection.
    Processes all pending proposed balances.
    """
    print(f"New document in proposed_account_balances. Triggering reconciliation.")
    return run_balance_cross_validation(cloud_event)

```

- [ ] **Step 3: Commit**

```bash
git add functions/src/balance_reconciliation.py functions/main.py
git commit -m "feat: Implement Cloud Function for automated balance cross-validation and reconciliation"
```

### Task 6: Implement Reconciliation UI for Displaying Discrepancies

This task involves updating the frontend components to display accounts with `pending_review` status and show discrepancy details, allowing users to initiate reconciliation actions.

**Files:**

- Modify: `public/src/components/BalancesPanel.tsx`
- Modify: `public/src/components/CourantsTable.tsx`
- Create: `public/src/components/ReconciliationModal.tsx`
- Modify: `public/src/style.css` (for new UI styling)

- [ ] **Step 1: Create `public/src/components/ReconciliationModal.tsx`**
  - This modal will display discrepancy details and allow user actions.
  - It will need to call a Cloud Function to record reconciliation actions.

```typescript
// public/src/components/ReconciliationModal.tsx
import React from 'react';
import { AccountBalance, Discrepancy } from '../types/balances'; // Assuming types/balances.ts exists
import firebase from 'firebase/app'; // Adjust import based on your Firebase setup
import { getFunctions, httpsCallable } from 'firebase/functions'; // For calling Cloud Functions
import { getAuth } from 'firebase/auth'; // To get current user ID

interface ReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: AccountBalance;
}

export const ReconciliationModal: React.FC<ReconciliationModalProps> = ({ isOpen, onClose, account }) => {
  if (!isOpen) return null;

  const functions = getFunctions(firebase.getApp()); // Initialize functions
  const recordReconciliationAction = httpsCallable(functions, 'reconcile_balance_action'); // Name of your CF

  const auth = getAuth(firebase.getApp());
  const userId = auth.currentUser?.uid; // Get current user ID

  const handleResolve = async (discrepancy: Discrepancy, action: 'choose_source_1' | 'choose_source_2' | 'manual', manualValue?: number) => {
    if (!userId) {
        alert("You must be logged in to perform reconciliation actions.");
        return;
    }

    let newBalance = account.current_balance;
    let chosenSource = account.source;
    let eventType: string;
    let userActionDetails: { [key: string]: any } = {
        discrepancy: discrepancy,
        user_id: userId,
    };

    if (action === 'choose_source_1') {
      newBalance = discrepancy.value_1;
      chosenSource = discrepancy.source_1;
      eventType = 'reconciled_user_choice';
      userActionDetails.chosen_value = newBalance;
      userActionDetails.chosen_source = chosenSource;
    } else if (action === 'choose_source_2') {
      newBalance = discrepancy.value_2;
      chosenSource = discrepancy.source_2;
      eventType = 'reconciled_user_choice';
      userActionDetails.chosen_value = newBalance;
      userActionDetails.chosen_source = chosenSource;
    } else if (action === 'manual' && manualValue !== undefined) {
      newBalance = manualValue;
      chosenSource = 'manual_override';
      eventType = 'reconciled_manual_override';
      userActionDetails.manual_value = manualValue;
    } else {
        console.error("Invalid reconciliation action.");
        return;
    }

    try {
      // Call Cloud Function to update Firestore and history
      const result = await recordReconciliationAction({
        accountId: account.id,
        newBalance: newBalance,
        chosenSource: chosenSource,
        discrepancyToResolve: discrepancy, // Pass entire discrepancy object to match for removal
        eventType: eventType,
        userActionDetails: userActionDetails,
      });

      if ((result.data as any).status === 'success') {
        console.log('Reconciliation action recorded successfully.');
        // The modal will likely close itself if the parent component re-renders due to status change
        onClose();
      } else {
        alert(`Failed to record reconciliation action: ${(result.data as any).message}`);
        console.error('Failed to record reconciliation action:', (result.data as any).message);
      }
    } catch (error) {
      alert(`Error calling reconciliation action: ${error}`);
      console.error('Error calling record_reconciliation_action CF:', error);
    }
  };

  const handleAcknowledge = async (discrepancy: Discrepancy) => {
    if (!userId) {
        alert("You must be logged in to perform reconciliation actions.");
        return;
    }

    try {
        const result = await recordReconciliationAction({
            accountId: account.id,
            discrepancyToAcknowledge: discrepancy, // Pass entire discrepancy object to match for update
            eventType: 'discrepancy_acknowledged',
            userActionDetails: {
                discrepancy: discrepancy,
                user_id: userId,
                reason: 'Acknowledged without change', // Optionally allow user to input a reason
            },
        });
        if ((result.data as any).status === 'success') {
            console.log('Discrepancy acknowledged successfully.');
            // The modal will likely update if the parent component re-renders due to status change
        } else {
            alert(`Failed to acknowledge discrepancy: ${(result.data as any).message}`);
            console.error('Failed to acknowledge discrepancy:', (result.data as any).message);
        }
    } catch (error) {
        alert(`Error acknowledging discrepancy: ${error}`);
        console.error('Error acknowledging discrepancy via CF:', error);
    }
  };

  // State for manual input
  const [manualInput, setManualInput] = React.useState<string>('');

  const unresolvedDiscrepancies = account.discrepancies?.filter(d => d.status === 'unresolved') || [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Reconcile Account: {account.compte}</h2>
        <p>Current Reconciled Balance: <strong>{account.current_balance.toFixed(2)}</strong></p>

        {unresolvedDiscrepancies.length > 0 ? (
          unresolvedDiscrepancies.map((d, index) => (
            <div key={index} className="discrepancy-item">
              <h3>Discrepancy {index + 1}</h3>
              <p>{d.description}</p>
              <p>Detected on: {d.detected_on.toDate().toLocaleString()}</p>
              <p>
                <strong>{d.source_1}:</strong> {d.value_1.toFixed(2)}
                <br />
                <strong>{d.source_2}:</strong> {d.value_2.toFixed(2)}
              </p>
              <div className="discrepancy-actions">
                <button onClick={() => handleResolve(d, 'choose_source_1')}>Choose {d.source_1}</button>
                <button onClick={() => handleResolve(d, 'choose_source_2')}>Choose {d.source_2}</button>
                <input
                  type="number"
                  step="0.01"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="Enter manual value"
                />
                <button onClick={() => handleResolve(d, 'manual', parseFloat(manualInput))} disabled={isNaN(parseFloat(manualInput))}>Enter Manually</button>
                <button onClick={() => handleAcknowledge(d)}>Acknowledge</button>
              </div>
            </div>
          ))
        ) : (
          <p>No unresolved discrepancies for this account.</p>
        )}

        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Update `public/src/components/BalancesPanel.tsx`**
  - Highlight accounts with `status: "pending_review"`.
  - Add a click handler to open `ReconciliationModal` when such an account is clicked.

```typescript
// public/src/components/BalancesPanel.tsx (partial update)
import React from 'react';
import { useBalances, AccountBalance } from '../hooks/useBalances';
// ... other imports
import { ReconciliationModal } from './ReconciliationModal'; // New component
import { BalanceHistoryModal } from './BalanceHistoryModal'; // New history modal

export const BalancesPanel: React.FC = () => {
  const { balances, loading, error } = useBalances();
  const [isReconciliationModalOpen, setIsReconciliationModalOpen] = React.useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = React.useState(false);
  const [selectedAccount, setSelectedAccount] = React.useState<AccountBalance | null>(null);

  const handleAccountClick = (account: AccountBalance) => {
    // Only open reconciliation modal if there are unresolved discrepancies
    if (account.status === 'pending_review' && account.discrepancies && account.discrepancies.filter(d => d.status === 'unresolved').length > 0) {
      setSelectedAccount(account);
      setIsReconciliationModalOpen(true);
    } else {
        // For accounts without pending review, or if user clicks 'View History' button
        // Open history modal directly
        setSelectedAccount(account);
        setIsHistoryModalOpen(true);
    }
  };

  const handleOpenHistoryModal = (account: AccountBalance, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent card click handler from firing
    setSelectedAccount(account);
    setIsHistoryModalOpen(true);
  };


  const handleCloseReconciliationModal = () => {
    setIsReconciliationModalOpen(false);
    setSelectedAccount(null);
  };

  const handleCloseHistoryModal = () => {
    setIsHistoryModalOpen(false);
    setSelectedAccount(null);
  };

  if (loading) return <div>Loading balances...</div>;
  if (error) return <div>Error loading balances: {error.message}</div>;

  // Assuming 'compte' and 'owner' logic for filtering accounts is handled elsewhere or is simple
  // For demonstration, let's just use all balances.
  const displayBalances = balances; // or filter as needed

  return (
    <div className="balances-panel">
      {/* ... existing panel header ... */}
      <div className="balances-grid">
        {displayBalances.map(b => (
          <div
            key={b.id}
            className={`balance-card ${b.status === 'pending_review' ? 'balance-card-pending-review' : ''}`}
            onClick={() => handleAccountClick(b)}
          >
            <div className="balance-head">
              <div className="balance-account">{b.compte}</div>
              <div className={`balance-status ${b.status === 'pending_review' ? 'status-pending' : 'status-reconciled'}`}>
                {b.status === 'pending_review' ? `Review Needed (${b.discrepancies?.filter(d => d.status === 'unresolved').length || 0})` : 'Reconciled'}
              </div>
            </div>
            <div className="balance-solde">{b.current_balance.toFixed(2)}</div> {/* Use current_balance */}
            {/* Add a button for history */}
            <button className="btn-view-history" onClick={(e) => handleOpenHistoryModal(b, e)}>
                View History
            </button>
          </div>
        ))}
        {displayBalances.length === 0 && <div className="balance-detail">No balances available.</div>}
      </div>

      {selectedAccount && isReconciliationModalOpen && (
        <ReconciliationModal
          isOpen={isReconciliationModalOpen}
          onClose={handleCloseReconciliationModal}
          account={selectedAccount}
        />
      )}

      {selectedAccount && isHistoryModalOpen && (
        <BalanceHistoryModal
          isOpen={isHistoryModalOpen}
          onClose={handleCloseHistoryModal}
          accountId={selectedAccount.id}
          accountName={selectedAccount.compte}
        />
      )}
    </div>
  );
};
```

- [ ] **Step 3: Update `public/src/components/CourantsTable.tsx` (and `SavingsTable.tsx` if needed)**
  - Adjust to use `current_balance` and `status` from the new data model.
  - Add conditional styling/indication for `pending_review` status.
  - Pass `onAccountClick` handler to allow parent to manage modal opening.

```typescript
// public/src/components/CourantsTable.tsx (partial update)
import React from 'react';
import { AccountBalance } from '../types/balances'; // Assuming updated AccountBalance type

interface CourantsTableProps {
  balances: AccountBalance[];
  selectedOwners: string[];
  onAccountClick: (account: AccountBalance) => void; // Pass click handler from parent
}

export const CourantsTable: React.FC<CourantsTableProps> = ({ balances, selectedOwners, onAccountClick }) => {
  const filtered = balances.filter(b => selectedOwners.includes(b.owner || '') || selectedOwners.length === 0);

  const sorted = [...filtered].sort((a, b) => (a.compte || '').localeCompare(b.compte || '', 'fr'));

  return (
    <div className="courants-table">
      <h3>Comptes Courants</h3>
      {sorted.length === 0 ? (
        <p>No current accounts to display.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Compte</th>
              <th>Solde</th>
              <th>Status</th>
              {/* ... other headers */}
            </tr>
          </thead>
          <tbody>
            {sorted.map(b => (
              <tr
                key={b.id}
                className={b.status === 'pending_review' ? 'row-pending-review' : ''}
                onClick={() => onAccountClick(b)}
              >
                <td>{b.compte}</td>
                <td>{b.current_balance.toFixed(2)}</td>
                <td className={b.status === 'pending_review' ? 'status-pending' : 'status-reconciled'}>
                    {b.status === 'pending_review' ? `Review (${b.discrepancies?.filter(d => d.status === 'unresolved').length || 0})` : 'Reconciled'}
                </td>
                {/* ... other data cells */}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};
```

- [ ] **Step 4: Add basic styling to `public/src/style.css`**
  - For `balance-card-pending-review`, `status-pending`, `modal-overlay`, `modal-content`, `discrepancy-item`, `discrepancy-actions`.

```css
/* public/src/style.css (additions) */

/* Highlight for accounts needing review */
.balance-card-pending-review {
  border: 2px solid var(--red); /* Example: red border */
  box-shadow: 0 0 8px rgba(255, 0, 0, 0.3);
}

.status-pending {
  color: var(--red);
  font-weight: bold;
}

.status-reconciled {
  color: var(--green); /* Assuming green for good status */
}

/* Modal styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: var(--background-light);
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
}

.modal-content h2 {
  margin-top: 0;
  color: var(--text-dark);
}

.discrepancy-item {
  background: var(--background-dark);
  border: 1px solid var(--border);
  padding: 15px;
  margin-bottom: 15px;
  border-radius: 6px;
}

.discrepancy-item h3 {
  color: var(--accent);
  margin-top: 0;
  margin-bottom: 10px;
}

.discrepancy-actions button,
.discrepancy-actions input[type='number'] {
  padding: 8px 12px;
  margin-right: 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background-color: var(--button-bg);
  color: var(--button-text);
  cursor: pointer;
}

.discrepancy-actions button:hover {
  background-color: var(--button-bg-hover);
}

.discrepancy-actions input[type='number'] {
  width: 120px;
  background-color: var(--input-bg);
  color: var(--input-text);
}

.discrepancy-actions {
  margin-top: 15px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
```

- [ ] **Step 5: Commit**

```bash
git add public/src/components/BalancesPanel.tsx public/src/components/CourantsTable.tsx public/src/components/ReconciliationModal.tsx public/src/style.css
git commit -m "feat: Implement reconciliation UI for displaying and initiating discrepancy resolution"
```

### Task 7: Develop Cloud Function for Recording Reconciliation Actions

This task involves creating a new Cloud Function that will handle user-initiated reconciliation actions (choosing a source, entering manual value, acknowledging a discrepancy) and update Firestore (`account_balances`, `account_balance_history`).

**Files:**

- Create: `functions/src/reconciliation_actions.py`
- Modify: `functions/main.py` (to expose the new function)
- Modify: `functions/requirements.txt` (for new dependency `json`)

- [ ] **Step 1: Create `functions/src/reconciliation_actions.py`**
  - Define `record_reconciliation_action(data)` function.
  - Handles different `eventType`s (user_choice, manual_override, acknowledged).
  - Updates the `account_balances` document (`current_balance`, `source`, `status`, `discrepancies` array).
  - Logs the action to `account_balance_history`.

```python
# functions/src/reconciliation_actions.py

import functions_framework
from google.cloud import firestore
from datetime import datetime
import json # Added for json.loads

db = firestore.Client()

@functions_framework.http
def record_reconciliation_action(request):
    """
    Cloud Function to record user-initiated reconciliation actions.
    Expected request body:
    {
        "accountId": "...",
        "eventType": "reconciled_user_choice" | "reconciled_manual_override" | "discrepancy_acknowledged",
        "userActionDetails": {...}, // Contains discrepancy info, user_id, reason etc.

        // Optional fields based on eventType
        "newBalance": 123.45,
        "chosenSource": "eb_api",
        "discrepancyToResolve": {...}, // Full discrepancy object
        "discrepancyToAcknowledge": {...}, // Full discrepancy object
    }
    """
    request_json = request.get_json(silent=True)
    if not request_json:
        return {'status': 'error', 'message': 'Invalid JSON'}, 400

    account_id = request_json.get('accountId')
    event_type = request_json.get('eventType')
    user_action_details = request_json.get('userActionDetails', {})
    user_id = user_action_details.get('user_id', 'unknown_user') # Default user_id for now

    if not all([account_id, event_type, user_id]):
        return {'status': 'error', 'message': 'Missing required fields: accountId, eventType, user_id in userActionDetails'}, 400

    account_doc_ref = db.collection('account_balances').document(account_id)

    try:
        @firestore.transactional
        def update_in_transaction(transaction, doc_ref):
            snapshot = doc_ref.get(transaction=transaction)
            if not snapshot.exists:
                raise ValueError(f"Account {account_id} not found.")

            current_account_data = snapshot.to_dict()
            current_discrepancies = current_account_data.get('discrepancies', [])

            update_data = {}
            history_doc = {
                'account_id': account_id,
                'timestamp': firestore.SERVER_TIMESTAMP,
                'event_type': event_type,
                'user_id': user_id,
                'discrepancy_details': user_action_details.get('discrepancy'),
                'source': user_action_details.get('chosen_source', 'user_action'), # Default source for manual actions
                'previous_balance': current_account_data.get('current_balance'),
            }

            if event_type in ['reconciled_user_choice', 'reconciled_manual_override']:
                new_balance = request_json.get('newBalance')
                chosen_source = request_json.get('chosenSource')
                discrepancy_to_resolve = request_json.get('discrepancyToResolve')

                if new_balance is None or chosen_source is None:
                    raise ValueError("newBalance and chosenSource are required for reconciliation.")

                # Filter out the resolved discrepancy
                updated_discrepancies = []
                resolved_one = False
                for d in current_discrepancies:
                    # Match by comparing critical fields. Ideally, discrepancies would have a unique ID.
                    # For now, matching on value_1, value_2, source_1, source_2, detected_on
                    if (discrepancy_to_resolve and
                        d.get('source_1') == discrepancy_to_resolve['source_1'] and
                        d.get('source_2') == discrepancy_to_resolve['source_2'] and
                        d.get('value_1') == discrepancy_to_resolve['value_1'] and
                        d.get('value_2') == discrepancy_to_resolve['value_2'] and
                        d.get('detected_on') == firestore.Timestamp.from_client_value(discrepancy_to_resolve['detected_on'])): # Compare Timestamps
                        # This discrepancy is resolved, do not add it to updated_discrepancies
                        resolved_one = True
                    else:
                        updated_discrepancies.append(d)

                if not resolved_one and discrepancy_to_resolve:
                    print("Warning: Discrepancy to resolve not found. It might have been resolved by another action or mismatched.")


                update_data = {
                    'current_balance': float(new_balance),
                    'source': chosen_source,
                    'last_reconciled_date': firestore.SERVER_TIMESTAMP,
                    'discrepancies': updated_discrepancies,
                }
                history_doc['balance_value'] = float(new_balance)

                # If all discrepancies are resolved, set status to 'reconciled'
                if not updated_discrepancies:
                    update_data['status'] = 'reconciled'
                else:
                    update_data['status'] = 'pending_review' # Still pending if others exist

            elif event_type == 'discrepancy_acknowledged':
                discrepancy_to_ack = request_json.get('discrepancyToAcknowledge')
                if not discrepancy_to_ack:
                    raise ValueError("Discrepancy details are required for acknowledgement.")

                updated_discrepancies = []
                found_and_acked = False
                for d in current_discrepancies:
                    # Match discrepancy based on content or a unique ID if available
                    if (d.get('source_1') == discrepancy_to_ack['source_1'] and
                        d.get('source_2') == discrepancy_to_ack['source_2'] and
                        d.get('value_1') == discrepancy_to_ack['value_1'] and
                        d.get('value_2') == discrepancy_to_ack['value_2'] and
                        d.get('detected_on') == firestore.Timestamp.from_client_value(discrepancy_to_ack['detected_on']) and
                        d.get('status') == 'unresolved'): # Acknowledge only unresolved ones

                        # Add acknowledgement to the discrepancy itself
                        acknowledgements = d.get('acknowledgements', [])
                        acknowledgements.append({
                            'user_id': user_id,
                            'timestamp': firestore.SERVER_TIMESTAMP,
                            'reason': user_action_details.get('reason', 'Acknowledged by user')
                        })
                        d['acknowledgements'] = acknowledgements
                        d['status'] = 'acknowledged' # Mark as acknowledged
                        found_and_acked = True
                    updated_discrepancies.append(d)

                if not found_and_acked:
                    raise ValueError("Discrepancy to acknowledge not found or already acknowledged.")

                update_data = {
                    'discrepancies': updated_discrepancies,
                    'status': 'pending_review' # Still pending review if other unresolved exist
                }
                history_doc['balance_value'] = current_account_data.get('current_balance') # Balance doesn't change

            else:
                raise ValueError(f"Unknown event type: {event_type}")

            transaction.update(doc_ref, update_data)
            db.collection('account_balance_history').add(history_doc) # Add history entry

        transaction = db.transaction()
        update_in_transaction(transaction, account_doc_ref)

        return {'status': 'success', 'message': f'Reconciliation action "{event_type}" recorded for account {account_id}.'}, 200

    except Exception as e:
        print(f"Error recording reconciliation action: {e}")
        import traceback
        traceback.print_exc()
        return {'status': 'error', 'message': str(e)}, 500
```

- [ ] **Step 2: Expose `record_reconciliation_action` in `functions/main.py`**
  - Import the new function and register it as an HTTP endpoint.

```python
# functions/main.py (partial update)

import functions_framework
from src.balance_ingestion import ingest_proposed_balance
from src.balance_reconciliation import run_balance_cross_validation
from src.reconciliation_actions import record_reconciliation_action
# ... existing imports ...

# ... existing functions ...

# Expose the new ingestion function
@functions_framework.http
def ingest_balance(request):
    return ingest_proposed_balance(request)

# Trigger for cross-validation on new proposed balances
@functions_framework.cloud_event
def trigger_balance_reconciliation(cloud_event):
    """
    Triggered when a new document is written to the proposed_account_balances collection.
    Processes all pending proposed balances.
    """
    print(f"New document in proposed_account_balances. Triggering reconciliation.")
    return run_balance_cross_validation(cloud_event)

# Expose the reconciliation action function
@functions_framework.http
def reconcile_balance_action(request):
    return record_reconciliation_action(request)

```

- [ ] **Step 3: Commit**

```bash
git add functions/src/reconciliation_actions.py functions/main.py
git commit -m "feat: Implement Cloud Function for recording user reconciliation actions"
```

### Task 8: Implement UI for Balance History Review

This task involves creating a new frontend component or modifying an existing one to display the `account_balance_history` for a given account.

**Files:**

- Create: `public/src/components/BalanceHistoryModal.tsx`
- Modify: `public/src/components/BalancesPanel.tsx` (to open history modal)
- Modify: `public/src/style.css` (for new UI styling)

- [ ] **Step 1: Create `public/src/components/BalanceHistoryModal.tsx`**
  - Modal component to fetch and display `account_balance_history` for a given `account_id`.

```typescript
// public/src/components/BalanceHistoryModal.tsx
import React, { useEffect, useState } from 'react';
import firebase from 'firebase/app'; // Adjust import based on your Firebase setup
import { getFirestore, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';

interface BalanceHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: string;
  accountName: string;
}

interface HistoryEntry {
  id: string;
  account_id: string;
  balance_value: number;
  timestamp: firebase.firestore.Timestamp;
  event_type: string;
  source: string;
  previous_balance?: number;
  user_id?: string;
  discrepancy_details?: any; // Consider a more specific type
}

const db = getFirestore(firebase.getApp());

export const BalanceHistoryModal: React.FC<BalanceHistoryModalProps> = ({ isOpen, onClose, accountId, accountName }) => {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!isOpen || !accountId) {
      setHistory([]);
      return;
    }

    const fetchHistory = async () => {
      setLoading(true);
      setError(null);
      try {
        const q = query(
          collection(db, 'account_balance_history'),
          where('account_id', '==', accountId),
          orderBy('timestamp', 'desc'),
          limit(50) // Limit to recent 50 entries
        );
        const querySnapshot = await getDocs(q);
        const fetchedHistory: HistoryEntry[] = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...(doc.data() as Omit<HistoryEntry, 'id'>)
        }));
        setHistory(fetchedHistory);
      } catch (err: any) {
        console.error("Error fetching balance history:", err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [isOpen, accountId]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>History for {accountName}</h2>

        {loading && <p>Loading history...</p>}
        {error && <p>Error: {error.message}</p>}

        {!loading && history.length === 0 && <p>No history available for this account.</p>}

        {!loading && history.length > 0 && (
          <div className="history-list">
            {history.map(entry => (
              <div key={entry.id} className="history-item">
                <p><strong>{entry.timestamp.toDate().toLocaleString()}</strong></p>
                <p>Event: {entry.event_type}</p>
                <p>Balance: {entry.balance_value.toFixed(2)}</p>
                {entry.previous_balance !== undefined && <p>Previous Balance: {entry.previous_balance.toFixed(2)}</p>}
                <p>Source: {entry.source}</p>
                {entry.user_id && <p>User: {entry.user_id}</p>}
                {entry.discrepancy_details && (
                  <div className="discrepancy-history-details">
                    <h4>Discrepancy Details:</h4>
                    {/* Render discrepancy details here as needed */}
                    <pre>{JSON.stringify(entry.discrepancy_details, null, 2)}</pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Update `public/src/components/BalancesPanel.tsx` (to open history modal)**
  - Add a button or option to view history for an account.

```typescript
// public/src/components/BalancesPanel.tsx (partial update)
import React from 'react';
import { useBalances, AccountBalance } from '../hooks/useBalances';
import { ReconciliationModal } from './ReconciliationModal';
import { BalanceHistoryModal } from './BalanceHistoryModal'; // New history modal

export const BalancesPanel: React.FC = () => {
  const { balances, loading, error } = useBalances();
  const [isReconciliationModalOpen, setIsReconciliationModalOpen] = React.useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = React.useState(false);
  const [selectedAccount, setSelectedAccount] = React.useState<AccountBalance | null>(null);

  const handleAccountClick = (account: AccountBalance) => {
    // Only open reconciliation modal if there are unresolved discrepancies
    if (account.status === 'pending_review' && account.discrepancies && account.discrepancies.filter(d => d.status === 'unresolved').length > 0) {
      setSelectedAccount(account);
      setIsReconciliationModalOpen(true);
    } else {
        // For accounts without pending review, or if user clicks 'View History' button
        // Open history modal directly
        setSelectedAccount(account);
        setIsHistoryModalOpen(true);
    }
  };

  const handleOpenHistoryModal = (account: AccountBalance, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent card click handler from firing
    setSelectedAccount(account);
    setIsHistoryModalOpen(true);
  };


  const handleCloseReconciliationModal = () => {
    setIsReconciliationModalOpen(false);
    setSelectedAccount(null);
  };

  const handleCloseHistoryModal = () => {
    setIsHistoryModalOpen(false);
    setSelectedAccount(null);
  };

  if (loading) return <div>Loading balances...</div>;
  if (error) return <div>Error loading balances: {error.message}</div>;

  // Assuming 'compte' and 'owner' logic for filtering accounts is handled elsewhere or is simple
  // For demonstration, let's just use all balances.
  const displayBalances = balances; // or filter as needed

  return (
    <div className="balances-panel">
      {/* ... existing panel header ... */}
      <div className="balances-grid">
        {displayBalances.map(b => (
          <div
            key={b.id}
            className={`balance-card ${b.status === 'pending_review' ? 'balance-card-pending-review' : ''}`}
            onClick={() => handleAccountClick(b)}
          >
            <div className="balance-head">
              <div className="balance-account">{b.compte}</div>
              <div className={`balance-status ${b.status === 'pending_review' ? 'status-pending' : 'status-reconciled'}`}>
                {b.status === 'pending_review' ? `Review Needed (${b.discrepancies?.filter(d => d.status === 'unresolved').length || 0})` : 'Reconciled'}
              </div>
            </div>
            <div className="balance-solde">{b.current_balance.toFixed(2)}</div> {/* Use current_balance */}
            {/* Add a button for history */}
            <button className="btn-view-history" onClick={(e) => handleOpenHistoryModal(b, e)}>
                View History
            </button>
          </div>
        ))}
        {displayBalances.length === 0 && <div className="balance-detail">No balances available.</div>}
      </div>

      {selectedAccount && isReconciliationModalOpen && (
        <ReconciliationModal
          isOpen={isReconciliationModalOpen}
          onClose={handleCloseReconciliationModal}
          account={selectedAccount}
        />
      )}

      {selectedAccount && isHistoryModalOpen && (
        <BalanceHistoryModal
          isOpen={isHistoryModalOpen}
          onClose={handleCloseHistoryModal}
          accountId={selectedAccount.id}
          accountName={selectedAccount.compte}
        />
      )}
    </div>
  );
};
```

- [ ] **Step 3: Add styling for history UI to `public/src/style.css`**

```css
/* public/src/style.css (additions) */

/* ... existing modal styles ... */

.history-list {
  margin-top: 20px;
  max-height: 400px; /* Scrollable history */
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 10px;
}

.history-item {
  background: var(--background-dark);
  padding: 10px;
  margin-bottom: 10px;
  border-radius: 4px;
  border-left: 4px solid var(--accent); /* Visual indicator */
}

.history-item p {
  margin: 5px 0;
  font-size: 0.9em;
  color: var(--text);
}

.history-item strong {
  color: var(--text-dark);
}

.discrepancy-history-details {
  background: rgba(var(--red-rgb), 0.1);
  border: 1px solid var(--red);
  padding: 8px;
  margin-top: 10px;
  border-radius: 4px;
}

.discrepancy-history-details h4 {
  color: var(--red);
  margin-top: 0;
  margin-bottom: 5px;
}

.btn-view-history {
  background-color: var(--button-bg-secondary);
  color: var(--button-text-secondary);
  border: 1px solid var(--button-border-secondary);
  padding: 5px 10px;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 10px;
  font-size: 0.8em;
}

.btn-view-history:hover {
  background-color: var(--button-bg-secondary-hover);
}
```

- [ ] **Step 4: Commit**

```bash
git add public/src/components/BalanceHistoryModal.tsx public/src/components/BalancesPanel.tsx public/src/style.css
git commit -m "feat: Implement UI for balance history review"
```

### Task 9: Implement Reporting and Analytics Dashboards (Basic)

This task involves creating basic reporting on reconciliation status, potentially adding a new UI component or extending an existing dashboard.

**Files:**

- Create: `public/src/components/ReconciliationReport.tsx`
- Modify: `public/src/app.js` (to integrate report)

- [ ] **Step 1: Create `public/src/components/ReconciliationReport.tsx`**
  - Component to fetch and display high-level reconciliation statistics.

```typescript
// public/src/components/ReconciliationReport.tsx
import React, { useEffect, useState } from 'react';
import { useBalances } from '../hooks/useBalances';
import { AccountBalance } from '../types/balances'; // Assuming types/balances.ts exists

export const ReconciliationReport: React.FC = () => {
  const { balances, loading, error } = useBalances();
  const [report, setReport] = useState<{
    totalAccounts: number;
    reconciledAccounts: number;
    pendingReviewAccounts: number;
    totalUnresolvedDiscrepancies: number;
    discrepancyBreakdown: { [key: string]: number };
  }>({
    totalAccounts: 0,
    reconciledAccounts: 0,
    pendingReviewAccounts: 0,
    totalUnresolvedDiscrepancies: 0,
    discrepancyBreakdown: {},
  });

  useEffect(() => {
    if (balances.length > 0) {
      const totalAccounts = balances.length;
      let reconciledAccounts = 0;
      let pendingReviewAccounts = 0;
      let totalUnresolvedDiscrepancies = 0;
      const discrepancyBreakdown: { [key: string]: number } = {};

      balances.forEach((account: AccountBalance) => {
        if (account.status === 'reconciled') {
          reconciledAccounts++;
        } else if (account.status === 'pending_review' || account.status === 'discrepancy_unresolved') {
          pendingReviewAccounts++;
          if (account.discrepancies) {
            account.discrepancies.filter(d => d.status === 'unresolved').forEach(d => {
              totalUnresolvedDiscrepancies++;
              const key = `${d.source_1} vs ${d.source_2}`;
              discrepancyBreakdown[key] = (discrepancyBreakdown[key] || 0) + 1;
            });
          }
        }
      });

      setReport({
        totalAccounts,
        reconciledAccounts,
        pendingReviewAccounts,
        totalUnresolvedDiscrepancies,
        discrepancyBreakdown,
      });
    }
  }, [balances]);

  if (loading) return <div>Loading report...</div>;
  if (error) return <div>Error loading report: {error.message}</div>;

  return (
    <div className="reconciliation-report-card">
      <h2>Reconciliation Status Report</h2>
      <p><strong>Total Accounts:</strong> {report.totalAccounts}</p>
      <p><strong>Reconciled Accounts:</strong> {report.reconciledAccounts}</p>
      <p><strong>Accounts Needing Review:</strong> {report.pendingReviewAccounts}</p>
      <p><strong>Total Unresolved Discrepancies:</strong> {report.totalUnresolvedDiscrepancies}</p>

      {report.totalUnresolvedDiscrepancies > 0 && (
        <div className="discrepancy-breakdown">
          <h3>Discrepancy Breakdown:</h3>
          <ul>
            {Object.entries(report.discrepancyBreakdown).map(([key, count]) => (
              <li key={key}>{key}: {count}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Integrate `ReconciliationReport` into `public/src/app.js` or a dashboard component**
  - This is a conceptual step; the actual integration would depend on where the user wants to see this report. For simplicity, assume it's added to a main dashboard or a new page.

```javascript
// public/src/app.js (conceptual update)
// Assuming a React setup in public/src/app.js
import React from 'react';
import ReactDOM from 'react-dom';
import { BalancesPanel } from './components/BalancesPanel';
import { ReconciliationReport } from './components/ReconciliationReport'; // Import new component

const App = () => {
  return (
    <div>
      <h1>My Financial Dashboard</h1>
      <BalancesPanel />
      <ReconciliationReport /> {/* Add the report component */}
      {/* ... other components ... */}
    </div>
  );
};

// Assuming you have an element with id 'root' in your index.html
ReactDOM.render(<App />, document.getElementById('root'));
```

- [ ] **Step 3: Add styling for report UI to `public/src/style.css`**

```css
/* public/src/style.css (additions) */

.reconciliation-report-card {
  background: var(--background-light);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 20px;
  margin-top: 20px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
}

.reconciliation-report-card h2 {
  color: var(--text-dark);
  margin-top: 0;
  margin-bottom: 15px;
}

.reconciliation-report-card p {
  margin-bottom: 8px;
}

.discrepancy-breakdown {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid var(--border);
}

.discrepancy-breakdown h3 {
  color: var(--text-dark);
  margin-top: 0;
  margin-bottom: 10px;
}

.discrepancy-breakdown ul {
  list-style-type: disc;
  margin-left: 20px;
}

.discrepancy-breakdown li {
  margin-bottom: 5px;
  color: var(--text);
}
```

- [ ] **Step 4: Commit**

```bash
git add public/src/components/ReconciliationReport.tsx public/src/app.js public/src/style.css
git commit -m "feat: Implement basic reconciliation reporting and analytics dashboard"
```
