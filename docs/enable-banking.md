# Enable Banking et vérification Linxo

## État de livraison

Implémentation locale du 9 octobre 2026, en mode **observation par défaut**.
La mise en production et une connexion bancaire réelle n'ont pas été exécutées.
Le précontrôle local constate l'absence de `EB_APP_ID`, `EB_PRIVATE_KEY`,
`EB_REDIRECT_URL`, `EB_APP_URL`. La liste des noms de secrets GitHub consultée
ne contient pas `EB_APP_ID` et `EB_PRIVATE_KEY`. Cela ne permet pas de conclure
à l'absence de secrets dans Secret Manager ni à la validité d'anciennes sessions.

## Contrat fonctionnel

- Enable Banking fournit opérations et soldes pour les comptes EUR activés.
  Linxo reste importé et contrôle la présence dans les **notifications reçues**.
- Les opérations provisoires comptent immédiatement, indépendamment du pointage.
  Seule une annulation explicite les exclut des montants ; une absence à l'API
  ne vaut pas annulation. Les approbations de récurrences annulées gardent leur
  trace et cessent de supprimer la provision.
- Le badge attend Linxo dès la première observation. L'alerte commence après
  sept jours calendaires de Paris depuis la première observation comptabilisée.
  Elle ne se réinitialise pas lors des imports ; une confirmation tardive la résout.
  Une notification provisoire ne change pas le statut bancaire Enable Banking.
- Identité bancaire : compte stable et `entry_reference`. `transaction_id` n'est
  jamais une identité durable. À défaut, empreinte originale et ordinal conservent
  les occurrences. Les transitions incertaines sont proposées à la vérification.
- Rapprochement certain : compte, EUR, montant signé en centimes, référence fiable
  commune ou libellé original normalisé identique à ±7 jours, unique dans les deux
  sens. Chaque observation confirme au plus une opération. Le montant seul donne
  une suggestion. Une deuxième ligne susceptible de doubler une opération reste
  dans cette liste sans dépense supplémentaire automatique.
- Les notifications génériques SEPA/INSTANTANE provisoires répétées suivent
  l'heuristique existante à trois jours ; des occurrences du même jour et les
  paiements ordinaires ne sont jamais fusionnés sur cette seule ressemblance.
- Les identifiants et corrections utilisateur restent conservés. La fusion de
  deux lignes demande le choix explicite des modifications conservées. Les
  rattachements contradictoires à plusieurs récurrences doivent être résolus.
  Les tombstones restent prioritaires sur les deux sources.

## Modules et données

Les modules `bank_*.py` et `enable_banking_client.py` sont communs à `src/` et
`functions/`. `scripts/check_python_copies.py` vérifie leurs copies ; les deux
`firebase_db.py` restent volontairement distincts.

| Responsabilité                                           | Code principal                                                                       |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| API, erreurs, pagination complète et délais réseau       | `enable_banking_client.py`                                                           |
| Autorisation à usage unique, reconnexion et affectations | `bank_auth.py`, `bank_auth_persist.py`                                               |
| Observations originales et identité des notifications    | `bank_observations.py`, `bank_linxo_identity.py`                                     |
| Rapprochement déterministe et publication canonique      | `bank_reconciliation.py`, `bank_pipeline.py`, `bank_store.py`                        |
| Fusion explicite et approbations annulées                | `bank_merge.py`, `bank_cycle.py`                                                     |
| Historiques séparés, choix du solde, contrôle temporel   | `bank_balance_store.py`, `bank_balances.py`, `bank_balance_pipeline.py`              |
| Planification, verrou et résultats d'exécution           | `bank_sync.py`, `bank_lock.py`, `bank_config.py`, `functions/main.py`                |
| Contrats, abonnements et suivi d'import                  | `banking.types.ts`, `useBankingData.tsx`, `useSyncTransactions.ts`, `banking-api.ts` |
| Page et contrôles communs desktop/PWA                    | `components/banking/`, routes `/connexions`, `/notifications`                        |
| Alertes persistantes par épisode                         | `computeBankingAlerts.ts`, `useAlerts.tsx`, `BankingBanner.tsx`                      |

