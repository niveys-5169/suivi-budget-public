# Design Specification: Perennial Balance Reconciliation

**Date:** 2026-04-17

**Topic:** Perennial Balance Reconciliation

**Problem Statement:**
The current system for importing and reconciling account balances suffers from data accuracy issues, including incorrect imported values, incomplete imports across accounts/periods, and inconsistencies between different data sources (e.g., email vs. banking API). Furthermore, the existing reconciliation mechanisms (`acknowledgeBalanceMismatch`, `rerunBalanceCheck`) fail to accurately identify all discrepancies, leading to a lack of confidence in the reported account balances.

**Success Criterion:** The "perennial solution" should ensure that all imported account balances are consistently correct and accurately reflect the true state of the accounts at all times.

**Approach:** Enhanced Data Source Prioritization & Automated Cross-Validation

---

## Design Section 1: Data Model Enhancements

To support enhanced prioritization and cross-validation, the Firestore data models for `account_balances` and `savings_balances` (and potentially `account_balance_history`) need to be extended.

**Current `account_balances` (example inferred from code):**

```
collection/account_balances/{document_id}
  - id: string (document_id, often account ID)
  - compte: string (account name/number)
  - solde: number (current balance)
  - previousSolde: number
  - linxoDelta: number (specific to Linxo, possibly from EB API)
  - computedSolde: number
  - status: string (e.g., "OK", "Mismatch")
  - emailDate: timestamp
  - acknowledgedFingerprint: string (from buildBalanceMismatchFingerprint)
  - owner: string
  // ... other fields
```

**Proposed Enhancements:**

1.  **Source Tracking:** Each balance entry must explicitly track its origin and relevant metadata.
    - `source`: string (e.g., "eb*api", "email_parser", "manual_override", "reconciliation"). This will indicate the primary source that \_provided* this specific balance value.
    - `source_timestamp`: timestamp (When this balance was retrieved/recorded from its source).
    - `source_metadata`: map (Optional, e.g., `{'email_id': '...', 'email_subject': '...'}` for email, or `{'eb_transaction_id': '...'}` for API, etc.)

2.  **Consolidated Balance Entry (for `account_balances` and `savings_balances`):**
    Each document in these collections will represent the _current reconciled balance_ for an account.
    - `current_balance`: number (The reconciled "true" balance value).
    - `last_reconciled_date`: timestamp (When this `current_balance` was last confirmed/reconciled).
    - `status`: string (e.g., "reconciled", "pending_review", "discrepancy_unresolved"). This replaces the existing simple `status` field and becomes more granular.
    - `discrepancies`: array of objects (Stores details of _detected but unresolved discrepancies_).
      - `source_1`: string
      - `value_1`: number
      - `source_2`: string
      - `value_2`: number
      - `detected_on`: timestamp
      - `description`: string (e.g., "EB API vs. Email Parser mismatch")
      - `suggested_action`: string (e.g., "Choose EB API", "Choose Email", "Manual Entry")
      - `acknowledgements`: array of object (tracks who acknowledged what, when, and with what fingerprint, similar to current `acknowledgedFingerprint` but more robust)

3.  **Balance History (in `account_balance_history`):**
    This collection will store a snapshot of _every significant balance change or reconciliation event_, ensuring an immutable audit trail.
    - `account_id`: string
    - `balance_value`: number (The balance at this point in time)
    - `timestamp`: timestamp (When this history entry was recorded)
    - `event_type`: string (e.g., "imported_eb_api", "imported_email", "reconciled_user_override", "discrepancy_detected")
    - `source`: string (e.g., "eb_api", "email_parser", "user")
    - `source_data`: map (Raw data from the source, e.g., `{ 'balance': 100, 'date': '...' }`)
    - `previous_balance`: number (The balance before this event)
    - `discrepancy_details`: map (If `event_type` is `discrepancy_detected` or `reconciled_user_override`, store relevant details about the conflict and resolution.)
    - `user_id`: string (If applicable, who initiated the change/resolution)

**Impact on existing code:**

- Existing code reading `solde` will need to be updated to read `current_balance`.
- The `status` field will need to be interpreted differently and potentially updated more dynamically.
- `acknowledgedFingerprint` logic will be absorbed into the new `discrepancies` structure.

---

## Design Section 2: Balance Import Process Flow

This section outlines the revised process for importing balances from different sources, integrating with the new data model and setting the stage for cross-validation.

**Goals:**

- Ensure all potential balance sources are regularly polled.
- Standardize the data format upon ingestion.
- Record source information and raw data for auditability.
- Prepare data for the cross-validation step.

**Revised Flow:**

