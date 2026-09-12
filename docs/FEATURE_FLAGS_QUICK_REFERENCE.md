# Feature Flags — Quick Reference (For Developers)

**TL;DR:** Use `FLAGS.FLAGNAME` in your code. Flags are compile-time, so old code disappears from bundle when flag is `true`.

---

## How It Works (In 30 seconds)

```
Development (.env.local)
  VITE_BUDGET_BANKIN=false
  ↓
  if (FLAGS.BUDGET_BANKIN) { <NEW> } else { <OLD> }  ← runs <OLD>
  ↓
  Build includes both <NEW> and <OLD> code (~50 kB extra)

Production (.env.production)
  VITE_BUDGET_BANKIN=true   ← (after Phase 2, initially false)
  ↓
  if (FLAGS.BUDGET_BANKIN) { <NEW> } else { <OLD> }  ← compiles to:
  if (true) { <NEW> } else { <OLD> }  ← Rollup removes dead <OLD>
  ↓
  Build only includes <NEW> code (50 kB saved)
```

---

## Using Flags (Copy-Paste Template)

### 1. Import

```typescript
import { FLAGS } from '@/lib/featureFlags';
```

### 2. Use

```tsx
export const BudgetsPage: React.FC = () => {
  if (FLAGS.BUDGET_BANKIN) {
    // NEW Bankin-style code
    return <BankinBudgetMain {...props} />;
  }

  // OLD legacy code (default)
  return <LegacyBudgetPage {...props} />;
};
```

### 3. Optional: Single Flag Check

```tsx
// Simpler if only one branch needed
{
  FLAGS.ANALYSE_PAGE && <AnalyseSection />;
}
```

---

## Testing Flags Locally

### Enable a flag without rebuild:

```javascript
// Paste in browser console:
localStorage.setItem('flags', JSON.stringify({ BUDGET_BANKIN: true }));
window.location.reload();
```

### Or import the helper:

```typescript
// In your component or console:
import { setDevFlag } from '@/lib/featureFlags';
setDevFlag('BUDGET_BANKIN', true); // auto-reloads
```

### Check current status:

```javascript
console.log(JSON.parse(localStorage.getItem('flags')));
```

---

## Current Flags

| Flag                  | Description                                      | Default |
| --------------------- | ------------------------------------------------ | ------- |
| `FLAGS.ANALYSE_PAGE`  | New Analyse tab with Entrées/Sorties/Récurrences | `false` |
| `FLAGS.BUDGET_BANKIN` | Bankin-style Budget grid + detail pages          | `false` |
| `FLAGS.BOTTOMNAV_V2`  | Updated 5-tab bottom nav                         | `false` |

---

## Environment Files

### `.env.local` (your machine, Git-ignored)

```bash
VITE_ANALYSE_PAGE=false
VITE_BUDGET_BANKIN=false
VITE_BOTTOMNAV_V2=false
```

Change `false` → `true` to enable during development.

### `.env.production` (production defaults, committed)

```bash
VITE_ANALYSE_PAGE=false
VITE_BUDGET_BANKIN=false
VITE_BOTTOMNAV_V2=false
```

CI/CD or Firebase Hosting env vars override this during deployment.

---

## Rollout Timeline

```
┌─────────────────────────────────────────────┐
│ Phase 1: DEV (Your machine)                 │
│ Flag = false in .env.local                  │
│ Old code runs by default                    │
│ Test new code via localStorage override     │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ Phase 2: STAGING (Firebase staging env)     │
│ Flag = true in Firebase env vars            │
│ Staging users see new code                  │
│ Monitor, QA, collect feedback               │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ Phase 3: PRODUCTION (Firebase prod env)     │
│ Flag = true in Firebase env vars            │
│ All users see new code                      │
│ Monitor for 1 week                          │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ Phase 4: CLEANUP (Remove flag)              │
│ Delete if/else conditional                  │
│ Delete flag from .env files                 │
│ Delete FLAGS.BUDGET_BANKIN reference        │
│ Merge cleanup PR                            │
└─────────────────────────────────────────────┘
```

---

## Common Mistakes (Don't Do These)

❌ **Wrong:**

```typescript
if (import.meta.env.VITE_BUDGET_BANKIN === 'true') { ... }
```

→ Not imported from central location; harder to refactor

❌ **Wrong:**

```typescript
const flags = import.meta.env.VITE_*;  // Can't glob env vars
```

→ Define flags explicitly in `featureFlags.ts`

❌ **Wrong:**

```typescript
if (FLAGS.BUDGET_BANKIN) {
  // New code
}
// Missing else → old code never runs
```

→ Always keep the old path as fallback until flag is removed

✅ **Right:**

```typescript
import { FLAGS } from '@/lib/featureFlags';

if (FLAGS.BUDGET_BANKIN) {
  return <BankinBudget />;
}
return <LegacyBudget />;
```

---

## Debugging

### Flag isn't being read?

```bash
# Check .env.local exists in repo root
ls -la .env.local

# Restart dev server
npm run dev

# Clear browser cache (DevTools → Storage → Clear All)
```

### Tree-shaking not working?

```bash
# Build and inspect output
npm run build
grep -r "LegacyCode" dist/

# If found when flag=true, your code reads it at runtime
# Fix: use const FLAGS, not import.meta.env directly
```

### localStorage override isn't working?

```javascript
// Must be in dev mode
console.log(import.meta.env.DEV); // Should be true

// Check stored value
console.log(localStorage.getItem('__flags_override'));

// Reload after setting
window.location.reload();
```

---

## Examples in the Codebase

Once implemented, see:

- `public/src/components/budgets-v2/BudgetsPage.tsx` — wraps BankinBudgetMain with flag
- `public/src/components/analyse/AnalyseSection.tsx` — wrapped with flag (when created)
- `public/src/components/BottomNav.tsx` — conditional 5th nav item

---

## Questions?

Refer to:

- **How?** → `docs/FEATURE_FLAGS.md` (detailed guide)
- **Why?** → `docs/adr/001-bankin-frontend-migration.md` (decision record)
- **What to build?** → `docs/IMPLEMENTATION_CHECKLIST.md` (phase-by-phase)
