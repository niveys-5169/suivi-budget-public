# Feature Flags Guide

Suivi-Budget uses **Vite environment variables** for feature flags. Flags are **compile-time** (not runtime), meaning unused code is completely removed from the bundle.

---

## Available Flags

| Flag                 | Purpose                                                         | Current Status |
| -------------------- | --------------------------------------------------------------- | -------------- |
| `VITE_ANALYSE_PAGE`  | New Analyse tab with donut charts (Entrées/Sorties/Récurrences) | `false`        |
| `VITE_BUDGET_BANKIN` | Bankin-style Budget redesign (grid + category detail pages)     | `false`        |
| `VITE_BOTTOMNAV_V2`  | Updated bottom nav with Analyse tab                             | `false`        |

---

## Development Setup

### 1. Create `.env.local`

```bash
# .env.local (Git-ignored, local dev only)
VITE_ANALYSE_PAGE=false
VITE_BUDGET_BANKIN=false
VITE_BOTTOMNAV_V2=false
```

Start with all `false`. Override as needed per task.

### 2. Using Flags in Code

**Always import from `lib/featureFlags.ts`:**

```tsx
import { FLAGS } from '@/lib/featureFlags';

export const BudgetsPage: React.FC = () => {
  if (FLAGS.BUDGET_BANKIN) {
    return <BankinBudgetMain />;
  }
  return <LegacyBudgetPage />;
};
```

**No string comparisons** (`import.meta.env.VITE_* === 'true'`). Always use the centralized `FLAGS` object.

### 3. Testing in Dev

#### Enable a flag without rebuild:

```js
// Browser console
localStorage.setItem('flags', JSON.stringify({ BUDGET_BANKIN: true }));
window.location.reload();
```

#### Or import the helper function:

```tsx
import { setDevFlag } from '@/lib/featureFlags';

// In component or console:
setDevFlag('BUDGET_BANKIN', true); // reloads page automatically
```

#### Check current flags:

```js
console.log(JSON.parse(localStorage.getItem('flags')));
```

---

## Deployment Lifecycle

### Phase 1: Development (Local)

```bash
# .env.local
VITE_BUDGET_BANKIN=false
```

- Old code runs in prod
- New code dormant
- Dev tests with localStorage override

### Phase 2: Staging Rollout

```bash
# Firebase Hosting (staging environment) via .env or CI/CD
VITE_BUDGET_BANKIN=true
```

- 100% of staging users see new UI
- Monitor logs, collect feedback

### Phase 3: Production Rollout

```bash
# Firebase Hosting (production environment) via .env or CI/CD
VITE_BUDGET_BANKIN=true
```

- New code live for all users
- Monitor error rates, performance
- Wait 1 week for stability

### Phase 4: Cleanup

- Remove the conditional code (keep only new path)
- Delete the flag from `.env` files
- Remove `FLAGS.BUDGET_BANKIN` from code
- PR: "Remove BUDGET_BANKIN feature flag (stable)"

---

## Setting Flags in CI/CD

### GitHub Actions / Cloud Build

```yaml
# .github/workflows/deploy.yml or Firebase config
env:
  VITE_BUDGET_BANKIN: 'true'
  VITE_ANALYSE_PAGE: 'false'
```

### Firebase Hosting

```bash
# firebase.json
{
  "hosting": {
    "env": [
      { "name": "VITE_BUDGET_BANKIN", "value": "true" }
    ]
  }
}
```

Or via Firebase CLI:

```bash
firebase hosting:channel:deploy staging \
  --env VITE_BUDGET_BANKIN=true
```

---

## Code Review Checklist

When reviewing a PR that adds a flag:

- [ ] Flag is declared in `lib/featureFlags.ts`
- [ ] Flag is added to `.env.local` and `.env.production` (both start with `false`)
- [ ] Code has `if (FLAGS.FLAGNAME)` pattern (not string comparison)
- [ ] Old path is kept in `else` or explicit fallback
- [ ] TypeScript builds without warnings
- [ ] Bundle size check: old code should be tree-shaken when flag is `false`

```bash
# Verify tree-shaking:
npm run build
grep -r "LegacyBudgetPage" dist/  # Should NOT appear if new flag is true
```

---

## Troubleshooting

### Flag not being read?

1. Check `.env.local` is in repo root (not `public/`)
2. Stop dev server (`npm run dev`) and restart
3. Clear browser cache: DevTools → Application → Cache Storage → Clear

### localStorage override not working?

1. Check console: `console.log(import.meta.env.DEV)` should be `true`
2. Must be in dev mode (not prod build)
3. Reload page after setting: `window.location.reload()`

### Tree-shaking not working?

1. Rebuild: `npm run build`
2. Check Rollup output: unused code should disappear
3. If still there, flag may be read at runtime (❌ wrong pattern)

---

## Best Practices

✅ **DO:**

- Keep flags simple (boolean, no logic inside the flag value)
- Group related flags (all Bankin migration flags start with `VITE_BUDGET_*`)
- Document each flag's purpose in this file
- Deprecate old flags as soon as new code is stable
- Test both paths (flag `true` and `false`) before merging

❌ **DON'T:**

- Use flags for runtime feature toggles (use `FLAGS` const, not `import.meta.env` directly)
- Compare flag strings: `import.meta.env.VITE_X === 'true'` (always use `FLAGS.X`)
- Add flags without going through formal ADR/approval process
- Leave flags in code after they're no longer needed

---

## Example: Adding a New Flag

1. **ADR:** Document the decision in a new ADR or update ADR-001
2. **Code:** Add to `lib/featureFlags.ts`:
   ```ts
   export const FLAGS = {
     // ... existing
     MY_NEW_FEATURE: import.meta.env.VITE_MY_NEW_FEATURE === 'true',
   } as const;
   ```
3. **Env files:** Add to `.env.local` and `.env.production`:
   ```
   VITE_MY_NEW_FEATURE=false
   ```
4. **Implementation:** Use in code:
   ```tsx
   if (FLAGS.MY_NEW_FEATURE) {
     // new code
   } else {
     // old code
   }
   ```
5. **Testing:** Test both paths locally with localStorage override
6. **Review:** PR requires sign-off from lead engineer
7. **Rollout:** Follow lifecycle phases above
8. **Cleanup:** Remove flag once stabilized