1.  **Scheduled Import Triggers:**
    - **External Banking API (e.g., Enable Banking / Linxo):** A Cloud Function (e.g., `eb_import_balances` or existing `get_latest_email_balances` adapted) will be scheduled to run regularly (e.g., daily). It will use `enable_banking_client.py` to fetch balances for all configured accounts.
    - **Email Parsing:** A Cloud Function (e.g., `email_import_balances`) will be triggered (e.g., via Pub/Sub for new emails or on a schedule) to process incoming balance emails. `transaction_parser.py` will be used to extract balance information.
    - **Manual Entry:** A dedicated UI endpoint (not covered in this plan, but assumed to exist for manual adjustments) allows users to input balances, which also feeds into this flow.

2.  **Standardized Data Ingestion:**
    - Regardless of the source, each imported balance event will be transformed into a standardized `ProposedBalance` object (or equivalent data structure).
    - `ProposedBalance` attributes:
      - `account_id`: string (Unique identifier for the account)
      - `balance_value`: number (The balance reported by this source)
      - `balance_date`: timestamp (The date/time this balance is valid for)
      - `source`: string (e.g., "eb_api", "email_parser", "manual_entry")
      - `source_timestamp`: timestamp (When this balance was actually received/parsed from its source)
      - `raw_source_data`: map (The raw, untransformed data received from the source for audit purposes)
      - `owner`: string (Associated owner, if known from the source)

3.  **Temporary Storage for Comparison:**
    - Instead of directly updating `account_balances` or `savings_balances`, newly ingested `ProposedBalance` entries will be stored temporarily in a dedicated Firestore collection, e.g., `proposed_account_balances` or `incoming_balance_snapshots`.
    - This collection will serve as a staging area, holding multiple balance values for the same account and date, originating from different sources, awaiting cross-validation.
    - Each entry in this staging area would look similar to the `ProposedBalance` structure above, perhaps with an added `processed_status` field (e.g., "pending_validation").

4.  **Audit Trail Logging (Initial):**
    - Upon successful ingestion into the `proposed_account_balances` staging area, a new entry will be added to `account_balance_history` with `event_type: "imported_{source}"` and including the `raw_source_data`. This ensures that even raw imports are recorded.

**Flow Diagram:**

```mermaid
graph TD
    A[Scheduled EB API Import] --> B(Standardized EB ProposedBalance)
    C[Scheduled Email Parsing] --> D(Standardized Email ProposedBalance)
    E[Manual Balance Entry] --> F(Standardized Manual ProposedBalance)

    B --> G[Store in proposed_account_balances Collection]
    D --> G
    F --> G

    G --> H[Log event_type: "imported_..." in account_balance_history]
    H --> I[Trigger Automated Cross-Validation]
```

---

## Design Section 3: Automated Cross-Validation & Discrepancy Detection

This section describes the logic for comparing incoming balances from different sources, identifying discrepancies, and updating the main `account_balances` (or `savings_balances`) collections.

**Goals:**

- Compare balances from multiple sources for the same account and date.
- Apply a defined source prioritization.
- Accurately detect discrepancies based on a configurable threshold.
- Update the `account_balances` collection with the "truest" available balance.
- Flag unresolved discrepancies for user review in the `account_balances` document.

**Process:**

1.  **Triggering Cross-Validation:**
    - After new `ProposedBalance` entries are stored in `proposed_account_balances` (as described in Section 2), a dedicated Cloud Function, e.g., `run_balance_cross_validation`, will be triggered (e.g., via Pub/Sub or a scheduled trigger).

2.  **Grouping Proposed Balances:**
    - For each `account_id` and `balance_date`, the `run_balance_cross_validation` function will group all `ProposedBalance` entries from the `proposed_account_balances` collection. This allows comparison of all known balance values for a specific account on a specific day.

