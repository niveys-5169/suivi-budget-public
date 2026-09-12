# Guide de Configuration des Variables d'Environnement sur Vercel

Suite à la migration de l'hébergement frontend de Firebase vers Vercel, le processus de build (exécuté par Vercel) nécessitera d'avoir accès à l'ensemble de vos variables d'environnement frontend (souvent préfixées par `VITE_`).

Ce guide pas-à-pas explique comment configurer ces variables de manière sécurisée et adaptée sur le tableau de bord Vercel.

---

## 1. Connecter le projet GitHub à Vercel

1. Rendez-vous sur le site [Vercel](https://vercel.com/) et connectez-vous (via GitHub, de préférence).
2. Cliquez sur le bouton **"Add New..."** en haut à droite, puis sélectionnez **"Project"**.
3. Dans la liste **"Import Git Repository"**, recherchez votre dépôt `Suivi-Budget`.
4. Cliquez sur le bouton **"Import"**.
5. Vercel va automatiquement détecter qu'il s'agit d'un projet **Vite** (Framework Preset : Vite).

## 2. Configurer les Variables d'Environnement (Premier Déploiement)

Juste avant de cliquer sur le bouton _Deploy_ lors de l'étape 1 :

1. Dépliez la section **"Environment Variables"**.
2. Copiez chaque variable de votre fichier `.env` (ex. `.env.local` ou vos secrets GitHub liés au front) une par une.
3. Remplissez le champ **Name** (ex: `VITE_FIREBASE_API_KEY`) et le champ **Value** avec sa valeur.
4. Cliquez sur **"Add"**.
5. Répétez l'opération pour toutes les variables requises (ex : ID Projet, Sender ID, App ID, Measurement ID, endpoints d'API, etc.).
6. Cliquez enfin sur le bouton bleu **"Deploy"**.

## 3. Gérer les Environnements (Production, Preview, Development)

Vercel permet d'utiliser des variables différentes selon les environnements (utile si vous avez un projet Firebase "Dev" et un "Prod").

1. Depuis le tableau de bord Vercel, sélectionnez votre projet `Suivi-Budget`.
2. Cliquez sur l'onglet **"Settings"** en haut de la page.
3. Dans le menu de gauche, cliquez sur **"Environment Variables"**.
4. Vous avez alors la possibilité d'ajouter de nouvelles variables ou de modifier les existantes.
   - Lors de la création d'une variable, vous pouvez cocher/décocher les environnements pour lesquels elle s'applique :
     - **Production** : Branche par défaut (`main`), génère le domaine principal.
     - **Preview** : Branche de Pull Request, génère une URL de prévisualisation temporaire.
     - **Development** : Environnement lié au terminal local `vercel dev` (pas forcément utile si vous utilisez `npm run dev` avec un fichier `.env.local`).

## 4. Mettre à jour les variables après modifications

Si vous modifiez ou ajoutez une variable d'environnement sur Vercel :

- **L'application existante (en ligne) ne sera pas automatiquement mise à jour.**
- Vous devrez déclencher un nouveau déploiement.
  - Allez dans l'onglet **"Deployments"**, cliquez sur les trois petits points `...` à droite de votre dernier déploiement, et sélectionnez **"Redeploy"** pour que les nouvelles variables soient injectées lors du build.

## ⚠️ Checklist des Variables Importantes

Vérifiez bien que vous avez configuré au minimum les variables suivantes (liste non exhaustive, à adapter selon votre `.env`) :

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- (Toutes les éventuelles autres clés liées aux intégrations tierces, backend etc., nécessaires _uniquement côté frontend_).
