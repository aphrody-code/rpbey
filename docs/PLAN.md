---
title: "Autopilot Plan"
description: "Plan d'action pour la finalisation de la migration serverless et les reliquats cosmétiques."
scope:
  - apps/web
  - scripts
status: "stable"
last_updated: "2026-06-04"
---

# Autopilot Plan

Backlog des tâches ouvertes à exécuter de manière autonome :

- ✅ (1a) Créer `apps/web/codegen.ts` pour GraphQL typed documents
- ⏳ (1b) Recâbler le comparateur client sur le SDK : `ComparateurClient` → `globalSearch`
- ⏳ (1b) Recâbler bey-library client sur le SDK : `bey-library` → `listParts`
- ⏳ (harness) Créer `scripts/contract-smoke.ts` pour valider chaque route vs Zod
- ⏳ (cache) Migrer les `unstable_cache` restants vers `'use cache'` dans `lib/twitch`, `lib/tiktok` et `actions/brackets`
- ⏳ (cache) Activer `cacheComponents` par périmètre validé
- ⏳ (vercel) Tester le build de production front contre une API distante