3.  **Source Prioritization and Selection:**
    - A configurable list of "Source Priority" will be defined (e.g., in a Firestore document or environment variable). Example: `['eb_api', 'manual_entry', 'email_parser']`.
    - For each group of `ProposedBalance` entries:
      - Iterate through the `Source Priority` list.
      - The `balance_value` from the highest-priority available source will be selected as the `primary_source_balance`.
      - If multiple sources of the same priority exist, further rules might apply (e.g., most recent `source_timestamp` or average, but for simplicity, we'll start with the first encountered highest priority).

4.  **Discrepancy Detection:**
    - Compare the `primary_source_balance` with all other `ProposedBalance` entries for the same `account_id` and `balance_date`.
    - A configurable `DISCREPANCY_THRESHOLD` (e.g., 0.01€) will be used. If the absolute difference between `primary_source_balance` and any other `ProposedBalance` is greater than `DISCREPANCY_THRESHOLD`, a discrepancy is detected.

5.  **Updating `account_balances` / `savings_balances`:**
    - **No Discrepancy:** If no discrepancy is detected, the `account_balances` document for that `account_id` will be updated:
      - `current_balance` = `primary_source_balance.balance_value`
      - `last_reconciled_date` = `primary_source_balance.source_timestamp` (or current timestamp)
      - `status` = "reconciled"
      - `source` = `primary_source_balance.source`
      - `discrepancies` = empty array
      - An entry will be added to `account_balance_history` with `event_type: "reconciled_auto"`.
    - **Discrepancy Detected:** If one or more discrepancies are detected, the `account_balances` document will be updated:
      - `current_balance` = `primary_source_balance.balance_value` (The system will still show the highest priority value, but flag it as potentially incorrect)
      - `last_reconciled_date` = current timestamp
      - `status` = "pending_review" or "discrepancy_unresolved"
      - `source` = `primary_source_balance.source`
      - `discrepancies`: An array containing details of each detected discrepancy (as defined in Section 1), including the values from conflicting sources, the threshold, and a suggested action (e.g., "Review difference between EB API and Email").
      - An entry will be added to `account_balance_history` with `event_type: "discrepancy_detected"`.

6.  **Cleanup:**
    - Once processed, `ProposedBalance` entries in `proposed_account_balances` can be marked as `processed_status: "validated"` or moved to an archive collection.

**Example Discrepancy Record (within `account_balances.discrepancies` array):**

```json
{
  "source_1": "eb_api",
  "value_1": 1000.5,
  "source_2": "email_parser",
  "value_2": 999.75,
  "detected_on": "2026-04-17T10:00:00Z",
  "description": "EB API vs. Email Parser mismatch exceeds threshold",
  "suggested_action": "Manually verify balance for account X, consider EB API value",
  "threshold_used": 0.01,
  "status": "unresolved"
}
```

**Flow Diagram:**

```mermaid
graph TD
    A[Proposed Balances in Staging Area] --> B{Group by Account & Date}
    B --> C{Apply Source Priority & Select Primary Balance}
    C --> D{Compare Primary Balance with Other Sources}
    D -- No Discrepancy --> E[Update account_balances: status="reconciled", current_balance = primary]
    E --> F[Log account_balance_history: "reconciled_auto"]
    D -- Discrepancy Detected --> G[Update account_balances: status="pending_review", current_balance = primary, add discrepancies array]
    G --> H[Log account_balance_history: "discrepancy_detected"]
    F --> I[Cleanup Staging Area]
    H --> I
```

---

## Design Section 4: Reconciliation User Interface & Workflow

This section describes the user-facing part of the reconciliation process, focusing on how detected discrepancies are presented and how users can resolve them.

**Goals:**

- Clearly present all detected discrepancies to the user.
- Provide enough information for the user to make an informed decision.
- Offer intuitive actions to resolve discrepancies.
- Update the `account_balances` and `account_balance_history` collections based on user actions.

**UI Integration:**

- The existing "BalancesPanel" (`public/src/components/BalancesPanel.tsx` or similar) or a new dedicated "Reconciliation Dashboard" will be the primary entry point for users to review discrepancies.
- The `status` field in `account_balances` (e.g., "pending_review") will drive the visibility of these discrepancies in the UI.

**Reconciliation Workflow:**

1.  **Discrepancy Notification/Visibility:**
    - Accounts with `status: "pending_review"` or `status: "discrepancy_unresolved"` in `account_balances` will be prominently highlighted in the BalancesPanel.
    - A badge or specific styling will indicate the presence of unresolved discrepancies.

2.  **Discrepancy Details View:**
    - When a user clicks on an account with a discrepancy, a detailed view (e.g., a modal or dedicated section) will appear, showing all entries in the `discrepancies` array for that account.
    - For each discrepancy, the UI will display:
      - **Conflicting Values:** Both `value_1` and `value_2` along with their respective `source_1` and `source_2`.
      - **Detected Date:** `detected_on`.
      - **Description:** A clear message explaining the conflict (e.g., "EB API vs. Email Parser mismatch").
      - **Proposed Action(s):** Buttons or selection fields corresponding to `suggested_action` (e.g., "Choose EB API Value", "Choose Email Value", "Enter Manual Value").

3.  **User Actions & Resolution:**
    - **Choose Source Value:** If the user selects "Choose EB API Value", the system will:
      - Update `account_balances.current_balance` to `value_1` (from the EB API).
      - Update `account_balances.source` to `source_1` (EB API).
      - Remove this specific discrepancy from the `account_balances.discrepancies` array.
      - Update `account_balances.status` to "reconciled" if no other discrepancies remain.
      - Log an entry in `account_balance_history` with `event_type: "reconciled_user_choice"`, including `user_id`, `old_balance`, `new_balance`, and `discrepancy_details`.
    - **Enter Manual Value:** If the user chooses "Enter Manual Value", they will be prompted to input the correct balance. The system will then:
      - Update `account_balances.current_balance` to the manually entered value.
      - Update `account_balances.source` to "manual_override".
      - Remove this specific discrepancy from the `account_balances.discrepancies` array.
      - Update `account_balances.status` to "reconciled" if no other discrepancies remain.
      - Log an entry in `account_balance_history` with `event_type: "reconciled_manual_override"`, including `user_id`, `old_balance`, `new_balance`, and `discrepancy_details`.
    - **Acknowledge (without change):** If a user simply wants to acknowledge a discrepancy without changing the `current_balance` (e.g., "this small difference is fine"), a separate action can record this acknowledgment within the `discrepancies` object (using `acknowledgements` array) without removing the discrepancy from the array. This would prevent it from continuously flagging. The status would remain "discrepancy_unresolved" but with an updated `acknowledgements` array.

4.  **Real-time Updates:**
    - The UI will reflect balance changes and status updates in real-time as users resolve discrepancies (via Firestore listeners).

**Flow Diagram for User Reconciliation:**

```mermaid
graph TD
    A[Account with status: "pending_review"] --> B{User Clicks Account}
    B --> C[Display Discrepancy Details (Modal/Section)]
    C --> D{User Action}
    D -- Choose Source Value --> E[Update account_balances: current_balance, source, remove discrepancy]
    D -- Enter Manual Value --> F[Update account_balances: current_balance = manual, source="manual_override", remove discrepancy]
    D -- Acknowledge --> G[Update account_balances: add to discrepancy.acknowledgements]

    E --> H[Log account_balance_history: "reconciled_user_choice"]
    F --> I[Log account_balance_history: "reconciled_manual_override"]
    G --> J[Log account_balance_history: "discrepancy_acknowledged"]

    H --> K{No more discrepancies?}
    I --> K
    K -- Yes --> L[Update account_balances: status="reconciled"]
    K -- No --> M[account_balances.status remains "pending_review"]
```

---

## Design Section 5: Audit Trail & Reporting

This section details how comprehensive auditing will be maintained and how insights into the balance import and reconciliation process can be generated. This directly addresses the need for a robust and traceable system.

**Goals:**

- Ensure an immutable, detailed record of all balance-related events.
- Provide tools for users to review history and understand changes.
- Enable basic reporting on reconciliation effectiveness.

**Audit Trail (`account_balance_history` Collection):**

- As detailed in Section 1 (Data Model Enhancements), the `account_balance_history` collection will be the cornerstone of the audit trail.
- **Immutability:** Entries in this collection, once written, should not be modified. If a correction is needed, a new entry reflecting the correction and its reason should be added.
- **Comprehensive Logging:** Every significant event will be logged:
  - **Import Events:** `event_type: "imported_{source}"` (e.g., "imported_eb_api", "imported_email", "imported_manual_entry"). Includes `raw_source_data`.
  - **Auto-Reconciliation Events:** `event_type: "reconciled_auto"`. When the system automatically updates a balance without discrepancies.
  - **Discrepancy Detection Events:** `event_type: "discrepancy_detected"`. When a conflict is found. Includes `discrepancy_details`.
  - **User Resolution Events:**
    - `event_type: "reconciled_user_choice"` (User chose a source value).
    - `event_type: "reconciled_manual_override"` (User entered a manual value).
    - `event_type: "discrepancy_acknowledged"` (User acknowledged a discrepancy without resolving it).
      These events will include `user_id`, `old_balance`, `new_balance`, and `discrepancy_details` (if applicable).

**User Interface for History Review:**

- A new UI component (e.g., within the account details view or a dedicated history tab) will allow users to view the `account_balance_history` for a specific account.
- This view should present history entries in a clear, chronological order, showing:
  - Timestamp of the event.
  - Event type.
  - Relevant balance values (old/new).
  - Source of the event.
  - Details of any discrepancies or user actions.

**Reporting & Analytics:**

- **Reconciliation Status Report:** A simple report/dashboard could show:
  - Number of accounts with `status: "reconciled"`.
  - Number of accounts with `status: "pending_review"` / `discrepancy_unresolved"`.
  - Breakdown of discrepancies by `source_1` vs `source_2`.
  - Average time to resolve discrepancies.
- **Import Success/Failure Rates:** Track how often imports from each source are successful vs. result in a discrepancy or failure.
- **Data Accuracy Metrics:** Over time, analyze the `account_balance_history` to identify patterns in `event_type: "reconciled_user_choice"` or `event_type: "reconciled_manual_override"` to understand which sources are most often corrected.

**System Level Audit:**

- Standard Cloud Function logging (Stackdriver/Cloud Logging) will capture execution details, errors, and warnings from all Cloud Functions involved in the import and cross-validation process. This will be critical for debugging and monitoring the system's health.
