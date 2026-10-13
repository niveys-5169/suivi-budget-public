# Google Secret Manager — exploitation et dépannage

**Mise à jour : 13 octobre 2026.** Ce guide est la référence pour les secrets
d’exécution Gmail, GitHub et Enable Banking. Il ne contient aucune valeur secrète.

## Où sont les secrets et quel format utiliser ?

- Projet Google Cloud/Firebase : **`suivi-budget-ab888`**.
- Région des fonctions : **`europe-west1`**.
- Le client OAuth Gmail et le topic Pub/Sub sont dans ce même projet.
  `moonlit-app-455605-k7` est l’ancien projet : ne pas y créer le nouveau client.
- [Secrets GitHub Actions](https://github.com/niveys-5169/suivi-budget-public/settings/secrets/actions).
- [Google Secret Manager](https://console.cloud.google.com/security/secret-manager?project=suivi-budget-ab888).

| Usage                      | Nom dans GitHub Actions | Nom dans Secret Manager | Format GitHub                                  | Format Secret Manager                            |
| -------------------------- | ----------------------- | ----------------------- | ---------------------------------------------- | ------------------------------------------------ |
| Gmail/Linxo                | `GOOGLE_TOKEN`          | `GMAIL_TOKEN`           | JSON OAuth complet, brut                       | Le même JSON encodé **une seule fois en base64** |
| Déclenchement GitHub       | `PAT_GITHUB_SECRET`     | `GITHUB_DISPATCH_TOKEN` | PAT brut                                       | Le même PAT brut, **sans base64**                |
| Identifiant Enable Banking | `EB_APP_ID`             | `EB_APP_ID`             | Identifiant brut                               | Identifiant brut                                 |
| Clé privée Enable Banking  | `EB_PRIVATE_KEY`        | `EB_PRIVATE_KEY`        | Clé PEM complète, retours à la ligne conservés | Même clé PEM                                     |

Les copies GitHub servent au bootstrap et, pour Gmail ou Enable Banking, à des
workflows qui les consomment directement. Les fonctions déployées utilisent
Secret Manager, pas les valeurs actuelles des secrets GitHub.

**Changer seulement GitHub ne remplace pas un secret déjà présent dans Google.**
**Ajouter une version dans Google ne suffit pas : il faut ensuite redéployer.**
Les valeurs ne doivent jamais être ajoutées à `functions/.env.suivi-budget-ab888`,
au bundle navigateur, à un commit, à une capture d’écran ou à un journal.
Base64 n’est pas un chiffrement : la valeur encodée est également secrète.

## Ce que fait un déploiement normal

`.github/workflows/deploy-functions.yml` appelle
`.github/scripts/bootstrap_runtime_secret.py` pour les quatre secrets :

1. Seul un `NOT_FOUND` explicite autorise la création initiale depuis GitHub.
2. Si le secret existe, la **dernière version créée** doit être `ENABLED`.
3. Une erreur IAM, réseau ou de lecture bloque le déploiement : elle ne signifie
   jamais que le secret est absent.
4. Une version existante est conservée ; aucune rotation n’est faite à chaque
   déploiement. Le log attendu est `existing enabled version preserved`.
5. Firebase lie les fonctions aux secrets déclarés dans leurs décorateurs.
   Vérifier le numéro effectivement déployé plutôt que supposer que `latest`
   suffit. Les numéros ne sont pas les mêmes pour tous les secrets.

Déclarés dans `functions/src/banking_secrets.py`, les `SecretParam` sont lus via
la propriété `.value`. Gmail est ensuite décodé de base64 vers JSON.

| Fonctions                                                                                    | Secrets liés                                 |
| -------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `import_linxo_transactions`, `gmail_watch_handler`, `setup_gmail_watch`, `renew_gmail_watch` | `GMAIL_TOKEN`                                |
| `dispatch_github_workflow`                                                                   | `GITHUB_DISPATCH_TOKEN`                      |
| `eb_list_banks`, `eb_auth_start`, `eb_auth_callback`                                         | `EB_APP_ID`, `EB_PRIVATE_KEY`                |
| `sync_banking`, `scheduled_banking_sync`                                                     | `EB_APP_ID`, `EB_PRIVATE_KEY`, `GMAIL_TOKEN` |

Le compte de déploiement doit pouvoir lire les métadonnées et les versions,
créer le secret au bootstrap et configurer l’accès nécessaire. Le compte
d’exécution a besoin de `roles/secretmanager.secretAccessor` sur les seuls
secrets requis. Une connexion locale `gcloud`, une authentification Firebase
CLI et l’identité GitHub Actions sont distinctes : un succès dans l’une ne
prouve pas que les autres ont les bons droits. Ne pas résoudre un refus IAM
en accordant systématiquement Owner sur tout le projet.

## Remplacer le jeton Gmail — Windows/PowerShell

### 1. Préparer le client OAuth et le dossier local

Ouvrir [Google Auth Platform → Clients](https://console.cloud.google.com/auth/clients?project=suivi-budget-ab888).
Choisir le client Gmail de type **Application de bureau**, ou en créer un de
ce type si nécessaire. Ne pas modifier les clients Web de Firebase Auth.
Télécharger son JSON et le nommer exactement **`credentials.json`**, avec le
`s`. Ce fichier n’est ni le jeton Gmail ni la clé de service Firebase.

Depuis la racine du clone du dépôt, dans PowerShell :

```powershell
$repoPath = (Get-Location).Path
if (-not (Test-Path -LiteralPath "$repoPath\scripts\generate_token.py")) {
    throw "Ouvrir PowerShell a la racine du depot avant de continuer."
}
$gmailWorkDir = Join-Path $env:USERPROFILE 'Downloads\rotation-gmail'
New-Item -ItemType Directory -Path $gmailWorkDir -Force | Out-Null
```

Placer `credentials.json` dans ce dossier, hors du dépôt. Installer si besoin
`google-auth-oauthlib` avec `py -m pip install google-auth-oauthlib`. Si le lanceur
`py` est absent, utiliser un Python installé contenant cette dépendance, par
exemple le Python du `.venv` du projet. Ne pas recopier un chemin de worktree
temporaire provenant d’une ancienne session.

### 2. Invalider l’ancien accès Google avant la nouvelle autorisation

Pour remplacer un jeton potentiellement exposé, préparer d’abord les étapes
suivantes, puis retirer l’accès de l’application concernée depuis
[les connexions du compte Google](https://myaccount.google.com/connections),
sur le compte Gmail utilisé pour Linxo. Identifier l’application par son nom
dans Google Auth Platform → Branding ; ne pas retirer une application au hasard.

**Prévoir une interruption des imports Gmail entre cette révocation et la remise
en service.** La révocation Google peut invalider les jetons de tous les clients
du même projet pour ce compte, y compris un jeton nouvellement créé.
Ne pas révoquer l’ancien accès Google après avoir généré le nouveau jeton en
supposant que cela préservera le nouveau. Une révocation déjà faite ne doit pas
être répétée après la rotation. [Règle OAuth Google](https://developers.google.com/identity/protocols/oauth2/native-app#tokenrevoke).

### 3. Générer le nouveau `token.json`

```powershell
Set-Location -LiteralPath $gmailWorkDir
py "$repoPath\scripts\generate_token.py"
```

Ouvrir le lien affiché dans un navigateur normal, se connecter au compte Gmail
recevant Linxo et autoriser `gmail.modify`. Garder PowerShell ouvert jusqu’au
message de réussite. Le script écoute sur le port local 8080 ; ses indications
« Codespaces » ne s’appliquent pas sur le PC local. Il crée `token.json` dans
le dossier courant, et remplace ce fichier s’il existe déjà.

Contrôler sans afficher le jeton :

```powershell
$gmailJson = Get-Content -LiteralPath .\token.json -Raw
$gmailInfo = $gmailJson | ConvertFrom-Json
if (-not $gmailInfo.refresh_token) {
    throw "Jeton de renouvellement absent : ne pas publier ce fichier."
}
```

### 4. Mettre à jour les deux copies

Copier le **JSON brut** pour GitHub :

```powershell
Set-Clipboard -Value $gmailJson
```

Dans les secrets GitHub Actions, modifier **`GOOGLE_TOKEN`**, coller puis
enregistrer. Ne pas créer un secret GitHub nommé `GMAIL_TOKEN` à sa place.

Copier ensuite le même JSON **encodé en base64** pour Google :

```powershell
$gmailBase64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($gmailJson))
Set-Clipboard -Value $gmailBase64
```

Dans Secret Manager, ouvrir **`GMAIL_TOKEN` → Ajouter une nouvelle version**,
coller la valeur et valider. Noter le numéro créé. Garder l’ancienne version
jusqu’aux contrôles ci-dessous, sauf si elle a déjà été détruite.

Alternative Cloud Shell/Git Bash, avec le JSON local protégé et les CLI
Firebase/Google authentifiées ; ne pas exécuter en plus de l’ajout console :

```bash
printf '%s' "$(cat '<chemin-vers-token.json>')" | base64 -w 0 | firebase functions:secrets:set GMAIL_TOKEN --data-file=- --project suivi-budget-ab888 --non-interactive
```

### 5. Redéployer et tester

Dans GitHub : **Actions → Deploy → Firebase Cloud Functions → Run workflow →
branche `main`**, puis attendre la réussite complète. Ou, depuis le clone :

```powershell
gh workflow run deploy-functions.yml --ref main
```

Un déploiement local `firebase deploy --only functions --project
suivi-budget-ab888 --non-interactive` est une alternative pour un opérateur
ayant l’environnement et les droits nécessaires, pas une étape supplémentaire.
Mettre à jour les secrets GitHub ne déclenche pas ce déploiement automatiquement.
Toutes les fonctions consommatrices doivent être redéployées, pas seulement
l’import Linxo. [Règle Firebase](https://firebase.google.com/docs/functions/config-env?gen=2nd#managing_secrets).

Appliquer la section « Vérifier sans afficher les secrets ». Puis :

- Lancer `linxo-poll.yml` manuellement pour tester la copie GitHub, Gmail et
  Firebase. Ce test peut importer de vraies transactions et ajouter les labels
  Gmail habituels. Lire aussi les logs de l’étape d’import : `success` seul ne
  suffit pas, certaines erreurs d’écriture sont journalisées sans faire échouer
  le workflow. `0 emails trouvés à traiter` est normal si rien n’est en attente ;
  cela ne teste pas l’ajout d’une nouvelle transaction.
- Depuis l’application, utiliser **Activer Gmail Watch** dans la maintenance,
  ou déclencher une seule fois le job existant dans Cloud Scheduler :

```powershell
gcloud scheduler jobs run firebase-schedule-renew_gmail_watch-europe-west1 --location=europe-west1 --project=suivi-budget-ab888
```

- Vérifier `metadata/gmail_watch_state` : `lastWatchAttemptAt` est récent,
  `watchExpiration` est future et `lastWatchError` est nul. Le renouvellement
  planifié intercepte les exceptions : un HTTP 200 du job seul ne prouve pas
  le succès. Vérifier également les notifications vers `gmail-watch-handler`
  et leurs réponses HTTP 200. Procédure complète : [Gmail Pub/Sub](GMAIL_PUBSUB_SETUP.md).

### 6. Nettoyer après validation

Appliquer le nettoyage contrôlé ci-dessous. Supprimer ensuite les fichiers
locaux `token.json` et `credentials.json` du dossier dédié, sans supprimer
le dossier Téléchargements. Vider le presse-papiers et les variables :

```powershell
Set-Clipboard -Value ''
Remove-Variable gmailJson,gmailBase64,gmailInfo -ErrorAction SilentlyContinue
```

Ne pas committer ces fichiers. La suppression locale ne garantit pas l’effacement
des copies, sauvegardes ni de l’historique du presse-papiers Windows ; le vider
également s’il est activé.

## Remplacer le PAT GitHub ou les secrets Enable Banking

### GitHub

1. Générer un nouveau PAT pour `niveys-5169/suivi-budget-public`, de préférence
   fine-grained, limité au dépôt avec une expiration. Pour `repository_dispatch`,
   GitHub exige **Contents: Read and write** ; ne pas ajouter d’autres droits
   sans besoin distinct. [Permission requise](https://docs.github.com/en/rest/repos/repos#create-a-repository-dispatch-event).
2. Remplacer `PAT_GITHUB_SECRET` dans GitHub et ajouter une version de
   `GITHUB_DISPATCH_TOKEN` dans Secret Manager : **PAT brut dans les deux cas**.
3. Redéployer depuis `main`, vérifier la référence de `dispatch_github_workflow`,
   puis tester le bouton concerné. Ce test déclenche réellement un workflow.
4. Révoquer l’ancien PAT dans les paramètres GitHub ; détruire l’ancienne version
   Secret Manager seulement après validation. Ces deux opérations sont distinctes.

### Enable Banking

Ne pas régénérer la clé pour résoudre une panne Gmail ou un refus IAM.
Une rotation volontaire doit fournir une paire application/certificat/clé
valide côté Enable Banking, avec une clé PEM conservant ses retours à la ligne.
Mettre à jour les deux stockages, redéployer tous les consommateurs concernés,
vérifier la connexion et la synchronisation, puis nettoyer les anciennes
versions. Voir [Enable Banking](enable-banking.md).

## Vérifier sans afficher les secrets

Prérequis CLI local : `gcloud auth login`, accès au projet et, si utilisés,
`gh auth login` / authentification Firebase CLI. Ne pas afficher le fichier ADC
ou une clé de service pour diagnostiquer une connexion.

Ces commandes lisent uniquement les noms, états et références :

```powershell
gcloud secrets versions list GMAIL_TOKEN --project=suivi-budget-ab888 --format='table(name,state,createTime)'
gcloud secrets versions list GITHUB_DISPATCH_TOKEN --project=suivi-budget-ab888 --format='table(name,state,createTime)'
gcloud secrets versions list EB_APP_ID --project=suivi-budget-ab888 --format='table(name,state,createTime)'
gcloud secrets versions list EB_PRIVATE_KEY --project=suivi-budget-ab888 --format='table(name,state,createTime)'

gcloud functions describe import_linxo_transactions --gen2 --region=europe-west1 --project=suivi-budget-ab888 --format='yaml(state,serviceConfig.secretEnvironmentVariables)'
gcloud functions describe dispatch_github_workflow --gen2 --region=europe-west1 --project=suivi-budget-ab888 --format='yaml(state,serviceConfig.secretEnvironmentVariables)'
gcloud run services describe gmail-watch-handler --region=europe-west1 --project=suivi-budget-ab888 --format='yaml(status.latestReadyRevisionName,status.traffic,spec.template.spec.containers.env.valueFrom)'
```

Répéter les contrôles de fonctions/services pour **tous** les consommateurs de
la table, notamment les deux synchronisations. Dans Cloud Run, vérifier que
100 % du trafic utilise la nouvelle révision et qu’aucun tag ne permet encore
d’appeler une ancienne révision. Examiner également les jobs et tout autre
consommateur connu, dans les autres régions/projets éventuels.

Pour vérifier l’absence de valeurs ordinaires, inspecter les **noms de clés**
de configuration sans afficher leurs valeurs. Les références Secret Manager
sont attendues ; les anciennes variables littérales ne le sont pas. Un
`describe` complet d’une ancienne révision peut afficher les anciens jetons.
Ne pas coller cette sortie dans un ticket, un chat ou un journal.

## Nettoyage et retour arrière

Ne jamais supprimer le secret entier quand on veut détruire une ancienne
version. Ne pas utiliser `latest` comme cible destructive, ni un nettoyage
global `functions:secrets:prune` sans inventaire des consommateurs.

1. Confirmer le succès du déploiement, des tests et des références ci-dessus.
2. Identifier explicitement le secret et le numéro **ancien**, différent de la
   version active. Désactiver d’abord une ancienne version permet un contrôle
   réversible avant destruction ; ne jamais désactiver la version courante.
3. Vérifier qu’aucun service, fonction, tag, trafic ou job ne la requiert.
4. Dans Secret Manager : sélectionner **uniquement l’ancienne version →
   Actions → Détruire**, confirmer puis vérifier l’état `DESTROYED`.
5. Documenter la nouvelle version et les preuves de validation, jamais sa valeur.

La destruction est irréversible une fois effective : les anciennes révisions
qui en dépendaient ne peuvent plus servir de retour arrière. Un délai de
destruction configuré peut laisser temporairement la version désactivée ;
vérifier son état final. [Documentation Google](https://docs.cloud.google.com/secret-manager/docs/destroy-secret-version).

En cas d’échec **avant** destruction, conserver l’ancienne version, vérifier si
le jeton fournisseur reste valide, puis rétablir une révision connue. Ne pas
supposer qu’un redéploiement rebascule vers une ancienne version : le bootstrap
exige la dernière version créée activée. Si l’ancien jeton est révoqué ou la
version détruite, créer une **nouvelle version valide**, mettre à jour GitHub
et redéployer ; ne pas tenter de restaurer une version `DESTROYED`.

La destruction Secret Manager **ne révoque pas** le jeton chez Google/GitHub.
Les anciennes révisions peuvent aussi conserver les anciennes variables
littérales : traiter leur accès et leur suppression séparément après inventaire.

## En cas de souci

| Symptôme                                                                                | Contrôle et action                                                                                                                                                                                                                                                                                                |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FileNotFoundError: credentials.json`                                                   | Le fichier doit être dans le dossier courant et s’appeler `credentials.json`, pas `credential.json` ni `credentials.json.json`. Contrôler les noms avec `Get-ChildItem -File`.                                                                                                                                    |
| JSON/base64 invalide, `refresh_token` absent                                            | GitHub reçoit le JSON brut ; Google reçoit une seule couche de base64 de ce JSON. Ne pas utiliser le JSON du client OAuth ou la clé Firebase à la place de `token.json`.                                                                                                                                          |
| `invalid_grant`, jeton Gmail expiré ou révoqué                                          | Refaire l’autorisation, remplacer les deux copies puis redéployer. Vérifier aussi le compte choisi et le statut OAuth ; pour une application externe en **Testing**, le refresh token Gmail expire normalement après 7 jours. [Règle Google](https://developers.google.com/identity/protocols/oauth2#expiration). |
| GitHub est à jour mais la fonction utilise l’ancienne version                           | Ajouter explicitement la nouvelle version Secret Manager, puis redéployer. Le bootstrap ne remplace pas les secrets existants.                                                                                                                                                                                    |
| Version courante `DESTROYED` ou `DISABLED`                                              | Ne pas relancer aveuglément : ajouter une nouvelle version valide et redéployer. Une erreur de lecture n’autorise jamais la recréation automatique.                                                                                                                                                               |
| `PERMISSION_DENIED`, `UNAUTHENTICATED`, `metadata probe failed`, `version probe failed` | Vérifier l’identité réellement utilisée et ses droits métadonnées/versions ; pour l’exécution, vérifier Secret Accessor sur le secret. Ne pas désactiver le contrôle fail-closed.                                                                                                                                 |
| `Invalid topicName does not match projects/...`                                         | Le client OAuth et le topic Gmail doivent appartenir à `suivi-budget-ab888`. Revoir [Gmail Pub/Sub](GMAIL_PUBSUB_SETUP.md), pas les clés Enable Banking.                                                                                                                                                          |
| Watch renouvelé mais aucune notification                                                | Contrôler l’expiration, le topic, la subscription, son URL et son identité OIDC. Un refus 403 sans authentification Pub/Sub est attendu ; ne pas supprimer cette protection.                                                                                                                                      |
| GitHub HTTP 401/403/404 lors du dispatch                                                | Vérifier validité/expiration du PAT, propriétaire, dépôt, permission Contents write et éventuelle autorisation d’organisation. Ne pas confondre l’authentification locale de `gh` avec le PAT utilisé par la fonction.                                                                                            |
| Des versions s’accumulent après chaque déploiement                                      | Vérifier que `main` appelle le helper pour les quatre secrets. Nettoyer uniquement les versions inutilisées, après inventaire ; ne pas conserver l’ancien déploiement qui appelle systématiquement `functions:secrets:set`.                                                                                       |

## Coût et fréquence du nettoyage

Un déploiement normal ne crée aucune nouvelle version : **pas de nettoyage
récurrent après chaque déploiement**. Le nettoyage est nécessaire après une
rotation volontaire ou pour retirer l’accumulation historique.

Au 13 octobre 2026, le niveau gratuit inclut 6 versions actives et 10 000 accès
par mois, partagés entre les projets d’un même compte de facturation. Les
versions `ENABLED` **et `DISABLED`** comptent comme actives ; les versions
`DESTROYED` ne sont plus facturées comme versions actives. Les durées avant
destruction restent comptabilisées. Quatre versions courantes ne garantissent
donc pas à elles seules une facture nulle : contrôler les autres projets, les
accès et la politique de réplication. [Tarification officielle, à revérifier](https://cloud.google.com/secret-manager/pricing).

## État vérifié le 13 octobre 2026 — historique, pas consigne de numéro

| Secret                  | Version courante vérifiée | Anciennes versions  |
| ----------------------- | ------------------------- | ------------------- |
| `GMAIL_TOKEN`           | 2, `ENABLED`              | 1, `DESTROYED`      |
| `GITHUB_DISPATCH_TOKEN` | 2, `ENABLED`              | 1, `DESTROYED`      |
| `EB_APP_ID`             | 12, `ENABLED`             | 1 à 11, `DESTROYED` |
| `EB_PRIVATE_KEY`        | 12, `ENABLED`             | 1 à 11, `DESTROYED` |

- Migration et bootstrap : [PR 189](https://github.com/niveys-5169/suivi-budget-public/pull/189).
- Conservation des versions Enable Banking : [PR 190](https://github.com/niveys-5169/suivi-budget-public/pull/190).
- [Déploiement Gmail version 2 réussi](https://github.com/niveys-5169/suivi-budget-public/actions/runs/38368335764) : six fonctions Gmail `ACTIVE`, références 2 et 100 % du trafic sur leurs nouvelles révisions ; pas de variables sensibles littérales dans leur configuration active.
- [Test d’import réussi](https://github.com/niveys-5169/suivi-budget-public/actions/runs/38369183138) : 0 nouvel email à traiter, 139 fiches d’emails actualisées dans Firebase, aucune erreur d’import relevée. L’ajout d’une nouvelle transaction n’était donc pas exercé.
- Renouvellement du watch vérifié à `2026-10-13T08:28:00Z`, expiration annoncée au `2026-10-20T08:28:00Z`, `lastWatchError` nul ; notifications du handler avec HTTP 200.
- Gmail : refresh token et accès au profil testés avec succès, client OAuth du bon projet. GitHub : PAT validé en lecture seule auprès de l’API et référence 2 vérifiée ; cela ne constitue pas un test du dispatch déployé.

Relever l’état réel avant toute prochaine opération : ces numéros et l’expiration
du watch changent. La révocation des anciens jetons côté fournisseurs, le moindre
privilège IAM, les anciennes révisions et une synchronisation bancaire complète
après rotation restent des vérifications distinctes, non prouvées par ce tableau.
