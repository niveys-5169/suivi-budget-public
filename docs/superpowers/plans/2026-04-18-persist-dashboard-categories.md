# Plan: Backend Multi-Device Dashboard Category Persistence

**Date:** 2026-04-18  
**Branch:** `claude/persist-dashboard-categories-XvikU`

---

## Goal

Enable users' selected dashboard categories to persist across devices and browser sessions by storing preferences in Firestore and syncing them in real-time.

---

## Scope

### In scope

- Store selected dashboard categories in Firestore at `users/{uid}/preferences/dashboardCategories`
- Create new `usePreferences` hook to manage Firestore sync
- Modify `useDashboard` to load/save categories via Firestore
- Use localStorage as offline cache layer for instant UX
- Real-time sync: changes on one device appear on others
- Error handling following existing app patterns (try-catch, console.error, error state)
- Support both web and future mobile apps via same backend

### Out of scope

- Persisting other dashboard state (period, monthKey, customRange) — save only categories
- UI for manual sync/conflict resolution — auto-sync on load and on changes
- Analytics/audit trail for category changes — focus on current selection only
- Multi-user sharing of preferences — each user has own preferences

---

## Implementation Steps

### Step 1: Create `usePreferences` hook

**File:** `/public/src/hooks/usePreferences.tsx`  
**Purpose:** Centralized hook for loading/saving user preferences to Firestore

**What it does:**

- Load `users/{uid}/preferences` document on mount (with localStorage fallback)
- Expose `dashboardCategories` state and setter
- Auto-save to Firestore when `dashboardCategories` changes (debounced ~500ms)
- Handle offline mode: update localStorage immediately, queue Firestore write
- Real-time listener: subscribe to preference changes on other devices
- Error handling: console.error + state, don't break UI on failure

**Dependencies:**

- `useAuth()` — get current user.uid
- `db` from Firebase service

**Key functions to export:**

- `usePreferences()` → `{ dashboardCategories, setDashboardCategories, loading, error }`

### Step 2: Modify `useDashboard` hook

**File:** `/public/src/hooks/useDashboard.tsx`

**Changes:**

- Replace `useState<Set<string>>` for `selectedCategories` with call to `usePreferences()`
- Remove lines 43-47 (the "initialize if empty" effect) — let `usePreferences` handle initialization
- Keep `setSelectedCategories` so components don't break
- Update comment on line 31 to note that persistence is now in `usePreferences`

**Dependencies:**

- Import new `usePreferences` hook

### Step 3: Create Firestore schema migration

**File:** `/public/src/services/firestoreMigrations.ts`  
**Purpose:** Ensure user preferences document exists (run on first auth)

**What it does:**

- Check if `users/{uid}/preferences` exists
- If not, create with empty `dashboardCategories: []`
- Handle permission errors gracefully (user not authorized yet)

**Called from:**

- `useAuth` hook after successful sign-in OR
- `usePreferences` hook on first mount if missing

### Step 4: Update Firestore security rules

**File:** (Firebase Console or rules file in repo if it exists)

**New rules needed:**

```
match /users/{uid}/preferences {
  allow read, write: if request.auth.uid == uid;
}
```

This ensures users can only read/write their own preferences.

### Step 5: Add localStorage cache layer to `usePreferences`

**File:** `/public/src/hooks/usePreferences.tsx` (same as Step 1)

**What it does:**

- On load: try Firestore first (with timeout), fallback to localStorage
- On change: write to localStorage immediately (instant UI), then to Firestore (async)
- Key: `dashboard_categories_${uid}`
- Format: JSON array of category strings

### Step 6: Handle offline + online transitions

**File:** `/public/src/hooks/usePreferences.tsx` (same as Step 1)

**What it does:**

- Listen to browser `online`/`offline` events
- When coming online: force Firestore sync from localStorage
- Sync queue: if writes fail, retry with exponential backoff (2s, 4s, 8s, 16s)
- User sees: "Syncing..." indicator during offline writes

### Step 7: Add error boundary / UI feedback

**File:** Consider if needed based on Step 6 — may add to `DashboardSection.tsx`

**What it does:**

- Show toast/banner if Firestore sync fails persistently
- Message: "Les catégories ne se synchronisent pas actuellement" (French, matches app style)
- Don't block UI — preferences still work locally

