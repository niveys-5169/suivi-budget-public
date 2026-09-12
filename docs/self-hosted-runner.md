# Runner self-hosted (laptop Windows 11) — Suivi-Budget & SuiviPortefeuille

## Périmètre

Jobs qualité/CI/tests basculables sur le laptop via la variable de dépôt
`CI_RUNNER` :

| Dépôt             | Workflow                  | Job           | Repli (si `CI_RUNNER` absente) |
| ----------------- | ------------------------- | ------------- | ------------------------------ |
| Suivi-Budget      | `frontend-ci.yml`         | `quality`     | `ubuntu-24.04-arm`             |
| Suivi-Budget      | `e2e.yml`                 | `smoke`       | `ubuntu-24.04-arm`             |
| Suivi-Budget      | `test-reconciliation.yml` | `test-python` | `ubuntu-latest`                |
| SuiviPortefeuille | `ci.yml`                  | `validate`    | `ubuntu-latest`                |
| SuiviPortefeuille | `lighthouse.yml`          | `lighthouse`  | `ubuntu-latest`                |

Restent sur GitHub-hosted (secrets Firebase/GCP, ou crons devant tourner
laptop éteint) : `deploy.yml`, `deploy-functions.yml`, `collect.yml`,
`main.yml`, `linxo-poll.yml`, `eb-import.yml`, `tronity-import.yml`,
`semgrep.yml`, `python-security.yml`, `security.yml`, et le job `coverage` de
`test-reconciliation.yml`.

## Installation sur le laptop Windows 11 (~30 min)

### 1. Outils (PowerShell en administrateur)

```powershell
winget install --id Git.Git -e --source winget
winget install --id Google.Chrome -e --source winget   # requis par Lighthouse
winget install --id Python.Python.3.11 -e --source winget
```

Node n'est pas à installer : `actions/setup-node` télécharge les versions
demandées par les workflows. Rouvrir PowerShell, puis vérifier :

```powershell
git --version
bash --version
python --version
```

Si `bash` ne répond pas, ajouter `C:\Program Files\Git\bin` au `PATH` système.

### 2. Config Git

```powershell
git config --system core.longpaths true
git config --system core.autocrlf false
```

### 3. Empêcher la mise en veille (secteur uniquement)

```powershell
powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0
```

### 4. Exclusion Windows Defender (optionnel, recommandé)

```powershell
Add-MpPreference -ExclusionPath "C:\r"
```

### 5. Installer les runners — Suivi-Budget

Aller sur `Settings → Actions → Runners → New self-hosted runner` (Windows,
x64) sur `https://github.com/niveys-5169/Suivi-Budget`. Suivre les commandes
affichées par GitHub (token valable 1h) dans `C:\r\budget-1`, puis configurer :

```powershell
.\config.cmd --url https://github.com/niveys-5169/Suivi-Budget `
  --token <TOKEN_AFFICHÉ_PAR_GITHUB> `
  --name budget-1 `
  --labels laptop-win `
  --work _w `
  --runasservice `
  --windowslogonaccount "$env:USERDOMAIN\$env:USERNAME"
```

Important : faire tourner le service sous le compte utilisateur (pas
`NETWORK SERVICE`), sinon pas d'accès à `%LOCALAPPDATA%` ni à Chrome.

Vérifier que le runner apparaît **Idle** avec le label `laptop-win`.

### 6. Runners parallèles

La matrice `quality` a 5 jobs parallèles. Répéter l'étape 5 dans
`C:\r\budget-2` et `C:\r\budget-3` (même label `laptop-win`, nouveau token
à chaque fois).

### 7. SuiviPortefeuille

Même procédure depuis
`https://github.com/niveys-5169/SuiviPortefeuille/settings/actions/runners`,
dans `C:\r\portefeuille-1` (et `-2`), même label `laptop-win`.

### 8. Activer la bascule

Ne créer la variable `CI_RUNNER` (valeur `laptop-win`) dans les deux dépôts
qu'après un run de non-régression vert sur GitHub-hosted (voir Vérification
ci-dessous). Tant qu'elle n'existe pas, les runners restent inactifs et la CI
ne change pas.

## Vérification

1. Pousser sans définir `CI_RUNNER` → tout doit rester vert sur
   GitHub-hosted (valide que les `shell: bash` et le changement de chemin
   Playwright n'ont rien cassé côté Linux).
2. Définir `CI_RUNNER=laptop-win` dans Suivi-Budget.
3. `workflow_dispatch` sur **Frontend CI** → vérifier que les 5 jobs
   atterrissent sur le runner nommé et que `format:check` ne remonte pas
   d'erreurs de fins de ligne.
4. `workflow_dispatch` sur **E2E Smoke** → vérifier `PLAYWRIGHT_BROWSERS_PATH`,
   l'install sans `--with-deps`, et le `webServer` Vite sous Windows.
5. `workflow_dispatch` sur **Test Reconciliation** → si `pytest` échoue sous
   Windows sur des chemins, corriger les tests, pas le workflow.
6. Définir `CI_RUNNER` dans SuiviPortefeuille, ouvrir une PR touchant `src/`
   (seul déclencheur de `ci.yml`/`lighthouse.yml`). Vérifier que `lhci
autorun` trouve Chrome (sinon définir `CHROME_PATH` sur le runner).
7. Tester le repli : supprimer `CI_RUNNER`, relancer un workflow, confirmer
   le retour sur GitHub-hosted.
