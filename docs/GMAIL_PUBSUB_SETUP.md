# Gmail Push (Pub/Sub) — mise en service

Import Linxo instantané : Gmail notifie un topic Pub/Sub à chaque nouveau mail,
qui pousse la notification vers la Cloud Function `gmail_watch_handler`.

```
Gmail (boîte du propriétaire)
  │  users().watch(topicName=projects/moonlit-app-455605-k7/topics/gmail-linxo-notifications)
  ▼
Topic Pub/Sub  ── projet OAuth : moonlit-app-455605-k7
  │  push subscription HTTP « gmail-linxo-push-to-cloudrun »
  ▼
URL Cloud Run du service gmail-watch-handler (europe-west1, suivi-budget-ab888)
  │
  ▼
_run_linxo_import_core()  →  Firestore
```

## Pourquoi deux projets GCP

Les Cloud Functions vivent dans le projet Firebase `suivi-budget-ab888`, mais
l'API Gmail **exige** que le topic appartienne au projet de l'application OAuth
(`moonlit-app-455605-k7`). Tout autre topic est rejeté à l'enregistrement :

```
HttpError 400: Invalid topicName does not match projects/moonlit-app-455605-k7/topics/*
```

D'où le franchissement de frontière par une _push subscription_ HTTP plutôt que
par un trigger Pub/Sub natif (`@pubsub_fn.on_message_published`), qui ne sait
s'abonner qu'à un topic de son propre projet.

## Pourquoi un compte de signature dédié

La subscription fait signer chaque requête push par un compte de service
(`--push-auth-service-account`), que le handler revérifie ensuite. Ce compte est
`gmail-push-invoker@moonlit-app-455605-k7.iam.gserviceaccount.com` : il vit dans
le **projet OAuth**, celui de la subscription.

Il ne peut pas s'agir du compte de déploiement
`firebase-adminsdk-fbsvc@suivi-budget-ab888` (projet Firebase), pourtant utilisé
jusqu'au 13/09/2026 : la contrainte d'organisation
`iam.disableCrossProjectServiceAccountUsage` interdit d'attacher à une ressource
un compte de service d'un autre projet, et toute tentative échoue par

```
PERMISSION_DENIED: Principal initiating the request does not have
iam.serviceAccounts.actAs permission on the requested push authentication
service account
```

quels que soient les rôles IAM accordés. Cette contrainte s'applique **par
défaut** aux projets sans organisation — les deux projets ici — et n'y est pas
désactivable : `orgpolicy.policies.create` est refusé et le rôle
`roles/orgpolicy.policyAdmin` n'y est même pas attribuable. Signer depuis un
compte du même projet que la subscription contourne le problème à la racine,
sans toucher à la gouvernance GCP.

La livraison, elle, reste cross-projet (endpoint Cloud Run dans le projet
Firebase) : ce n'est pas un attachement de compte de service, donc la contrainte
ne s'y applique pas.

## Prérequis : droits sur le projet OAuth

Le compte de service de déploiement
`firebase-adminsdk-fbsvc@suivi-budget-ab888.iam.gserviceaccount.com` appartient
au projet Firebase et **n'a aucun droit** sur `moonlit-app-455605-k7`. Sans le
correctif ci-dessous, l'étape « Provision Gmail Pub/Sub » de
`deploy-functions.yml` échoue et Gmail Push reste mort.

### Option A — déléguer au CI (recommandé)

Une seule fois, depuis un compte **Owner de `moonlit-app-455605-k7`** :

```bash
gcloud services enable pubsub.googleapis.com --project=moonlit-app-455605-k7

gcloud projects add-iam-policy-binding moonlit-app-455605-k7 \
  --member="serviceAccount:firebase-adminsdk-fbsvc@suivi-budget-ab888.iam.gserviceaccount.com" \
  --role="roles/pubsub.admin"
```

Le workflow crée et maintient ensuite topic, IAM et subscription tout seul —
y compris si l'URL du handler change. Il ne crée en revanche pas le compte de
signature `gmail-push-invoker@moonlit-app-455605-k7` : s'il a été supprimé, le
recréer avec ses deux bindings (les commandes exactes sont rappelées dans le
message d'erreur de l'étape, et détaillées en option B ci-dessous).

### Option B — provisionnement manuel

