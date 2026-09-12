# AURUM Rebranding Implementation Plan

> **For Gemini:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform "Suivi-Budget" into "AURUM — Banque Privée" with a premium dark luxury aesthetic, focused on Playfair Display typography and a refined color palette.

**Architecture:**

1. Update foundation (Tailwind, Fonts, Global CSS).
2. Refactor layout shell (Logo, Header, BottomNav).
3. Update core financial components (Balance Cards, Transaction lists).
4. Verify via regression and component tests.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Lucide Icons, Vitest.

---

### Task 1: Setup Foundation (Fonts & Tailwind)

**Files:**

- Create: `public/fonts/` (Placeholder or instructions)
- Modify: `tailwind.config.js`
- Modify: `public/index.html`
- Modify: `DESIGN_SYSTEM.md`

**Step 1: Update Tailwind Config with AURUM tokens**

```javascript
// tailwind.config.js
module.exports = {
  // ... existing
  theme: {
    extend: {
      colors: {
        ink: {
          deep: '#0B0B14',
          surface: '#121622',
          lighter: '#1C2130',
        },
        aurum: {
          gold: '#D4AF37',
          gold_muted: 'rgba(212, 175, 55, 0.08)',
        },
        platinum: {
          DEFAULT: '#EDEDED',
          muted: 'rgba(237, 237, 237, 0.1)',
        },
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'serif'],
        sans: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
      },
    },
  },
};
```

**Step 2: Update index.html for Font Loading**

```html
<!-- public/index.html -->
<link
  href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&family=Playfair+Display:wght@600;700&display=swap"
  rel="stylesheet"
/>
```

_(Note: Using Google Fonts temporarily for speed, can be local later as requested)_

**Step 3: Update DESIGN_SYSTEM.md**

Update the document to reflect the new tokens and typography rules.

**Step 4: Commit**
`git add . && git commit -m "style: setup AURUM foundation (colors, fonts, design system)"`

---

### Task 2: Refactor Global Shell (Logo & Header)

**Files:**

- Modify: `public/src/components/DashboardNavigation.tsx` (Assuming it holds the logo/header)
- Modify: `public/src/app.js` (Check where "Suivi-Budget" text is hardcoded)

**Step 1: Implement AURUM Logo in Header**

Replace existing title with `<h1 className="font-serif text-2xl font-bold text-aurum-gold tracking-wider">AURUM</h1>`.

**Step 2: Remove "Bonjour" and unwanted greeting elements**

Remove any greeting logic as requested.

**Step 3: Commit**
`git add . && git commit -m "feat: implement AURUM branding in header and remove legacy greetings"`

---

### Task 4: Refactor Bottom Navigation

**Files:**

- Modify: `public/src/components/BottomNav.tsx`

**Step 1: Update Icons and Styles**

```tsx
// Apply lucide stroke-1, aurum-gold for active state, and platinum/30 for inactive.
// Labels: text-[9px] font-black uppercase tracking-[0.2em]
```

**Step 2: Commit**
`git add . && git commit -m "style: refresh BottomNav with AURUM aesthetics"`

---

### Task 5: Redesign BalanceCard

**Files:**

- Modify: `public/src/components/BalanceCard.tsx`
- Create: `tests/components/BalanceCard.test.tsx`

**Step 1: Write failing component test**

Verify that BalanceCard uses `font-serif` for the amount and `bg-ink-surface` for the card.

**Step 2: Update BalanceCard implementation**

- Background: `bg-ink-surface`
- Amount: `font-serif text-2xl font-semibold text-platinum`
- Corners: `rounded-2xl`
- Status: Use `aurum-gold` for "OK".

**Step 3: Run tests**
`npm test tests/components/BalanceCard.test.tsx`

**Step 4: Commit**
`git add . && git commit -m "feat: redesign BalanceCard with premium AURUM style"`

---

### Task 6: Regression Testing & Final Polish

**Files:**

- Modify: `tests/app_regression.test.ts`

**Step 1: Run all tests to ensure no breakage**
`npm test`

**Step 2: Final cleanup of "Suivi-Budget" strings**
Search and replace any remaining legacy branding.

**Step 3: Commit**
`git add . && git commit -m "test: final regression check and cleanup"`
