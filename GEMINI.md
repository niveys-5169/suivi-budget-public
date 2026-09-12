# 🧠 Gemini CLI — Project Context & Rules

## 📌 Project Overview

**Suivi-Budget** is a high-end personal finance manager (Premium Banking Dashboard).

- **Target:** Private Client aesthetics (Revolut Metal, N26 Metal style).
- **Core Goal:** Transitioning from legacy HTML/JS to a unified React/TypeScript/Firebase architecture.

## ⚖️ Instruction Priority (Hierarchy)

In case of contradictory instructions, follow this priority:

1. **User Directives (Highest):** Direct requests and project instructions (this file, `GEMINI.md`).
2. **Extension Skills:** Superpowers skills and their defaults.
3. **Global Context (Lowest):** System prompt defaults and global memories.

## 🛠 Gemini CLI Tool Mapping

When skills reference Claude Code tools, use these equivalents:

- `Skill` tool -> `activate_skill`
- `Read` -> `read_file`
- `Write` -> `write_file`
- `Edit` -> `replace`
- `Bash` -> `run_shell_command`
- `Grep` -> `grep_search`
- `Glob` -> `glob`

## 🛠 Tech Stack

- **Frontend:** React 18, TypeScript, Tailwind CSS, Framer Motion, Lucide Icons.
- **Backend:** Firebase (Firestore, Functions in Python), Google Apps Script (Bridge).
- **Testing:** Vitest, React Testing Library, Pytest (Backend).

## 📐 Architecture Principles

1. **Component Driven:** UI in `public/src/components/`, logic in `public/src/hooks/`.
2. **Strict Typing:** All data structures must be in `public/src/types/banking.types.ts`.
3. **Design System:** Rigorous adherence to `DESIGN_SYSTEM.md` (Gold #D4AF37, Ink #0B0B14).
4. **AI-Friendly:** Keep modules small (<150 lines), use explicit types, and avoid "magic" logic.
5. **PWA & Web Parity:** Whenever an UI/UX modification is made, ALWAYS verify if the feature exists in multiple views (e.g., a Mobile Panel vs a Desktop Page). You MUST ensure the change is applied to both the PWA and Normal views unless explicitly instructed otherwise. Use global searches on hooks/routes to find all touchpoints before implementation.

## 🤖 Agent Rules (Mandatory Workflows)

> **Mandate:** Invoke relevant skills **BEFORE** any response or action (Rule: 1% chance = activate). Always start with `using-superpowers`.

| Situation                  | Mandatory Skill(s)                                  |
| -------------------------- | --------------------------------------------------- |
| **Any task start**         | `using-superpowers`                                 |
| **New Feature / Creative** | `brainstorming` -> `writing-plans`                  |
| **Bug/Fix**                | `systematic-debugging`                              |
| **Implementation**         | `test-driven-development`                           |
| **Completion**             | `verification-before-completion` -> `code-reviewer` |
| **PR / Branch Wrap-up**    | `finishing-a-development-branch`                    |

## 📂 Context Management

- **Legacy Files:** Ignore `old_*.js` (in `archive/`).
- **Primary Source of Truth:** `public/src/types/`, `DESIGN_SYSTEM.md`, and `docs/plans/2026-04-22-*`.

---

_Last Updated: 2026-07-04 (Correction des chemins `public/src/`)_