Si l'on préfère ne pas donner `pubsub.admin` au CI, exécuter les mêmes
opérations à la main (l'étape CI restera rouge à chaque déploiement) :

```bash
PROJECT=moonlit-app-455605-k7
TOPIC=gmail-linxo-notifications
HANDLER=https://europe-west1-suivi-budget-ab888.cloudfunctions.net/gmail_watch_handler

gcloud services enable pubsub.googleapis.com --project=$PROJECT

gcloud pubsub topics create $TOPIC --project=$PROJECT

# Sans ce binding, users().watch() renvoie
# « User not authorized to perform this action ».
gcloud pubsub topics add-iam-policy-binding $TOPIC --project=$PROJECT \
  --member="serviceAccount:gmail-api-push@system.gserviceaccount.com" \
  --role="roles/pubsub.publisher"

# HANDLER doit être l'URL Cloud Run du service, pas l'alias cloudfunctions.net :
#   gcloud run services describe gmail-watch-handler \
#     --region=europe-west1 --project=suivi-budget-ab888 --format='value(status.url)'

# Compte de service dont l'identité sert à la fois d'auth push Pub/Sub et
# d'audience attendue côté fonction (variables GMAIL_PUSH_SERVICE_ACCOUNT /
# GMAIL_PUSH_AUDIENCE, injectées par deploy-functions.yml). Sans
# --push-auth-*, le handler refuse toute requête par défaut
# (_verify_pubsub_push, functions/main.py) : l'endpoint est public
# (allUsers/run.invoker, requis pour les Firebase Callables), donc cette
# vérification est ce qui empêche n'importe qui de forger une notification.
#
# ⚠️ Ce doit être un COMPTE DE SERVICE, pas votre compte Google : en manuel,
# `gcloud auth list` renvoie votre compte utilisateur, que
# --push-auth-service-account refuse.
#
# Ce compte doit vivre dans le projet OAuth, comme la subscription : la
# contrainte iam.disableCrossProjectServiceAccountUsage interdit d'attacher à
# une subscription un compte de service d'un autre projet (voir « Pourquoi un
# compte de signature dédié » plus bas).
PUSH_SA=gmail-push-invoker@$PROJECT.iam.gserviceaccount.com
gcloud iam service-accounts create gmail-push-invoker --project=$PROJECT \
  --display-name="Pub/Sub push auth pour gmail-watch-handler"

# Pub/Sub doit pouvoir forger un jeton OIDC au nom de ce SA.
PROJECT_NUMBER=$(gcloud projects describe $PROJECT --format='value(projectNumber)')
gcloud iam service-accounts add-iam-policy-binding $PUSH_SA \
  --project=$PROJECT \
  --member="serviceAccount:service-${PROJECT_NUMBER}@gcp-sa-pubsub.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountTokenCreator"

# Et le SA de déploiement doit pouvoir « agir en tant que » lui pour le passer
# au --push-auth-service-account ci-dessous.
gcloud iam service-accounts add-iam-policy-binding $PUSH_SA \
  --project=$PROJECT \
  --member="serviceAccount:firebase-adminsdk-fbsvc@suivi-budget-ab888.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

gcloud pubsub subscriptions create gmail-linxo-push-to-cloudrun --project=$PROJECT \
  --topic=$TOPIC \
  --push-endpoint=$HANDLER \
  --push-auth-service-account=$PUSH_SA \
  --push-auth-token-audience=$HANDLER \
  --ack-deadline=600
```

⚠️ Après une création manuelle par cette voie, mettre à jour à la main les
variables d'environnement de la fonction (`GMAIL_PUSH_SERVICE_ACCOUNT=$PUSH_SA`,
`GMAIL_PUSH_AUDIENCE=$HANDLER`) — le CI le fait automatiquement, pas cette
procédure manuelle. Tant qu'elles ne correspondent pas exactement à ce qui est
configuré sur la subscription, le handler refuse tout (403).

## Activation du watch

Le watch Gmail **expire au bout de 7 jours** : sans réenregistrement, Gmail
cesse de publier et l'import instantané meurt.

- Renouvellement automatique : `renew_gmail_watch`, **chaque jour à 06:00 UTC**.
  Quotidien et non hebdomadaire — à un passage par semaine, la marge est nulle
  et un seul échec (erreur API transitoire, jeton momentanément invalide) tue
  Gmail Push pendant 7 jours.
- Réarmement immédiat : Dashboard → onglet **Maintenance** → bouton
  **« Activer Gmail Watch »** (appelle `setup_gmail_watch`). Utile après un
  changement de topic, pour ne pas attendre le passage quotidien. Le toast
  affiche la date d'expiration : c'est le moyen le plus rapide de vérifier que
  le push est bien armé.

