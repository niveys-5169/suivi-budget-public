# Secrets d’exécution Gmail et GitHub

Les Cloud Functions déclarent `GMAIL_TOKEN` et `GITHUB_DISPATCH_TOKEN` comme secrets Google Secret Manager. Le workflow les initialise avant le déploiement. Ils ne doivent jamais être ajoutés à `functions/.env.suivi-budget-ab888`.

Le workflow crée ces secrets uniquement si Secret Manager répond explicitement `NOT_FOUND`. Pour un secret existant, il exige que la dernière version soit activée. Une erreur IAM, réseau ou de lecture bloque le déploiement. Un déploiement ordinaire ne crée donc pas de nouvelle version de ces deux secrets. La rotation est séparée du déploiement courant pour éviter l’accumulation de versions actives.

## Rotation contrôlée

1. Créer la nouvelle version du secret, sans afficher sa valeur dans les journaux.
2. Redéployer toutes les Cloud Functions qui déclarent ce secret.
3. Tester les parcours concernés.
4. Révoquer l’ancien jeton chez Google ou GitHub.
5. Détruire la version Secret Manager devenue obsolète.

Mettre également à jour `GOOGLE_TOKEN` et `PAT_GITHUB_SECRET` dans les secrets GitHub : d’autres workflows utilisent le jeton Gmail. Modifier ces copies GitHub ne remplace pas la rotation Secret Manager d’un secret existant.

Le compte de déploiement doit pouvoir lire les métadonnées des secrets et de leurs versions, créer les secrets lors de la migration et configurer leur accès. Le compte d’exécution doit disposer de l’accès aux seuls secrets requis. Vérifier ces droits avant le premier déploiement.

### Jeton Gmail

Le secret conserve le format historique : le JSON OAuth encodé en base64.

Dans Cloud Shell ou Git Bash :

```bash
GOOGLE_TOKEN="$(cat '<chemin-vers-google-token.json>')"
printf '%s' "$GOOGLE_TOKEN" | base64 -w 0 | firebase functions:secrets:set GMAIL_TOKEN --data-file=- --project suivi-budget-ab888 --non-interactive
```

### Jeton GitHub

Le secret contient directement le PAT GitHub à portée minimale.

Dans Cloud Shell ou Git Bash, après avoir placé le PAT dans la variable de session :

```bash
printf '%s' "$GITHUB_DISPATCH_TOKEN" | firebase functions:secrets:set GITHUB_DISPATCH_TOKEN --data-file=- --project suivi-budget-ab888 --non-interactive
```

### Redéploiement et nettoyage

```powershell
firebase deploy --only functions --project suivi-budget-ab888 --non-interactive
gcloud secrets versions list GMAIL_TOKEN --project suivi-budget-ab888
gcloud secrets versions list GITHUB_DISPATCH_TOKEN --project suivi-budget-ab888
gcloud secrets versions destroy '<ancienne-version>' --secret GMAIL_TOKEN --project suivi-budget-ab888 --quiet
gcloud secrets versions destroy '<ancienne-version>' --secret GITHUB_DISPATCH_TOKEN --project suivi-budget-ab888 --quiet
```

Ne jamais détruire une ancienne version avant la réussite du déploiement et des tests. Les fonctions en production peuvent encore y être liées tant que leur nouvelle révision n’est pas active. Vérifier après déploiement les références Secret Manager et l’absence des deux jetons parmi les variables ordinaires Cloud Run, puis tester l’import Gmail, le watch, les synchronisations et le dispatch GitHub.

## Contrôle du niveau gratuit

Conserver une seule version active par secret. Après chaque rotation, vérifier que les anciennes versions sont dans l’état `DESTROYED`. Les quotas gratuits sont partagés entre les projets rattachés au même compte de facturation.
