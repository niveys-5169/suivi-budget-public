# Soldes des comptes : import, contrôle et alertes

Le solde affiché pour un compte (tableau de bord, accueil mobile, `BalanceCard`)
est le document `account_balances/{compte}`, lu tel quel par `useBalances`.
Le front ne recalcule pas le solde.

## Extension Enable Banking (9 octobre 2026)

Pour un compte activé en mode `active`, le backend sélectionne le solde Enable
Banking : comptable courant ITBD, puis clôture CLBD, puis disponible explicitement
qualifié ITAV/CLAV. Les historiques sources sont indépendants ; les nouvelles
observations Enable Banking alimentent aussi l'historique exposable des soldes.
Une observation plus ancienne ne remplace pas celle de sa source.

La préparation historique conserve aussi les soldes originaux des emails Linxo
déjà traités dans `bank_balance_sources` et leur historique, sans rejouer les
transactions ni remplacer le solde affiché. Le contrôle expose la date de réception
de l'email Linxo indépendamment de celle d'Enable Banking.

Le contrôle entre sources affiche « Soldes reçus concordants », « Décalage expliqué
(provisoire) », « Vérification en attente » ou « Écart à vérifier ». Montants en
EUR et tolérance 0,01 €. Une réception Linxo ne prouve jamais une date bancaire.
Les mouvements comptabilisés peuvent expliquer provisoirement un décalage ; les
provisoires et annulations n'en deviennent pas des preuves comptables.

Le contrôle interne entre emails Linxo utilise leurs observations originales pour
les comptes alimentés par Enable Banking, indépendamment des corrections de lignes.
La confirmation du solde ne confirme pas une opération absente des notifications.
Un solde bancaire reçu ne fait jamais l'objet d'une seconde soustraction des
transactions reçues. Les provisions de récurrences tiennent compte des provisoires
déjà constatées ; une annulation explicite neutralise l'approbation liée sans
effacer son historique.

En panne, le secours Linxo ne remplace le solde affiché que si sa fraîcheur bancaire
est comparable ; sinon dernier solde conservé avec avertissement. La désactivation
explicite remet Linxo au premier plan et préserve les liens/canoniques existants.
Les sections suivantes décrivent le chemin Linxo historique, utilisé pour les
comptes non activés. Voir [mise en service et alertes](../enable-banking.md).

## 1. Lecture du solde dans le mail Linxo

`_extract_solde_from_status_bloc` (`src/` et `functions/transaction_parser.py`,
copies identiques) lit le bloc `STATUS ACCOUNT` de chaque compte :

| Libellé Linxo     | Cas                                |
| ----------------- | ---------------------------------- |
| `Solde du compte` | notification standard              |
| `Solde bas`       | solde passé sous le seuil d'alerte |
| `**** €`          | solde masqué : ignoré (`masked`)   |

Le texte est coupé avant « Prévisionnel » (solde à 30 jours, toujours masqué).
Un libellé inconnu donne `parse_error` : le solde du mail est ignoré, **mais
ses opérations sont importées quand même**.

## 2. Écriture (`sauvegarder_soldes_comptes`)

- Le solde du mail est la valeur de vérité : il est écrit tel quel.
- Il ne remplace le solde courant que si son `emailDate` est au moins aussi
  récente que celle du solde stocké. Un mail plus ancien (reparse, mail
  retraité par l'autre importeur) ne va que dans `account_balance_history`.

## 3. Contrôle de cohérence (audit, à l'import)

Avant l'écriture, `calcul_coherence_solde` compare le nouveau solde à
**solde précédent + transactions du compte reçues entre les deux mails**
(fenêtre sur `emailDate`, bornes : ancien exclu, nouveau inclus ; saisies
manuelles sans `emailDate` ignorées). Champs écrits :

| Champ           | Affiché (`BalanceCard`) |
| --------------- | ----------------------- |
| `previousSolde` | Solde précédent         |
| `linxoDelta`    | Mouvements identifiés   |
| `computedSolde` | Projection              |
| `ecart`         | Écart audit             |

Au-delà de la tolérance (`BALANCE_RECONCILIATION_TOLERANCE`, 0,01 €), le statut
passe à `pending_review`. Le contrôle ne bloque jamais l'écriture.

Limite : ces valeurs sont **figées** au dernier solde écrit. Si un solde n'est
pas lu (cas 1, `parse_error`), aucun contrôle n'a lieu et la carte reste « OK ».

## 4. Mouvements depuis le solde (en direct, côté front)

`mouvementsDepuisSolde` (`public/src/utils/balanceMapping.ts`) additionne les
transactions chargées du compte dont l'`emailDate` est **postérieure** à celle
du solde affiché. Normalement c'est 0 : un mail Linxo porte ses opérations et
son solde avec la même `emailDate`. Un total non nul signifie que des
opérations sont arrivées sans que le solde suive :

- solde non reconnu par le parser (ex. « Solde bas » avant `52505f4`) ;
- solde masqué (`**** €`) dans un mail qui contient des opérations : alerte
  normale, levée au prochain mail avec solde lisible.

## 5. Alertes affichées

| Condition                                                 | `BalanceCard` (desktop)   | Accueil mobile      |
| --------------------------------------------------------- | ------------------------- | ------------------- |
| Mouvements depuis le solde ≠ 0                            | « NON À JOUR »            | « Non à jour ±x € » |
| `pending_review`, ou `discrepancy_unresolved` non accepté | « À RÉVISER » / « Écart » | « Écart ±x € »      |
| Sinon                                                     | « OK »                    | —                   |

Sur mobile, « Non à jour » l'emporte sur « Écart ».

## Diagnostic d'un solde faux

1. Lire l'`emailDate` du solde stocké (historique du compte).
2. Chercher un mail Linxo plus récent pour ce compte : s'il existe, son solde
   n'a pas été lu (libellé inconnu ou masqué) → vérifier le bloc
   `STATUS ACCOUNT`, puis reparser le mail après correction.
3. Sinon, le solde Linxo lui-même diffère de la banque (synchronisation Linxo).

Références : `functions/main.py` (`_run_linxo_import_core`), `src/importer.py`
(`_persister`), `functions/balance_coherence.py`, `public/src/components/BalanceCard.tsx`,
`public/src/mobile/screens/HomeScreen.tsx`.