Les deux chemins passent par le même `_register_gmail_watch`, qui écrit dans
`metadata/gmail_watch_state` :

| Champ                | Sens                                                     |
| -------------------- | -------------------------------------------------------- |
| `lastHistoryId`      | Curseur d'historique Gmail utilisé par le handler        |
| `watchExpiration`    | Expiration du dernier watch enregistré (epoch ms)        |
| `lastWatchAttemptAt` | Date de la dernière tentative d'enregistrement           |
| `lastWatchError`     | Erreur de la dernière tentative, `None` si elle a réussi |

`lastWatchError` non nul = Gmail Push est mort, et dit pourquoi.

## Vérifier que la chaîne fonctionne

```bash
# Le topic existe et Gmail peut y publier
gcloud pubsub topics get-iam-policy gmail-linxo-notifications \
  --project=moonlit-app-455605-k7

# La subscription pointe vers le bon endpoint : il doit être identique à
# l'URL Cloud Run du handler (comparer les deux commandes ci-dessous)
gcloud pubsub subscriptions describe gmail-linxo-push-to-cloudrun \
  --project=moonlit-app-455605-k7 --format='value(pushConfig.pushEndpoint)'

gcloud run services describe gmail-watch-handler \
  --region=europe-west1 --project=suivi-budget-ab888 --format='value(status.url)'

# L'identité qui signe les requêtes push doit être exactement celle attendue
# par la fonction (GMAIL_PUSH_SERVICE_ACCOUNT) : sinon le handler renvoie 403
# sur chaque notification.
gcloud pubsub subscriptions describe gmail-linxo-push-to-cloudrun \
  --project=moonlit-app-455605-k7 \
  --format='value(pushConfig.oidcToken.serviceAccountEmail)'

# Le handler reçoit et journalise ("Gmail Watch notification reçue. historyId=…")
gcloud functions logs read gmail_watch_handler \
  --region=europe-west1 --project=suivi-budget-ab888 --limit=50
```

## Dépannage

| Symptôme                                                                                       | Cause                                                                                                    | Correctif                                                                                                                                                           |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CI : `Failed to create topic […]: User not authorized`                                         | Le SA de déploiement n'a pas de droits sur le projet OAuth                                               | Option A ou B ci-dessus                                                                                                                                             |
| `Invalid topicName does not match projects/moonlit-app-455605-k7/topics/*`                     | Topic créé dans le projet Firebase                                                                       | Le topic doit vivre dans le projet OAuth                                                                                                                            |
| `setup_gmail_watch` → `User not authorized to perform this action`                             | `gmail-api-push@system.gserviceaccount.com` n'est pas publisher sur le topic                             | Rejouer le binding IAM                                                                                                                                              |
| Aucune trace dans les logs du handler                                                          | Watch expiré/jamais enregistré, subscription absente, branchée sur un ancien topic, ou endpoint obsolète | Lire `metadata/gmail_watch_state`, cliquer « Activer Gmail Watch », puis relire le bloc « Chaîne effectivement en place » du dernier run `deploy-functions`         |
| Le handler journalise mais rien n'arrive en base                                               | `historyId` expiré (> 7 jours)                                                                           | Le handler retombe alors sur un import complet ; sinon recliquer « Activer Gmail Watch »                                                                            |
| CI : `PERMISSION_DENIED […] iam.serviceAccounts.actAs […] push authentication service account` | Le compte passé au `--push-auth-service-account` n'appartient pas au projet OAuth, ou a été supprimé     | Voir « Pourquoi un compte de signature dédié » : le compte doit vivre dans `moonlit-app-455605-k7`. Aucun rôle IAM ne lève ce refus sur un compte d'un autre projet |
| Le handler renvoie 403 sur chaque notification                                                 | `GMAIL_PUSH_SERVICE_ACCOUNT` ne correspond plus à l'identité de signature de la subscription             | Comparer les deux (section « Vérifier que la chaîne fonctionne ») et redéployer les fonctions                                                                       |

## Filet de sécurité

`.github/workflows/linxo-poll.yml` sait relire la boîte Gmail (import complet
équivalent au poll historique), mais son déclenchement planifié est
**désactivé** — Gmail Push étant maintenant l'unique voie d'import, ce
polling automatique n'aurait fait que consommer des minutes Actions pour un
filet redondant. Le workflow reste disponible en déclenchement manuel
(`workflow_dispatch`) si Gmail Push tombe en panne.

Pour réactiver la planification automatique, décommenter le bloc `schedule`
en tête de `linxo-poll.yml`.
