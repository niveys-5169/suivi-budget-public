# Infrastructure & Design System Alignment Implementation Plan

> **For Gemini:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Align the root layout, ambient glows, and Tailwind configuration with the `DESIGN_SYSTEM.md` foundation.

**Architecture:**

- Centralize all design system tokens in `public/src/tailwind.css` using the `@theme` block (Tailwind CSS v4).
- Add fixed background layers and ambient glows to `public/index.html`.
- Bridge legacy CSS variables (`--bg`, `--card`, etc.) to the new Tailwind tokens to maintain backward compatibility.

**Tech Stack:** Tailwind CSS v4, React.

---

### Task 1: Reconcile Design System Tokens in Tailwind CSS

**Files:**

- Modify: `public/src/tailwind.css`

**Step 1: Update `@theme` block with canonical tokens**
Replace existing `@theme` content with the full list from `DESIGN_SYSTEM.md` (ink, gold, platinum, ruby, glass).

**Step 2: Define base styles and legacy bridge**
Set `body` background to `ink` and update `:root` variables to map legacy vars to new Tailwind tokens.

**Step 3: Define component utilities**
Add `.glass-panel` and `.premium-container` classes using `@utility`.

**Step 4: Verify build**
Run: `npm run build`
Expected: Successful build without CSS errors.

**Step 5: Commit**

```bash
git add public/src/tailwind.css
git commit -m "style: align tailwind theme with unified design system"
```

### Task 2: Update HTML Foundation & Ambient Glows

**Files:**

- Modify: `public/index.html`

**Step 1: Inject ambient glows and fixed background**
Add the `-z-10` and `-z-20` layers right after `<body>` as specified in `DESIGN_SYSTEM.md`.

**Step 2: Add Fraunces and JetBrains Mono fonts**
Update the Google Fonts link in the `<head>` to include `Fraunces` and `JetBrains Mono`.

**Step 3: Verify visually (simulated)**
Check `index.html` structure for correct layering.

**Step 4: Commit**

```bash
git add public/index.html
git commit -m "style: add ambient glows and premium typography to root layout"
```
