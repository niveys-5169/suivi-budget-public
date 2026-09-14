# Configuration des secrets GitHub Actions (dépôt public)

## Contexte

`suivi-budget-public` est un **snapshot** publié à partir du dépôt privé
d'origine (voir le commit « Initial public release »). La publication ne
recopie jamais les secrets GitHub Actions : ils doivent être recréés à la
main sur ce nouveau dépôt. Tant que ce n'est pas fait, tous les workflows qui
parlent à GCP/Gmail/Tronity échouent — en particulier `deploy-functions.yml`,
qui échoue dès l'étape `Authenticate gcloud` avec :

```
google-github-actions/auth failed with: the GitHub Action workflow must specify
exactly one of "workload_identity_provider" or "credentials_json"!
```

Ce guide liste, workflow par workflow, les secrets à recréer et comment
obtenir chaque valeur.

## 1. Vue d'ensemble

| Secret                                                                                                                                                 | Utilisé par                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `FIREBASE_CREDENTIALS`                                                                                                                                 | `deploy-functions.yml`, `main.yml`, `linxo-poll.yml`, `tronity-import.yml`, `cleanup-tronity-duplicates.yml` |
| `GOOGLE_TOKEN`                                                                                                                                         | `deploy-functions.yml`, `main.yml`, `linxo-poll.yml`                                                         |
| `PAT_GITHUB_SECRET`                                                                                                                                    | `deploy-functions.yml` (injecté aux Cloud Functions, pas utilisé côté CI lui-même)                           |
| `TRONITY_CLIENT_ID`, `TRONITY_CLIENT_SECRET`, `TRONITY_VEHICLE_ID`, `TRONITY_COMPTE`, `TRONITY_HOME_LAT`, `TRONITY_HOME_LON`, `TRONITY_HOME_RADIUS_KM` | `tronity-import.yml`                                                                                         |

`EB_APP_ID` / `EB_PRIVATE_KEY` / `EB_SESSIONS` / `EB_ACCOUNT_MAPPING` (Enable
Banking, mentionnés dans le README) ne sont consommés par **aucun** workflow
GitHub Actions actuel — hors périmètre de ce guide.

Prérequis pour la suite :

