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

**Mise à jour : 13 octobre 2026.** Pour une rotation ou un incident, suivre
[Google Secret Manager — exploitation et dépannage](runtime-secrets.md), qui
fait référence pour les formats, le redéploiement et le nettoyage. GitHub et
Secret Manager sont deux stockages distincts : modifier GitHub ne remplace
pas un secret Google existant.

## 1. Vue d'ensemble

| Secret                                                                                                                                                 | Utilisé par                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `FIREBASE_CREDENTIALS`                                                                                                                                 | `deploy-functions.yml`, `main.yml`, `linxo-poll.yml`, `tronity-import.yml`, `cleanup-tronity-duplicates.yml` |
| `GOOGLE_TOKEN`                                                                                                                                         | `deploy-functions.yml`, `main.yml`, `linxo-poll.yml`                                                         |
| `PAT_GITHUB_SECRET`                                                                                                                                    | `deploy-functions.yml` (bootstrap de `GITHUB_DISPATCH_TOKEN` dans Secret Manager)                            |
| `EB_APP_ID`, `EB_PRIVATE_KEY`                                                                                                                          | `deploy-functions.yml` (bootstrap Secret Manager), `banking-preflight.yml` (contrôle direct)                 |
| `TRONITY_CLIENT_ID`, `TRONITY_CLIENT_SECRET`, `TRONITY_VEHICLE_ID`, `TRONITY_COMPTE`, `TRONITY_HOME_LAT`, `TRONITY_HOME_LON`, `TRONITY_HOME_RADIUS_KM` | `tronity-import.yml`                                                                                         |

`EB_APP_ID` et `EB_PRIVATE_KEY` sont les identifiants serveur Enable Banking.
Configurer aussi les variables GitHub `EB_REDIRECT_URL`, `EB_APP_URL` et
`EB_MODE` selon [la mise en service bancaire](enable-banking.md). Les sessions
et affectations courantes sont gérées par le backend ; ce ne sont pas des
secrets à recréer lors d’une rotation Gmail ou GitHub.

Prérequis pour la suite :

- Droit **Admin** sur ce dépôt GitHub (pour écrire des secrets).
- Accès **Owner ou Editor** sur le projet Firebase `suivi-budget-ab888`.
- Droits nécessaires sur le client OAuth, le topic Pub/Sub et Secret Manager du même projet **`suivi-budget-ab888`**. L’ancien projet `moonlit-app-455605-k7` n’est plus la cible Gmail Push.
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

Pour Gmail Push, le client OAuth et le topic sont désormais dans
`suivi-budget-ab888` : aucune configuration vers l’ancien projet `moonlit-app`
ne doit être appliquée pour rétablir le fonctionnement courant. Suivre
[Gmail Pub/Sub](GMAIL_PUBSUB_SETUP.md) pour les droits du publisher et de
l’identité OIDC, et [Secret Manager](runtime-secrets.md) pour les droits de
déploiement et Secret Accessor. Les droits administrateur listés ci-dessus
ne sont pas des droits à donner au navigateur ou au runtime par défaut ;
leur périmètre doit être revu selon le moindre privilège.

## 3. `GOOGLE_TOKEN` — jeton OAuth Gmail

Suivre le [pas-à-pas Windows du guide Secret Manager](runtime-secrets.md#remplacer-le-jeton-gmail--windowspowershell).
Il couvre le JSON client **`credentials.json`**, le script `generate_token.py`,
la révocation préalable en cas de remplacement, les deux copies et les tests.

- Projet du client OAuth : **`suivi-budget-ab888`** ; type _Application de bureau_.
- `GOOGLE_TOKEN` dans GitHub : contenu **JSON brut complet** de `token.json`.
- `GMAIL_TOKEN` dans Google : ce même contenu encodé **une fois en base64**.
- Premier bootstrap : le workflow crée le secret Google seulement s’il est absent.
- Rotation : ajouter explicitement une version Google, puis redéployer ; ne pas
  s’arrêter à la mise à jour GitHub.
- Supprimer les fichiers temporaires et vider le presse-papiers après validation.

## 4. `PAT_GITHUB_SECRET` — jeton d'accès personnel GitHub

Utilisé côté serveur par les Cloud Functions pour déclencher des événements
`repository_dispatch` (boutons « Rafraîchir » du dashboard, cf.
`dispatch_github_workflow` dans `functions/`).

1. GitHub → menu profil → **Settings → Developer settings → Personal access
   tokens → Fine-grained tokens → Generate new token**.
2. Le limiter à ce dépôt (`niveys-5169/suivi-budget-public`), avec une expiration
   et **Contents: Read and write**, permission requise pour `repository_dispatch`.
   Ne pas ajouter Actions write sans autre besoin identifié.
   [Permission officielle GitHub](https://docs.github.com/en/rest/repos/repos#create-a-repository-dispatch-event).
3. Générer et enregistrer le PAT **brut** dans `PAT_GITHUB_SECRET`.
4. Pour une rotation, ajouter aussi une version du PAT brut dans
   `GITHUB_DISPATCH_TOKEN` (Secret Manager), redéployer et tester, puis révoquer
   l’ancien PAT et nettoyer son ancienne version. Voir [la procédure](runtime-secrets.md#github).

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
3. Si **Configure runtime secrets** ou **Provision Gmail Pub/Sub** échoue,
   distinguer problème IAM, version Google désactivée/détruite et configuration
   OAuth/topic. Ne pas supposer un problème cross-projet historique ; utiliser
   [le tableau de dépannage](runtime-secrets.md#en-cas-de-souci).
4. Si le déploiement Cloud Functions lui-même échoue sur un rôle IAM manquant,
   l'erreur `gcloud`/`firebase` nomme le rôle exact à ajouter (`add-iam-policy-binding`
   comme au §2).
5. Une fois `deploy-functions.yml` vert, vérifier les références Secret Manager
   et le trafic Cloud Run. Tester `linxo-poll.yml`, renouveler le watch puis
   vérifier son état Firestore et les notifications. Ces tests ont des effets
   réels ; consulter [la procédure](runtime-secrets.md).
6. Tester séparément `tronity-import.yml` si les identifiants Tronity ont changé ;
   ce n’est pas nécessaire pour une rotation Gmail seule.

## 7. Checklist

- [ ] `FIREBASE_CREDENTIALS`
- [ ] Rôles IAM du compte de service sur `suivi-budget-ab888` (§2)
- [ ] Client OAuth Gmail et topic Pub/Sub dans `suivi-budget-ab888`, identités correctement autorisées
- [ ] `GOOGLE_TOKEN`
- [ ] `PAT_GITHUB_SECRET`
- [ ] `EB_APP_ID`, `EB_PRIVATE_KEY`, variables `EB_REDIRECT_URL`, `EB_APP_URL`, `EB_MODE`
- [ ] Quatre secrets d’exécution Google initialisés ; bonne version `ENABLED` et droits Secret Accessor
- [ ] `TRONITY_CLIENT_ID`
- [ ] `TRONITY_CLIENT_SECRET`
- [ ] `TRONITY_VEHICLE_ID`
- [ ] `TRONITY_COMPTE`
- [ ] `TRONITY_HOME_LAT`
- [ ] `TRONITY_HOME_LON`
- [ ] `TRONITY_HOME_RADIUS_KM`
- [ ] `deploy-functions.yml` vert sur `workflow_dispatch`
- [ ] Versions réellement utilisées et trafic vérifiés ; tests applicatifs réussis avant tout nettoyage