Les sessions, autorisations temporaires (15 minutes), observations de transactions,
soldes originaux, verrous, alias et traces de fusion sont privés et écrits par le
backend. Les connexions exposables, rapports et exécutions sont lisibles uniquement
par le propriétaire ; toute écriture navigateur y est refusée. Le wildcard général
exclut ces collections, y compris leurs sous-collections.

Le callback consomme l'état avant l'échange du code. Un résultat terminé est
idempotent. Si un verrou empêche la publication d'une session déjà échangée, la
session reste privée dans l'autorisation ; une reprise ne rééchange pas le code.
Les affectations et mutations des liens partagent le même verrou d'écriture.

## Soldes, alertes et secours

Solde Enable Banking prioritaire : ITBD, CLBD, puis solde disponible explicitement
qualifié ITAV/CLAV. Historiques sources séparés, timestamps de réception conservés.
Une date de réception Linxo n'est jamais transformée en date bancaire.
Les contrôles distinguent concordance à 0,01 €, décalage expliqué, attente et écart.
Un décalage fondé sur les réceptions reste provisoire. Une concordance de soldes
ne retire pas les alertes d'opérations absentes.

En panne, Linxo continue. Un solde Linxo remplace le dernier solde bancaire seulement
si sa fraîcheur bancaire est comparable ; sinon le dernier solde est conservé avec
une alerte. Une désactivation explicite permet le retour à Linxo en conservant les
observations et les identifiants précédemment publiés.

Alertes : expiration connue (préavis sept jours), expiration/révocation/action
requise, erreur technique, aucune réussite depuis 36 heures, notification Linxo
manquante depuis sept jours, écart ou contrôle impossible depuis sept jours.
La révocation inconnue est détectée lors du prochain appel bancaire. Lire une
alerte marque sa lecture et ne résout pas son problème.

## Mise en service

1. Configurer dans GitHub les secrets `EB_APP_ID`, `EB_PRIVATE_KEY` et les variables
   `EB_REDIRECT_URL`, `EB_APP_URL`, `EB_MODE=observation`. La clé RSA serveur reste
   dans Secret Manager et n'est pas incluse dans le bundle navigateur.
2. Vérifier l'application Enable Banking de production, les banques FR requises,
   le certificat correspondant à la clé RSA, l'URL callback HTTPS exacte et les
   permissions du compte de service. `scripts/banking_preflight.py` est en lecture
   seule et n'imprime ni clé ni session. Les vérifications de production restantes
   sont indiquées dans son résultat, sans supposer qu'elles sont déjà satisfaites.
3. Le compte de déploiement doit pouvoir gérer les secrets, règles/indexes,
   fonctions/Cloud Scheduler, IAM existant et exclusions de destinations Logging.
   Le runtime nécessite Secret Accessor pour les secrets liés et accès Firestore.
