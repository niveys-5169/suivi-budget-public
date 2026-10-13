# Plan de correction de l’audit de sécurité

**Date de mise à jour :** 13 octobre 2026

**Audit de référence :** `699edd45-81a3-4cce-a968-123a547cc2a4`

**Commit audité :** `588a636d295a5d8cf9fff18198719eab73c62343`

**Référence vérifiée :** branche distante `main` à `e49a7ecc4d2683de202c2722a615dd41392bf395` ; correctif de conservation des secrets fusionné à `b6e493162aed65d8b9eb0b4753deed40ee307010`.

## Objectif

Clôturer les constats de l’audit par des corrections vérifiables, sans étendre inutilement le périmètre fonctionnel. Chaque phase doit produire un livrable autonome, testable et réversible.

Le présent document met à jour le plan après comparaison entre le commit audité, la branche distante actuelle et les vérifications de production. Les correctifs secrets ont été fusionnés via les PR 189 et 190. Pour les corrections restantes, repartir d’un worktree propre de la branche actuelle, pas du commit historique audité.

## État vérifié au 13 octobre 2026

| Constat                                                                    | Sévérité | État                                     | Preuve synthétique                                                                                                                                                                                |
| -------------------------------------------------------------------------- | -------: | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Secrets Gmail et GitHub injectés comme variables d’environnement Cloud Run |  Moyenne | Corrigé et déployé ; réserves de clôture | Références Secret Manager version 2 vérifiées, anciennes versions 1 détruites ; Gmail testé en production. IAM, anciens jetons fournisseurs et anciennes révisions restent à contrôler séparément |
| Injection de formules dans l’export XLSX                                   |  Moyenne | Corrigé                                  | `_write_cell()` force les chaînes en texte et les tests vérifient l’absence de nœuds `<f>` dans le classeur sérialisé                                                                             |
| Déconnexion sans purge des données persistées dans le navigateur           |   Faible | À corriger                               | La déconnexion appelle encore directement Firebase Auth tandis que les caches Firestore et `ai_settings` persistent                                                                               |
| Catégories financières potentiellement transmises à Sentry                 |   Faible | À corriger                               | Si Sentry est activé, `categorie` n’est pas filtré ; `amount`/`montant` sont masqués au premier niveau, mais le filtrage n’est ni récursif ni fondé sur une liste blanche                         |
| Réécritures Vercel utilisées comme proxys ouverts vers Brave et NVIDIA     |   Faible | À corriger                               | Les réécritures externes restent accessibles sans authentification ni limitation applicative                                                                                                      |

**Bilan : 2 corrections livrées sur 5, 3 constats encore à corriger. L’audit n’est pas clôturé : les réserves de production et contrôles externes restent distincts des correctifs livrés.**

### Preuves récentes et limites

