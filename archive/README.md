# Archive

Ce dossier conserve le code historique de l'application **Suivi-Budget** avant la refonte Premium (React/TS).

## `legacy-webapp/`

Première implémentation web sous forme d'une SPA monolithique en JavaScript vanilla. Plus aucun fichier de la build Vite active (`public/src/`) ne référence ces sources.

| Fichier                          | Origine                              |
| -------------------------------- | ------------------------------------ |
| `old_app.js`                     | Application complète, version 1      |
| `old_transactions.js`            | Module transactions, version 1       |
| `app_with_bridge.js`             | Variante avec pont Apps Script       |
| `src-app.js` (ex `src/app.js`)   | Racine `src/` désactivée par Vite    |

## `google-apps-script/`

Backend initial hébergé sur Google Apps Script (avant migration vers Firebase + Cloud Functions).

| Fichier              | Origine                                                  |
| -------------------- | -------------------------------------------------------- |
| `Code.gs`            | Endpoints Apps Script (parsing emails, écriture Drive)   |
| `DriveApiUtils.gs`   | Utilitaires d'accès à Google Drive                       |

## Pourquoi conserver ?

- Référence pour reproduire des comportements métier hérités lors du portage des dernières features.
- Auditabilité (revue financière, parcours utilisateur historique).

Ces fichiers ne sont **pas** inclus dans la build production. Vite a pour racine `public/`, donc tout ce qui est hors `public/` est ignoré par défaut.