4. Le workflow publie règles/indexes et fonctions ; avant d'exposer le callback,
   il exclut ses journaux des destinations du projet. Vérifier également les
   destinations agrégées éventuelles de l'organisation. Cloud Run produit des
   journaux de requêtes automatiquement ; la protection ne repose donc pas
   uniquement sur l'absence de logs applicatifs.
   Sources : [journaux Cloud Run](https://docs.cloud.google.com/run/docs/logging),
   [exclusions Logging](https://docs.cloud.google.com/sdk/gcloud/reference/logging/sinks/update).
5. Depuis `/connexions`, autoriser une banque et rattacher les comptes. Le backend
   collecte 30 jours complets, conserve les observations non rapprochées plus
   anciennes et expose les résultats par connexion sans bloquer les autres comptes.
6. Exécuter `python scripts/bootstrap_banking_observations.py` pour l'aperçu de
   30 jours de données et mails, sans écriture ni marquage des emails. Inspecter
   correspondances, ambiguïtés et soldes. `--apply-links` applique seulement les
   preuves et liens certains, sans rejouer les montants financiers. Les conflits
   d'identifiants existants sont laissés à la résolution explicite.
7. Passer `EB_MODE=active` via un redéploiement puis activer compte par compte.
   Le moteur retrouve aussi les lignes Linxo écrites pendant l'observation,
   conserve leurs identifiants et les corrections, sans réimport financier historique.
8. Vérifier une connexion réelle, un import manuel (y compris sans nouveauté),
   les soldes et trois imports quotidiens consécutifs à **8 h Europe/Paris**.
   Documenter les dates et résultats avant de déclarer l'intégration opérationnelle.
9. Une fois la nouvelle planification vérifiée, définir
   `BANKING_SCHEDULED_READY=true` pour arrêter le cron historique GitHub. Jusqu'à
   cette vérification il reste disponible comme secours ; il ne fournit pas
   l'horaire Europe/Paris exact de la nouvelle fonction.

## Retour à Linxo

Désactiver les comptes dans `/connexions`, ou redéployer avec `EB_MODE=disabled`
pour arrêter les appels Enable Banking globalement. Linxo et la planification
commune restent utilisables. Aucun historique, session ni lien n'est effacé.
Le script destructif `cleanup_eb_collections.py` est neutralisé.

## Vérifications locales

Les tests ajoutés couvrent l'ordre d'arrivée, les retards, les paiements identiques,
les données modifiées, suppressions/annulations, pagination interrompue, rejeu OAuth,
reprise d'une session échangée, concurrence, panne, activation et retour à Linxo.
Les parcours Playwright utilisent les composants réels avec frontières de service
simulées ; ils n'établissent pas une connexion réelle à une banque ou à Firebase.
Deux revues indépendantes ont vérifié les correctifs sur l'autorisation, les liens,
la multiplicité et les récurrences annulées, sans anomalie bloquante restante
dans ce périmètre ciblé. Les preuves locales ne valent pas déploiement ni succès
des trois imports quotidiens exigés pour la mise en service.

Résultats vérifiés le **9 octobre 2026** :

| Vérification | Résultat |
| --- | --- |
| Pytest, suite complète | 570 tests réussis et 12 sous-tests réussis |
| Vitest, suite complète | 1 136 tests réussis, 11 ignorés ; 156 fichiers réussis, un ignoré |
| Permissions Firestore avec émulateur | 122 tests réussis |
| Playwright desktop/PWA avec services simulés | Huit parcours réussis |
| Typage, lint, contrôle du design et build de production | Réussis |
| Copies Python partagées | 23 modules identiques ; les deux `firebase_db.py` restent distincts |

Le précontrôle local signale `EB_APP_ID`, `EB_PRIVATE_KEY`, `EB_REDIRECT_URL`
et `EB_APP_URL` manquants. Aucun déploiement ni import bancaire réel n'a été
réalisé pendant cette validation. L'application de production, le certificat,
les permissions et les anciennes sessions restent à vérifier après configuration.
La connexion réelle et les trois imports quotidiens consécutifs restent requis
avant de déclarer la mise en service achevée.

### Contrôle GitHub après configuration des secrets

Le 9 octobre 2026 à 13 h 57 Europe/Paris, le
[précontrôle GitHub](https://github.com/niveys-5169/suivi-budget-public/actions/runs/37926868203)
sur la branche isolée `codex/eb-preflight-20261009` a terminé avec succès :
aucune configuration manquante, mode `observation`, authentification API acceptée,
application `PRODUCTION` et banques françaises accessibles. Le contrôle a utilisé
uniquement `GET /application` et `GET /aspsps`, sans écriture financière ni déploiement.
Les URL GitHub sont configurées ; l'enregistrement du callback chez Enable Banking,
les permissions du runtime Firebase et la connexion réelle restent à vérifier
pendant la mise en service. Les variables absentes lors du précontrôle local
précédent sont désormais présentes dans GitHub.
