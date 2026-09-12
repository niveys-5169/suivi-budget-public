# Design Spec: Unified Security Pipeline (The Guardian)

**Status:** Draft
**Author:** Gemini CLI
**Date:** 2026-05-14

## 1. Overview

Implement a comprehensive, open-source security scanning pipeline for the Suivi-Budget project, replacing the current CodeQL-based setup. The pipeline follows a sequential "Guardian" approach: Dependency Scan -> Python SAST -> Global SAST (TypeScript/React + Python).

## 2. Goals

- Eliminate dependency on paid CodeQL for private repo.
- Consolidate all security checks into a single GitHub Action workflow.
- Ensure coverage for both Frontend (TypeScript/React) and Backend (Python).
- Fail fast: stop execution if critical vulnerabilities are found in early stages.

## 3. Architecture (The Guardian Approach)

The workflow will consist of a single job with sequential steps:

1.  **Checkout:** Standard code checkout.
2.  **Dependency Scan (Trivy):** Scans `package.json`, `requirements.txt`, and `functions/requirements.txt`. Fails on `CRITICAL,HIGH`.
3.  **Python SAST (Bandit):** Focused scan on Python files in `functions/`, `src/`, and `scripts/`. Fails on medium/high severity.
4.  **Global SAST (Semgrep):** Deep scan of TypeScript (`public/src/`) and Python logic using community-vetted rules.
5.  **Legacy Cleanup:** This replaces the existing `security.yml` to avoid redundancy.

## 4. Tools & Configuration

### 4.1. Trivy (Dependency Audit)

- **Target:** Root and subdirectories.
- **Severity Filter:** `CRITICAL,HIGH`.
- **Exit Code:** 1 on match.

### 4.2. Bandit (Python Security)

- **Scope:** `functions/`, `src/`, `scripts/`.
- **Level:** `-ll` (Medium/High).
- **Exclude:** `tests/`, `venv/`.

### 4.3. Semgrep (Logic Scan)

- **Configs:** `p/default`, `p/typescript`, `p/python`, `p/react`.
- **Path Exclusions:** `node_modules/`, `venv/`, `tests/`, `dist/`.

## 5. Implementation Plan (High Level)

1.  Create `.semgrepignore` to prevent false positives.
2.  Replace `.github/workflows/security.yml` with the new consolidated config.
3.  Verify the workflow by running it via `workflow_dispatch`.

## 6. Testing & Validation

- Manually trigger the workflow.
- Inspect logs to ensure all layers (Node, Root Python, Functions Python) are scanned.
- Confirm that existing `npm audit` and `pip-audit` logic is effectively covered by Trivy.
