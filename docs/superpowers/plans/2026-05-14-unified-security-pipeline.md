# Unified Security Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current CodeQL-based security workflow with a consolidated, open-source pipeline using Trivy, Bandit, and Semgrep.

**Architecture:** Sequential "Guardian" approach in a single GitHub Actions job. It scans dependencies first, then Python-specific vulnerabilities, and finally performs a global SAST scan.

**Tech Stack:** GitHub Actions, Trivy (OSS), Bandit, Semgrep OSS.

---

### Task 1: Setup Exclusions and Project Files

**Files:**

- Create: `.semgrepignore`
- Create: `.bandit.yaml` (optional but recommended for clarity)

- [ ] **Step 1: Create .semgrepignore**
      Create a `.semgrepignore` file at the root to avoid scanning irrelevant directories.

```text
node_modules/
venv/
.venv/
dist/
tests/
archive/
public/dist/
```

- [ ] **Step 2: Create .bandit.yaml**
      Create a basic configuration for Bandit to exclude test directories.

```yaml
### Bandit configuration file

# Exclude directories
exclude_dirs:
  - 'tests'
  - 'venv'
  - '.venv'
  - 'node_modules'

# Skip low severity issues
skips: ['B101'] # Skip assert checks if used in non-test code (common in this project)
```

- [ ] **Step 3: Commit setup files**

```bash
git add .semgrepignore .bandit.yaml
git commit -m "chore(security): add semgrep and bandit exclusion rules"
```

---

### Task 2: Implement Consolidated Workflow

**Files:**

- Modify: `.github/workflows/security.yml`

- [ ] **Step 1: Replace security.yml content**
      Overwrite `.github/workflows/security.yml` with the consolidated "The Guardian" pipeline.

```yaml
name: Security Analysis (The Guardian)

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 5 * * 1' # Every Monday at 5:00 AM
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: security-${{ github.ref }}
  cancel-in-progress: true

jobs:
  security-scan:
    name: Consolidated Security Audit
    runs-on: ubuntu-latest
    timeout-minutes: 20

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      # --- 1. DEPENDENCY SCAN (Trivy) ---
      - name: Run Trivy Vulnerability Scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          ignore-unfixed: true
          format: 'table'
          exit-code: '1' # Fail on vulnerabilities
          severity: 'CRITICAL,HIGH'

      # --- 2. PYTHON SAST (Bandit) ---
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install Bandit
        run: pip install bandit

      - name: Run Bandit Scan
        run: bandit -r . -c .bandit.yaml -ll

      # --- 3. GLOBAL SAST (Semgrep) ---
      - name: Semgrep OSS Scan
        run: |
          docker run --rm -v "${{ github.workspace }}:/src" returntocorp/semgrep semgrep \
          --config=p/default \
          --config=p/typescript \
          --config=p/react \
          --config=p/python \
          --error \
          --exclude 'tests/' \
          --exclude 'node_modules/'
```

- [ ] **Step 2: Commit workflow change**

```bash
git add .github/workflows/security.yml
git commit -m "feat(security): consolidate security pipeline with Trivy, Bandit and Semgrep"
```

---

### Task 3: Verification

- [ ] **Step 1: Verify file existence**
      Ensure all files are in place.
      Run: `ls -a .semgrepignore .bandit.yaml .github/workflows/security.yml`

- [ ] **Step 2: Instruction for user**
      Since I cannot trigger GitHub Actions directly from the CLI:
      "Please push these changes to GitHub and manually trigger the 'Security Analysis (The Guardian)' workflow from the Actions tab to verify the implementation."