- Droit **Admin** sur ce dépôt GitHub (pour écrire des secrets).
- Accès **Owner ou Editor** sur le projet Firebase `suivi-budget-ab888`.
- Accès **Owner** sur le projet OAuth `moonlit-app-455605-k7` (pour Gmail Push, cf. `docs/GMAIL_PUBSUB_SETUP.md`).
- [`gcloud` CLI](https://cloud.google.com/sdk/docs/install) installé et authentifié (`gcloud auth login`) pour les commandes IAM ci-dessous.

Où ajouter les secrets, à chaque étape ci-dessous : **Settings → Secrets and
variables → Actions → New repository secret**, sur `github.com/niveys-5169/suivi-budget-public`.

## 2. `FIREBASE_CREDENTIALS` — clé du compte de service

1. Console Firebase → projet `suivi-budget-ab888` → ⚙️ **Paramètres du
   projet** → onglet **Comptes de service**.
2. Cliquer **Générer une nouvelle clé privée** → confirmer → un fichier JSON
   se télécharge (compte `firebase-adminsdk-fbsvc@suivi-budget-ab888.iam.gserviceaccount.com`).
3. ⚠️ Ne jamais committer ce fichier. Ouvrir son contenu, le copier tel
   quel (JSON complet) dans le secret GitHub `FIREBASE_CREDENTIALS`, puis
   supprimer le fichier local.

Rôles nécessaires sur ce compte de service (au-delà du rôle par défaut) pour
que `deploy-functions.yml` aille jusqu'au bout :

```bash
PROJECT=suivi-budget-ab888
SA=firebase-adminsdk-fbsvc@suivi-budget-ab888.iam.gserviceaccount.com

# Déploiement des Cloud Functions 2e génération (Cloud Run + Artifact Registry + Eventarc)
gcloud projects add-iam-policy-binding $PROJECT --member="serviceAccount:$SA" --role="roles/cloudfunctions.admin"
gcloud projects add-iam-policy-binding $PROJECT --member="serviceAccount:$SA" --role="roles/run.admin"
gcloud projects add-iam-policy-binding $PROJECT --member="serviceAccount:$SA" --role="roles/artifactregistry.admin"
gcloud projects add-iam-policy-binding $PROJECT --member="serviceAccount:$SA" --role="roles/eventarc.admin"
gcloud projects add-iam-policy-binding $PROJECT --member="serviceAccount:$SA" --role="roles/iam.serviceAccountUser"
gcloud projects add-iam-policy-binding $PROJECT --member="serviceAccount:$SA" --role="roles/storage.admin"
```

Si l'étape de déploiement échoue avec `Permission denied` sur le trigger
Firestore `trigger_balance_reconciliation`, l'Eventarc Service Agent a besoin
de droits supplémentaires : voir `docs/history/GCP_CREDENTIALS_SETUP_FIX.md`
(déjà rencontré et corrigé une fois sur ce projet).

Pour que Gmail Push fonctionne (étape « Provision Gmail Pub/Sub » du même
workflow), ce même compte de service a aussi besoin de droits **cross-projet**
sur `moonlit-app-455605-k7` : suivre l'« Option A » de
`docs/GMAIL_PUBSUB_SETUP.md` (deux commandes `gcloud`, à faire une seule fois
par un Owner de ce projet OAuth).

## 3. `GOOGLE_TOKEN` — jeton OAuth Gmail

1. Dans [Google Cloud Console](https://console.cloud.google.com/apis/credentials),
   projet `moonlit-app-455605-k7` → **APIs & Services → Identifiants** →
   récupérer (ou créer) un **ID client OAuth** de type _Application de bureau_,
   et télécharger son fichier JSON sous le nom `credentials.json`.
2. En local, à la racine du dépôt :
   ```bash
   pip install google-auth-oauthlib
   python scripts/generate_token.py
   ```
3. Le script ouvre un serveur local sur le port 8080 et affiche un lien :
   l'ouvrir dans un navigateur, se connecter avec le compte Gmail à surveiller,
   accepter l'accès demandé (`gmail.modify`).
4. Un fichier `token.json` est généré. Copier tout son contenu dans le secret
   GitHub `GOOGLE_TOKEN`.
5. Supprimer `credentials.json` et `token.json` en local (ne jamais les
   committer — déjà exclus par `.gitignore`, à vérifier si doute).

## 4. `PAT_GITHUB_SECRET` — jeton d'accès personnel GitHub

Utilisé côté serveur par les Cloud Functions pour déclencher des événements
`repository_dispatch` (boutons « Rafraîchir » du dashboard, cf.
`dispatch_github_workflow` dans `functions/`).

1. GitHub → menu profil → **Settings → Developer settings → Personal access
   tokens → Fine-grained tokens → Generate new token**.
2. Le limiter à ce dépôt (`niveys-5169/suivi-budget-public`), avec les
   permissions **Contents: Read and write** et **Actions: Read and write**
   (nécessaire pour déclencher `repository_dispatch`).
3. Générer, copier le jeton, l'ajouter comme secret GitHub `PAT_GITHUB_SECRET`.

## 5. Secrets `TRONITY_*`

Depuis le tableau de bord développeur Tronity (application liée au véhicule
suivi) :

- `TRONITY_CLIENT_ID`, `TRONITY_CLIENT_SECRET` — identifiants de l'app OAuth Tronity.
- `TRONITY_VEHICLE_ID` — identifiant du véhicule à suivre.
- `TRONITY_COMPTE` — nom du compte interne (Firestore) où affecter les recharges importées.
- `TRONITY_HOME_LAT`, `TRONITY_HOME_LON` — coordonnées GPS du domicile.
- `TRONITY_HOME_RADIUS_KM` — rayon (km) autour du domicile pour distinguer une recharge « domicile » d'une recharge externe.

## 6. Vérifier

Une fois tous les secrets ajoutés :

1. **Actions → Deploy → Firebase Cloud Functions → Run workflow** (bouton
   `workflow_dispatch`, branche `main`) plutôt que d'attendre un vrai push.
2. Vérifier que l'étape **Authenticate gcloud** passe au vert.
3. Si l'étape **Provision Gmail Pub/Sub** échoue, c'est le binding IAM
   cross-projet (§2, dernier paragraphe) qui manque encore — le job affiche
   le correctif exact dans ses logs.
4. Si le déploiement Cloud Functions lui-même échoue sur un rôle IAM manquant,
   l'erreur `gcloud`/`firebase` nomme le rôle exact à ajouter (`add-iam-policy-binding`
   comme au §2).
5. Une fois `deploy-functions.yml` vert, tester `linxo-poll.yml` et
   `tronity-import.yml` en `workflow_dispatch` manuel pour confirmer que
   `GOOGLE_TOKEN` / `FIREBASE_CREDENTIALS` / `TRONITY_*` sont correctement lus.

## 7. Checklist

- [ ] `FIREBASE_CREDENTIALS`
- [ ] Rôles IAM du compte de service sur `suivi-budget-ab888` (§2)
- [ ] Droits cross-projet Gmail Push sur `moonlit-app-455605-k7` (`docs/GMAIL_PUBSUB_SETUP.md`)
- [ ] `GOOGLE_TOKEN`
- [ ] `PAT_GITHUB_SECRET`
- [ ] `TRONITY_CLIENT_ID`
- [ ] `TRONITY_CLIENT_SECRET`
- [ ] `TRONITY_VEHICLE_ID`
- [ ] `TRONITY_COMPTE`
- [ ] `TRONITY_HOME_LAT`
- [ ] `TRONITY_HOME_LON`
- [ ] `TRONITY_HOME_RADIUS_KM`
- [ ] `deploy-functions.yml` vert sur `workflow_dispatch`