- [PR 189](https://github.com/niveys-5169/suivi-budget-public/pull/189) : migration Gmail/GitHub, déclarations des sept consommateurs, bootstrap fail-closed et tests.
- [PR 190](https://github.com/niveys-5169/suivi-budget-public/pull/190) : les secrets Enable Banking ne sont plus recréés à chaque déploiement. Versions 1 à 11 détruites, versions 12 conservées.
- [Déploiement Gmail version 2 réussi](https://github.com/niveys-5169/suivi-budget-public/actions/runs/38368335764) : les six consommateurs Gmail sont `ACTIVE` ; références 2, nouvelles révisions prêtes et 100 % du trafic. `dispatch_github_workflow` référence le PAT version 2. Les anciennes versions 1 Gmail/GitHub sont `DESTROYED`.
- [Import Gmail réel réussi](https://github.com/niveys-5169/suivi-budget-public/actions/runs/38369183138) : 0 nouvel email à traiter, 139 fiches d’emails actualisées, aucune erreur relevée. Ce test ne couvre donc pas l’ajout d’une nouvelle transaction.
- Renouvellement du watch effectué le 13 octobre à 08:28 UTC, expiration annoncée au 20 octobre ; état Firestore sans erreur et notifications du handler HTTP 200.
- Vérification ciblée du 13 octobre : `18 passed, 12 subtests passed` pour XLSX, bindings des secrets et bootstrap. Lors du correctif Enable Banking : `589 passed, 12 subtests passed` ; ce résultat global n’a pas été rejoué pour la seule mise à jour documentaire.
- Le PAT a été validé en lecture seule auprès de GitHub. Le dispatch déployé et une synchronisation bancaire complète après rotation n’ont pas été exercés par ces tests Gmail. La révocation des anciens jetons chez leurs fournisseurs et la revue IAM ne sont pas prouvées par la destruction Secret Manager.

Procédure de reprise, rotation, diagnostics et nettoyage : [Google Secret Manager](../runtime-secrets.md). Les numéros ci-dessus sont un relevé daté, pas des valeurs à recopier pour une future rotation.

### Progrès connexes déjà constatés

- Le déploiement Firestore inclut désormais les règles et les index, avec des exécutions GitHub Actions réussies le 9 octobre 2026.
- Les audits npm et Python ont réussi le 7 octobre 2026 après plusieurs mises à jour de dépendances.
- Les quatre secrets Gmail/GitHub/Enable Banking utilisent `SecretParam` et le même bootstrap sans création de version lors d’un déploiement courant.
- Les règles du projet Firestore portefeuille ne sont toujours pas versionnées dans ce dépôt. Leur état réel reste donc à vérifier séparément.
- Les exceptions `PYSEC-2025-183` et `PYSEC-2024-271` restent présentes sans justification, responsable ni date d’expiration documentés.

## Ordre de correction

### Phase 0 — Repartir d’une base actuelle et reproductible

**Priorité : bloquante avant toute modification de code**

1. Créer ou réutiliser un worktree propre depuis le dernier `origin/main`, sur une branche préfixée `codex/`.
2. Confirmer le SHA de départ et l’absence de modifications locales parasites.
3. Exécuter les contrôles de référence avant correction.
4. Conserver un tableau de correspondance entre chaque constat, sa correction, ses tests et sa preuve de déploiement.

**Critères d’acceptation**

- Aucun développement n’est réalisé sur le worktree détaché de l’audit.
- Le SHA de départ et les résultats des contrôles initiaux sont consignés dans la première pull request.

### Phase 1 — Migrer les secrets Gmail et GitHub vers Secret Manager

**Priorité : correctif livré — terminer les réserves de clôture**

**Avancement :** migration fusionnée et déployée, rotation vers les versions 2 effectuée, anciennes versions Secret Manager détruites. Les sept consommateurs déclarent leurs secrets ; les configurations actives vérifiées ne contiennent plus les valeurs Gmail/GitHub littérales. Import Gmail, renouvellement et réception Pub/Sub validés. Pour la clôture stricte, confirmer la révocation des anciens jetons fournisseurs, les droits IAM minimaux, les anciennes révisions, le dispatch réel et les synchronisations bancaires après rotation. Procédure : [secrets d’exécution](../runtime-secrets.md).

1. Déclarer des `SecretParam` dédiés pour le jeton Gmail et le jeton GitHub, dans un module de secrets stable et partagé.
2. Remplacer les lectures directes de `os.environ` dans la construction du client Gmail et dans le déclenchement GitHub.
3. Ajouter les secrets requis à tous les décorateurs concernés :
   - import Linxo ;
   - gestionnaire Gmail Watch ;
   - configuration de Gmail Watch ;
   - synchronisation bancaire manuelle ;
   - synchronisation bancaire planifiée ;
   - déclenchement GitHub.
4. Modifier le workflow de déploiement pour utiliser `firebase functions:secrets:set` ou le mécanisme Firebase équivalent, puis supprimer l’écriture des deux jetons dans le fichier `.env` de déploiement.
5. Déployer, vérifier les références Cloud Run et renouveler les jetons exposés. Pour Gmail, organiser la révocation Google avant la nouvelle autorisation : une révocation ultérieure peut invalider aussi le nouveau jeton du même projet. Pour GitHub, révoquer l’ancien PAT après validation du nouveau.
6. Tester explicitement le comportement en cas de secret absent ou inaccessible : l’exécution doit échouer de manière sûre et observable.

**Critères d’acceptation**

- Aucun jeton Gmail ou GitHub n’est écrit dans un fichier `.env` par la CI.
- Aucun jeton n’apparaît en clair dans la configuration d’une révision Cloud Run, les journaux ou les artefacts GitHub Actions.
- Toutes les fonctions consommatrices déclarent explicitement leurs secrets.
- Les parcours Gmail, synchronisation bancaire et déclenchement GitHub fonctionnent après rotation.

### Phase 2 — Centraliser une déconnexion avec purge de session

**Priorité : haute — protection des données sur appareil partagé**

1. Créer une fonction unique de déconnexion sécurisée utilisée par les interfaces bureau et mobile.
2. Avant ou pendant la déconnexion :
   - arrêter les abonnements actifs ;
   - supprimer `ai_settings` et les éventuelles clés historiques liées à l’IA ;
   - terminer les deux instances Firestore ;
   - effacer leur persistance locale ;
   - terminer la session Firebase Auth.
3. Remplacer les appels directs à `signOut` dans `AuthButtons` et `MSettingsModal` par cette fonction commune.
4. Gérer explicitement les cas multi-onglets, notamment `failed-precondition`, avec un message clair et une stratégie de repli sûre.
5. Si une conservation locale est souhaitée, la réserver à une option explicite « appareil de confiance » ; la valeur par défaut reste sans persistance après déconnexion.

**Critères d’acceptation**

- Une reconnexion hors ligne après déconnexion ne restitue aucune donnée de l’utilisateur précédent.
- `ai_settings` et les caches Firestore des deux projets sont supprimés.
- Les deux points d’entrée de déconnexion suivent exactement le même parcours.
- Les tests couvrent la réussite, l’échec partiel et le cas multi-onglets.

### Phase 3 — Réduire les données financières envoyées à Sentry

**Priorité : haute — correction courte à fort bénéfice de confidentialité**

1. Remplacer la logique de liste noire par une liste blanche stricte des métadonnées autorisées.
2. Limiter les extras aux champs techniques nécessaires, par exemple `id`, `count` et, si justifié, `type`.
3. Retirer des appels existants `categorie`, `category`, `amount` et toute valeur financière ou métier permettant d’inférer les habitudes de l’utilisateur.
4. Exporter un assainisseur pur et testable, récursif pour les objets imbriqués.
5. Ajouter des tests garantissant que les catégories, montants et variantes de casse ne sont jamais transmis.

**Critères d’acceptation**

- Aucun appel Sentry ne reçoit de catégorie ou de montant financier.
- L’assainisseur refuse par défaut tout champ non explicitement autorisé.
- Les tests couvrent les objets imbriqués, tableaux, variantes de nom et valeurs nulles.

### Phase 4 — Remplacer les proxys Vercel génériques par des endpoints contrôlés

**Priorité : haute — surface publique et risque d’abus de quota**

1. Supprimer les réécritures externes génériques vers Brave et NVIDIA.
2. Créer deux fonctions serveur explicites :
   - un endpoint GET de recherche Brave avec paramètres autorisés ;
   - un endpoint POST NVIDIA limité à `chat/completions` avec schéma de corps contrôlé.
3. Utiliser un en-tête applicatif distinct, par exemple `X-Firebase-ID-Token`, pour authentifier l’utilisateur sans confliter avec l’en-tête fournisseur `Authorization`.
4. Vérifier le jeton Firebase côté serveur ainsi que l’identité propriétaire attendue.
5. Imposer méthode, chemin, liste de paramètres, taille maximale du corps et délai d’attente.
6. Construire côté serveur les en-têtes fournisseurs et ne jamais relayer les en-têtes sensibles fournis par le navigateur.
7. Ajouter une limitation de débit Vercel/WAF et une journalisation sans contenu de requête sensible.
8. Mettre à jour les clients front-end pour utiliser les nouveaux endpoints.

**Critères d’acceptation**

- Aucun chemin ou hôte arbitraire ne peut être relayé.
- Une requête non authentifiée, non propriétaire ou hors schéma est refusée.
- Les limites de débit et de taille sont testées.
- Les parcours de recherche et d’assistance IA fonctionnent depuis le navigateur après déploiement.

### Phase 5 — Clôturer les contrôles externes et la dette d’audit

Cette phase traite les éléments qui ne peuvent pas être prouvés par le seul code applicatif.

1. Versionner les règles du projet Firestore portefeuille, ajouter leurs tests Emulator Suite et configurer leur déploiement vers la bonne cible Firebase.
2. Vérifier dans GCP les rôles pouvant lire la configuration Cloud Run et accéder aux versions Secret Manager ; appliquer le moindre privilège.
3. Vérifier l’activation réelle de Sentry en production, les accès au projet et la durée de conservation.
4. Vérifier les règles WAF et les limites effectives sur les nouveaux endpoints Vercel.
5. Pour chaque exception Python Security Advisory : documenter le paquet, l’avis, la justification, le responsable et la date d’expiration, ou supprimer l’exception.
6. Réévaluer l’activation de CodeQL, actuellement désactivé dans le workflow.

**Critères d’acceptation**

- Les règles portefeuille sont versionnées, testées et déployées automatiquement.
- Les contrôles IAM, Sentry et WAF disposent d’une preuve datée.
- Aucun avis de sécurité n’est ignoré sans justification et échéance.

### Phase 6 — Vérification finale et clôture

1. Rejouer les tests ciblés de chaque correction, y compris la non-régression XLSX.
2. Exécuter les contrôles globaux du dépôt :

```powershell
npm run check:audit
npm run lint
npm run typecheck
npm test -- --run
npm run check:design
pytest
```

3. Vérifier les déploiements réels et les journaux sans exposer de secret.
4. Réaliser une vérification de correction pour chacun des cinq constats initiaux.
5. Effectuer une revue de sécurité du diff complet avant fusion.
6. Mettre à jour le rapport de clôture avec les SHA, tests, déploiements et preuves externes.

## Découpage recommandé des pull requests

1. **PR 1 — Secrets Gmail/GitHub :** migration Secret Manager, déclarations de fonctions, workflow et rotation.
2. **PR 2 — Déconnexion sécurisée :** service commun, purge des caches et tests multi-onglets.
3. **PR 3 — Télémétrie minimale :** liste blanche Sentry, nettoyage des appels et tests.
4. **PR 4 — Endpoints IA/recherche :** remplacement des réécritures, authentification, validation et limitation de débit.
5. **PR 5 — Contrôles externes :** règles portefeuille, documentation IAM/Sentry/WAF et traitement des exceptions d’audit.

Chaque PR doit être fusionnable indépendamment et inclure ses tests, ses critères d’acceptation et sa procédure de retour arrière.

## Définition de terminé

Le plan est terminé lorsque :

- les trois constats encore à corriger sont corrigés et vérifiés, et les réserves de clôture du correctif secrets sont levées ;
- la correction XLSX reste couverte par un test de non-régression ;
- les jetons Gmail et GitHub ont été renouvelés après migration ;
- les contrôles cloud, IAM, Firestore, Sentry et WAF sont validés sur les environnements réellement utilisés ;
- aucune exception de sécurité non documentée ne subsiste ;
- les contrôles globaux du dépôt et les déploiements sont au vert.

## Hors périmètre

- Une réarchitecture générale de l’application.
- Une modification du modèle mono-utilisateur principal, sauf si la vérification des règles portefeuille révèle un défaut directement lié à l’audit.
- Des changements fonctionnels sans lien avec les constats ou leurs tests.
