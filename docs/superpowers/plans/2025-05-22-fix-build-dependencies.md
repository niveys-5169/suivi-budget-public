# Fix Build Dependencies Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the project dependencies and Vite configuration to allow `npm run build` to pass.

**Architecture:** Install missing React and TypeScript dependencies, and configure `@vitejs/plugin-react` in `vite.config.js`.

**Tech Stack:** React, TypeScript, Vite

---

### Task 1: Install Dependencies

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Install React and React-DOM**
      Run: `npm install react react-dom`

- [ ] **Step 2: Install Development Dependencies**
      Run: `npm install -D typescript @types/react @types/react-dom @vitejs/plugin-react`

- [ ] **Step 3: Verify package.json**
      Check that the new dependencies are present in `package.json`.

---

### Task 2: Configure Vite

**Files:**

- Modify: `vite.config.js`

- [ ] **Step 1: Update vite.config.js to use React plugin**
      Update the file to import and use `@vitejs/plugin-react`.

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: 'public',
  server: {
    port: 3000,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      'Cross-Origin-Embedder-Policy': 'unsafe-none',
    },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
```

---

### Task 3: Initialize TypeScript Configuration (if missing)

**Files:**

- Create: `tsconfig.json`

- [ ] **Step 1: Check if tsconfig.json exists**
      Run: `ls tsconfig.json`

- [ ] **Step 2: Create basic tsconfig.json if missing**
      If it doesn't exist, create it with basic React/Vite settings.

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ESNext"],
    "allowJs": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["public/src"]
}
```

---

### Task 4: Verify Build

**Files:**

- Run: `npm run build`

- [ ] **Step 1: Run the build command**
      Run: `npm run build`

- [ ] **Step 2: Fix any further dependency errors**
      If the build fails with missing types or other dependency issues, address them.

- [ ] **Step 3: Confirm build success**
      Verify that the `dist` directory is created and contains the build artifacts.
