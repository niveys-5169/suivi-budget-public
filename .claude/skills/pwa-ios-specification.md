---
name: progressive-web-app-pwa
description: Spécification d'audit et de génération de PWA aux standards stricts Apple iOS 17.4+ et iOS 18.
---

# Spécification PWA iOS

Cette compétence guide la mise en conformité d'une application web pour obtenir une expérience native fluide (60fps) sur iPhone :
1. **Viewport & Métadonnées** : Injection de `viewport-fit=cover`, activation du mode `standalone`, et barre d'état `black-translucent`.
2. **Safe Areas** : Application des paddings dynamiques CSS `env(safe-area-inset-top)` et `bottom`.
3. **Contraintes de Saisie** : Forcer la taille de police des inputs à `16px` (`text-base`) minimum pour bloquer le zoom Safari.
4. **Apparence** : Fixation de la couleur de fond sur `#0A0A0B` pour éviter les flashs blancs système.