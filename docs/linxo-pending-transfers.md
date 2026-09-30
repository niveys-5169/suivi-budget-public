# Notifications Linxo répétées de virements en attente

## Incident du 30 septembre 2026

Linxo a notifié le même virement LCL `INSTANTANE` de −1 500 € les 29 et
30 septembre, encore marqué « Opération en attente », avec une date différente
dans chaque mail. Les deux mails indiquaient le même solde LCL, 1 358,99 €.
L'application a créé une seconde ligne et un écart d'audit de 1 500 €.

La clé stricte de `deduplicate` inclut la date : ces notifications n'étaient
donc pas identiques pour elle. L'import incrémental réadmet les doublons
« probables » (même compte et montant à ±3 jours), afin de conserver les vrais
achats de même montant. La réconciliation existante ne remplaçait une ligne en
attente qu'à réception d'une opération **réalisée**.

## Règle appliquée avant la réconciliation

`reconcile_pending` filtre désormais les répétitions de virements génériques :

- Les deux opérations sont explicitement `enAttente: true`.
- Le compte, le montant à deux décimales et le libellé sont identiques.
- Le libellé, après suppression des espaces périphériques, est exactement
  `INSTANTANE` ou `SEPA`.
- L'écart entre les dates est au maximum de trois jours, bornes incluses.

Le filtre compare les nouvelles notifications aux documents existants et aux
autres notifications du lot. Sans document existant, il traite les dates dans
l'ordre chronologique, même si Gmail livre les mails dans l'ordre inverse.
La sortie conserve l'ordre d'entrée des lignes retenues.

La ligne déjà stockée reste intacte : date, catégorie, commentaire et pointage
ne sont pas réécrits. Une notification ignorée ne prolonge pas la fenêtre de
trois jours. Le filtre conserve le nombre maximum d'occurrences notifiées
sur une même date : deux lignes identiques le même jour ne sont pas fusionnées
par cette nouvelle règle. Ce garde-fou ne change pas les clés d'identification
utilisées ensuite par la sauvegarde Firestore.

Cartes, prélèvements, libellés différents, comptes différents, montants différents
et opérations déjà réalisées ne relèvent pas de ce filtre. La réconciliation
« en attente → réalisée » continue à fonctionner ensuite. Les soldes des mails
continuent à être traités même si toutes leurs transactions sont filtrées.

## Limites et livraison

Les mails n'offrent pas d'identifiant bancaire stable pour ces virements.
La règle est donc une heuristique ciblée : deux véritables virements en attente
de même compte, montant et libellé générique sur des dates différentes à trois
jours d'écart maximum peuvent être confondus. Les autres libellés restent
exclus pour limiter ce risque.

Le module est identique dans `src/dedup.py` (GitHub Actions : import quotidien
et reparse) et `functions/dedup.py` (Cloud Functions : import manuel, polling
et notifications Gmail). Vérifier les copies avec
`python scripts/check_python_copies.py` et exécuter :

```powershell
python -m pytest tests/test_dedup.py tests/test_main_linxo_import.py tests/test_importer_balances.py
```

Le correctif doit être publié dans le dépôt pour les GitHub Actions et déployé
dans les Cloud Functions pour leurs imports. Il prévient les nouveaux doublons ;
il ne supprime pas les documents déjà créés et ne recalcule pas leur ancien audit.
