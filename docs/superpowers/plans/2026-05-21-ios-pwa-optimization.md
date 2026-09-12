# iOS PWA Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement iOS PWA standards (Safe Areas, Safari zoom prevention, Standalone mode) while preserving desktop UI.

**Architecture:** Global CSS overrides for mobile, specific manifest configuration, and responsive Tailwind classes for Safe Areas.

**Tech Stack:** React, Tailwind CSS, PWA Manifest, CSS Media Queries.

---

### Task 1: Create Web App Manifest

**Files:**

- Create: `public/manifest.json`

- [ ] **Step 1: Create manifest.json with standard iOS PWA properties**

```json
{
  "name": "AURUM — Banque Privée",
  "short_name": "AURUM",
  "description": "Gestion de patrimoine et budget premium.",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#0A0A0B",
  "theme_color": "#0A0A0B",
  "icons": [
    {
      "src": "/icon.svg",
      "sizes": "any",
      "type": "image/svg+xml"
    },
    {
      "src": "/icons/icon-1024.png",
      "sizes": "1024x1024",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-maskable-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
```

- [ ] **Step 2: Commit manifest**

```bash
git add public/manifest.json
git commit -m "feat(pwa): add web app manifest for iOS standalone mode"
```

---

### Task 2: Update index.html for iOS Standards

**Files:**

- Modify: `public/index.html`

- [ ] **Step 1: Update viewport and add manifest link**

```html
<!-- Replace existing viewport and theme-color -->
<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=1"
/>
<link rel="manifest" href="/manifest.json" />
```

- [ ] **Step 2: Verify Apple tags**
      Ensure `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />` is present.

- [ ] **Step 3: Commit changes**

```bash
git add public/index.html
git commit -m "feat(pwa): update index.html with viewport-fit=cover and manifest link"
```

---

### Task 3: Global CSS for Safari Zoom Prevention

**Files:**

- Modify: `public/src/style.css`

- [ ] **Step 1: Add mobile-only font-size override**

```css
@media (max-width: 768px) {
  input,
  select,
  textarea {
    font-size: 16px !important;
  }
}
```

- [ ] **Step 2: Commit changes**

```bash
git add public/src/style.css
git commit -m "style(mobile): prevent Safari auto-zoom by forcing 16px font on inputs"
```

---

### Task 4: Responsive Dashboard Safe Areas

**Files:**

- Modify: `public/src/components/dashboard/Dashboard.tsx`

- [ ] **Step 1: Update root motion.div classes**
      Replace `className="min-h-screen bg-ink-deep text-white font-sans pb-32"` with:

```tsx
className =
  'min-h-screen bg-ink-deep text-white font-sans pt-[calc(env(safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+2rem)] md:pt-0 md:pb-32';
```

- [ ] **Step 2: Adjust header padding**
      Modify the `<header>` class to account for the new root padding:

```tsx
<header className="flex items-center justify-between px-5 py-5 md:pt-6">
```

- [ ] **Step 3: Commit changes**

```bash
git add public/src/components/dashboard/Dashboard.tsx
git commit -m "feat(ui): add iOS safe area support to Dashboard layout"
```