---

## Files to Create or Modify

| File                                         | Action                | Purpose                                                               |
| -------------------------------------------- | --------------------- | --------------------------------------------------------------------- |
| `public/src/hooks/usePreferences.tsx`        | **Create**            | New hook for Firestore preference sync + localStorage fallback        |
| `public/src/hooks/useDashboard.tsx`          | **Modify**            | Use `usePreferences()` instead of `useState()` for selectedCategories |
| `public/src/services/firestoreMigrations.ts` | **Create**            | Ensure user pref doc exists in Firestore                              |
| `public/src/services/firebase.ts`            | **Modify** (optional) | Export migration function if creating migrations file                 |
| `firestore.rules`                            | **Modify**            | Add security rules for `users/{uid}/preferences`                      |
| `.github/workflows/*` or docs                | **Modify** (optional) | Document the new Firestore collection structure                       |

---

## Risks and Mitigations

| Risk                                                                               | Mitigation                                                                 |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **Firestore read quota exceeded** if real-time listeners are too chatty            | Debounce writes (500ms), use single listener not multiple                  |
| **Stale data on client**: changes on device A don't appear on device B immediately | Real-time listener with `onSnapshot()` solves this — updates within 100ms  |
| **Offline → Online sync loses changes**                                            | Store in localStorage while offline, retry when online                     |
| **User deletes all categories**                                                    | Initialize with all categories on first mount (same as current behavior)   |
| **Security**: user A reads/writes user B's preferences                             | Firestore rules restrict to `request.auth.uid == uid`                      |
| **Breaking change**: existing apps rely on empty initial state\*\*                 | Initialize with all categories (backward compatible with current behavior) |
| **Slow network**: Firestore write takes 3+ seconds, UI lags\*\*                    | Write to localStorage first (instant), Firestore async doesn't block       |

---

## Open Questions

Before starting implementation:

1. **Should we migrate existing RavConfig to same preferences doc?**
   - Yes: cleaner structure, one preferences document per user
   - No: focus only on categories, RavConfig is separate feature

   **Recommendation:** Not now — scope is categories only. RavConfig can follow same pattern later.

2. **Should dashboard category selections be synced in real-time to other open tabs/windows on same device?**
   - Yes: add `StorageEvent` listener for localStorage changes
   - No: each tab is independent

   **Recommendation:** Yes — add it in Step 5 for better UX.

3. **What happens if user is not authenticated?**
   - Fallback to localStorage only
   - Show warning that preferences won't sync across devices

   **Recommendation:** Fallback to localStorage silently (matches current behavior).

4. **Should we expose `isLoading`, `error` from `usePreferences` for UI feedback?**
   - Yes: show "Syncing..." indicator
   - No: silent sync, don't burden component developers

   **Recommendation:** Yes, expose `{ dashboardCategories, setDashboardCategories, loading, error, isSyncing }`

---

## Rollback Plan

If issues arise:

1. **Revert to localStorage-only:** Comment out Firestore sync in `usePreferences`, keep localStorage
2. **Revert to reset-on-load:** Replace `usePreferences()` with old `useState()` in `useDashboard`
3. **Delete Firestore data:** Drop `users` collection (safe — no other data there yet)

---

## Estimation

- Step 1 (usePreferences hook): **2-3 hours** (main complexity: offline handling, retry logic)
- Step 2 (useDashboard modification): **30 minutes**
- Step 3 (firestoreMigrations): **1 hour**
- Step 4 (Firestore rules): **15 minutes**
- Step 5 (localStorage cache): **1 hour** (part of Step 1)
- Step 6 (offline handling): **1 hour** (part of Step 1)
- Step 7 (error UI): **1 hour** (optional)
- Testing (manual + unit): **2 hours**

**Total: ~8-9 hours** (can be done in 1-2 focused sessions)

---

## Success Criteria

✓ User selects 55 categories on mobile  
✓ Close app, open on desktop  
✓ Desktop loads same 55 categories  
✓ Update on desktop, mobile syncs within 1 second  
✓ Works offline: select categories, come online, they persist to Firestore  
✓ Error on Firestore write doesn't break UI  
✓ Clear console of errors, proper error messages
