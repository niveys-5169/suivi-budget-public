# ✅ CHECKLIST FINALE : Patrimoine Fix

## 🎯 Résumé rapide

Le calcul du patrimoine (Romane) est maintenant correct ! Le filtre par propriétaire fonctionne pour **tous** les comptes.

- ✅ **Code backend** : Prêt (ajoute `owner` aux soldes)
- ✅ **Code frontend** : Prêt (filtre par `owner`)
- ⏳ **Config Firestore** : À initialiser (1 seule fois)

---

## 🔧 Faire une seule fois

### Step 1️⃣ : Initialiser la configuration dans Firestore

**Soit** via console Firestore (simple) :

1. Ouvrez https://console.firebase.google.com → Projet **suivi-budget-ab888** → Firestore
2. Créez un nouveau document dans la collection `metadata` nommé `account_owners_mapping`
3. Copiez-collez ce contenu :

```json
{
  "accounts": {
    "BforBank": "Nicolas",
    "LCL": "Nicolas"
  },
  "savings_patterns": {},
  "default_owner": "Nicolas"
}
```

**Ou** via Terminal (si vous avez FIREBASE_CREDENTIALS) :

```bash
cd <chemin-du-depot>
python scripts/init_account_owners_mapping.py
```

✅ **Voilà !** La config Firestore est créée.

---

### Step 2️⃣ : (OPTIONNEL) Ajouter des épargnes Linxo personnalisées

Si vous avez des épargnes avec noms spécifiques (ex: "Livret Sienna", "Livret Romane"), dans Firestore `metadata/account_owners_mapping`, ajoutez dans le champ `savings_patterns` :

```json
"savings_patterns": {
  "Livret Sienna": "Sienna",
  "Livret Romane": "Romane",
  "Livret Nicolas": "Nicolas"
}
```

---

## 🧪 Vérifier que ça marche

### Test 1: Nouvelle donnée

1. Lancez un import Linxo :

   ```bash
   python src/importer.py
   ```

2. Vérifiez dans Firestore:
   - `account_balances/BforBank` doit avoir un champ `owner: "Nicolas"`
   - `account_balances/LCL` doit avoir un champ `owner: "Nicolas"`
   - Les `savings_balances/{compte}` doivent aussi avoir `owner`

### Test 2: Dashboard Filter

1. Ouvrez le dashboard → Onglet **Patrimoine**
2. Cliquez sur **"Nicolas"** dans les boutons propriétaire
3. Vérifiez :
   - ✅ "Courants" affiche BforBank + LCL seulement
   - ✅ "Épargne" affiche les épargnes Nicolas seulement
   - ✅ Le total change
4. Décochez Nicolas, les comptes disparaissent

✅ Si ça marche → **Vous êtes bon !**

---

## 📊 Aperçu des changements

### Backend qui enregistre `owner`

- `src/firebase_db.py` : Nouvelles fonctions + modification des sauvegardes

### Frontend qui filtre par `owner`

- `public/src/patrimoine.js` : Filtre courants + épargnes par propriétaire

### Config Firestore

- `metadata/account_owners_mapping` : Mapping extensible (pas de redéploiement code)

---

## ❓ Questions fréquentes

**Q: Mes anciens soldes n'affichent pas l'owner ?**  
A: Normal ! Les vieux soldes sans `owner` = utilisent "Nicolas" par défaut.

**Q: Comment ajouter un nouveau compte (ex: Romane) ?**  
A: Éditez `metadata/account_owners_mapping` dans Firestore, ajoutez `"RomaneAccount": "Romane"` dans `accounts`. Voilà !

**Q: Dois-je redéployer le code ?**  
A: Non ! La config est 100% dans Firestore. Modification = immédiate.

---

## 🚀 C'est tout !

Une fois l'étape 1 faite, tout devrait marcher. Les prochains imports auront automatiquement `owner`.

Bon test ! 🎉
