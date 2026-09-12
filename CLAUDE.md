# 🤖 Claude Project Instructions

## 📌 Single Source of Truth

**Refer to `GEMINI.md` for ALL project rules, tech stack, and mandatory workflows.**

## 🏗 Architectural Context

Before any modification, read **`docs/ARCH_STATE.md`** to distinguish between legacy code (to be migrated) and the new Premium UI (React/TS).

## 🛠 Project Standards

- **Design System:** Follow `DESIGN_SYSTEM.md` strictly (Gold/Ink theme).
- **Types:** Use `public/src/types/banking.types.ts` for all data structures.
- **Components:** Logic in `public/src/hooks/`, UI in `public/src/components/`.
- **Naming:** Use French for business logic/labels where appropriate, English for code.

## 🚀 Common Commands

- **Install:** `npm install`
- **Dev:** `npm run dev`
- **Build:** `npm run build`
- **Test:** `npm test` (Frontend) / `pytest` (Backend)
- **Lint:** `npm run lint`

## 📝 Workflow

1. Follow **Agent Rules** in `GEMINI.md`.
2. Propose a plan before implementation.
3. Ensure "Zero Warning" in TypeScript and ESLint.
4. Verify changes with tests.

## 🧠 Engineering Principles

These four principles apply to every change, on top of the project standards above.

### 1. Think Before Coding

Don't assume. Don't hide confusion. Surface tradeoffs.

- **State assumptions explicitly** — If uncertain, ask rather than guess.
- **Present multiple interpretations** — Don't pick silently when ambiguity exists.
- **Push back when warranted** — If a simpler approach exists, say so.
- **Stop when confused** — Name what's unclear and ask for clarification.

### 2. Simplicity First

Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If 200 lines could be 50, rewrite it.

The test: would a senior engineer say this is overcomplicated? If yes, simplify.

### 3. Surgical Changes

Touch only what you must. Clean up only your own mess.

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.
- Remove imports/variables/functions that **your** changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

Define success criteria. Loop until verified.

Transform imperative tasks into verifiable goals:

| Instead of…      | Transform to…                                          |
| ---------------- | ------------------------------------------------------ |
| "Add validation" | "Write tests for invalid inputs, then make them pass." |
| "Fix the bug"    | "Write a test that reproduces it, then make it pass."  |
| "Refactor X"     | "Ensure tests pass before and after."                  |

For multi-step tasks, state a brief plan with explicit verification:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let the work loop independently. Weak criteria ("make it work") require constant clarification.

---

_Updated: 2026-07-04 — Correction des chemins `public/src/`._
