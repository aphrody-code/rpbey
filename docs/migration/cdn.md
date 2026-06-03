---
title: "Migration CDN — cdn.service (Bun) → Vercel Blob + reads CDN"
description: "Plan + état de la migration du serveur d'images Bun (apps/cdn, cdn.service) : les uploads écrivant sur /var/www passent à Vercel Blob (upload-store.ts), les lectures d'assets statiques restent servies par cdn.rpbey.fr (HTTP, joignable depuis Vercel). Le serveur Bun reste l'autorité VPS jusqu'au cutover."
scope:
  - apps/web
status: "stable"
last_updated: "2026-06-04"
related_symbols:
  - processAndStore
  - storeUploadedImage
  - BLOB_READ_WRITE_TOKEN
---

# Migration CDN — cdn.service (Bun) → Vercel Blob + reads CDN

## Cible

| Flux | Avant (VPS) | Après (cloud) |
| --- | --- | --- |
| **Uploads** (avatars, bannières, deckboxes, contenu) | `upload-store.ts` écrit WebP dans `/var/www/cdn/static/data/rpb/uploads/` (FS) → URL `cdn.rpbey.fr/...` | **Vercel Blob** (`@vercel/blob` `put()`, `BLOB_READ_WRITE_TOKEN`) → URL `*.public.blob.vercel-storage.com` |
| **Lectures data/assets statiques** | `cdn.rpbey.fr/static/...` (nginx) | inchangé — fetch HTTP depuis Vercel (`data-cache.ts`), joignable tel quel |
| **`/api/assets/<scope>`, `/images/:id`** (serveur Bun `apps/cdn`) | `cdn.service` (Bun, `:8804`) sert le FS repo + `/var/www/cdn` | reste sur le VPS (assets repo/legacy) jusqu'au cutover DNS |

## Décisions

1. **Seul le chemin WRITABLE migre.** Sur Vercel il n'y a pas de FS persistant →
   `processAndStore` branche sur `BLOB_READ_WRITE_TOKEN` : si présent (Vercel),
   `@vercel/blob` ; sinon (VPS/dev), écriture FS `/var/www` comme avant. **Fix-forward**,
   zéro régression VPS.
2. **Les lectures restent du HTTP.** Le dashboard lit déjà ses données via
   `fetch(cdn.rpbey.fr/...)` (`data-cache.ts`, branche `VERCEL=1`) — ces URLs
   restent valides depuis Vercel. Pas besoin de migrer la lecture d'assets pour
   rendre le site fonctionnel sur Vercel.
3. **`*.public.blob.vercel-storage.com`** ajouté à
   `next.config.ts → images.remotePatterns` pour l'optimisation d'images Next.
4. Le serveur Bun `apps/cdn` (`/api/assets`, `/images`) n'est **pas** indispensable
   au rendu Vercel du dashboard → on le **garde sur le VPS** comme source d'assets
   legacy jusqu'au cutover, puis on pourra le retirer ou le porter en route Next
   `/api/cdn/[...]` + Blob si on veut tout couper du VPS.

## État (Phase 5 — exécutée 2026-06-04)

- `@vercel/blob@2.4.0` ajouté à `apps/web`.
- `apps/web/src/server/services/upload-store.ts` : `processAndStore` écrit sur
  **Vercel Blob** quand `BLOB_READ_WRITE_TOKEN` est défini, sinon FS VPS.
- `next.config.ts` : host Blob whitelisté pour `next/image`.
- `BLOB_READ_WRITE_TOKEN` est déjà fourni par l'environnement Vercel (storage Blob
  rattaché au projet) — à confirmer dans les env du projet `rpbey` (sinon créer un
  store Blob et rattacher).

## Reste human-gated

- **Rattacher un store Vercel Blob** au projet `rpbey` (Vercel → Storage → Blob)
  si `BLOB_READ_WRITE_TOKEN` n'est pas déjà injecté en prod.
- **Retrait de `cdn.service`** (VPS) : seulement après cutover DNS + vérification
  que plus aucune lecture critique n'en dépend (les `cdn.rpbey.fr/static/*` peuvent
  rester servis par nginx indéfiniment sans le serveur Bun).
