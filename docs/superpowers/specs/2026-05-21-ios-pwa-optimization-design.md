# iOS PWA & Mobile Optimization Design

## Goal

Optimize "Suivi-Budget" for a native-like experience on iOS (standalone mode) while preserving the desktop UI integrity. Target iOS 17.4+ and iOS 18 features (Safe Areas, Dynamic Island integration, and Safari zoom prevention).

## Current State

- `index.html` has some Apple meta tags but lacks `viewport-fit=cover` and a manifest link.
- `manifest.json` is missing.
- `Dashboard.tsx` (in `public/src/components/dashboard/`) uses fixed padding that doesn't account for iOS Safe Areas.
- Input fields (100+ instances) use various sizes that trigger Safari's auto-zoom on mobile.

## Proposed Design

### 1. Global Mobile Typography (Safe Input Zoom)

Instead of modifying 100+ files, we will use a global CSS rule in `public/src/style.css`.

- **Logic**: Use a media query `(max-width: 768px)` to target mobile devices.
- **Rule**: Force `font-size: 16px` on `input`, `select`, and `textarea` to prevent Safari from zooming in on focus.
- **Desktop**: Remains untouched as it will use the default/Tailwind classes (typically 14px/text-sm).

### 2. Web App Manifest (`public/manifest.json`)

- **Metadata**: Set `name`, `short_name`, `start_url`, `display: standalone`.
- **Orientation**: `portrait` for mobile.
- **Colors**: Background and Theme set to Ink-Deep (`#0A0A0B`).
- **Icons**:
  - `icon.svg` (any)
  - `icon-1024.png` (512x512 equivalent)
  - `icon-maskable-512.png` (maskable)

### 3. Entry Point Enhancements (`public/index.html`)

- **Viewport**: Update to `width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=1`.
- **Manifest**: `<link rel="manifest" href="/manifest.json">`.
- **Status Bar**: Ensure `black-translucent` is set for integration with the Dynamic Island.

### 4. Layout Optimization (`public/src/components/dashboard/Dashboard.tsx`)

Update the root container to handle safe areas:

- **Top Padding**: `pt-[calc(env(safe-area-inset-top)+1.5rem)]` on mobile, `md:pt-6` on desktop.
- **Bottom Padding**: `pb-[calc(env(safe-area-inset-bottom)+2rem)]` on mobile, `md:pb-32` on desktop.
- **Navigation**: Verify that bottom-fixed elements (if any) use `env(safe-area-inset-bottom)`.

## Success Criteria

- [ ] No auto-zoom on iPhone when tapping any input.
- [ ] UI extends behind the status bar (Dynamic Island) without overlapping content.
- [ ] Application installs as a PWA with correct icon and splash screen.
- [ ] **Zero change** visible on Desktop/Laptop views.
