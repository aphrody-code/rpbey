# ADR-001 — Migrate from Puppeteer to bxc curl-impersonate

**Date** : 2026-05-10
**Status** : Accepted
**Deciders** : maintainer (37252373+aphrody-code@users.noreply.github.com)

## Context

`@rose-griffon/challonge` v2 utilise Puppeteer + puppeteer-extra-plugin-stealth + rebrowser-puppeteer-core pour scraper challonge.com (Cloudflare-protégé). Cette stack a 4 problèmes :

1. **Détection Cloudflare avril 2025** : Cloudflare détecte le leak `Runtime.enable` de puppeteer-extra-stealth. Mitigation `useRebrowser: true` patch puppeteer-core mais n'est pas une solution définitive — chaque mise à jour Cloudflare casse potentiellement le bypass.
2. **Resource cost** : ~250-400 MB RAM par scrape (Chromium subprocess + V8 isolate + DOM), cold start 3-5s. Pour un bot Discord qui scrape ~10 tournois/jour, c'est sur-dimensionné.
3. **Maintenance** : 4 deps à maintenir (`puppeteer 24.36`, `puppeteer-extra 3.3.6`, `puppeteer-extra-plugin-stealth 2.11.2`, `rebrowser-puppeteer-core 23`). Chacune a son propre cycle de release et risque de divergence.
4. **Vercel constraint** : `apps/rpbey` (Next.js sur Vercel) ne peut pas faire FFI / spawn Chromium. Le workaround actuel proxie tout via `apps/rpb-bot` qui héberge Chromium. C'est fragile : si rpb-bot tombe, rpbey ne peut plus afficher les brackets.

`@aphrody-code/bxc` (workspace dep) expose un `BxcTransport` au-dessus de `libcurl-impersonate` (lexiforest v1.5.6) via `bun:ffi` — résout les 4 points :

1. **TLS-fingerprint identique à Chrome 131** au niveau handshake. Pas de runtime JS, pas de leak `Runtime.enable` à détecter. JA3/JA4 identiques au vrai Chrome 131.
2. **~50-100 MB RAM**, cold start <150ms. Le `.so` libcurl-impersonate est chargé une fois, partagé entre toutes les requests.
3. **1 dep à maintenir** (`@aphrody-code/bxc`). Mises à jour de `chrome131` profile sont gérées en interne au projet bxc.
4. **Bun-native FFI uniquement** — pas de spawn subprocess. (Vercel reste exclu pour `bun:ffi`, mais le path d'exposition reste via rpb-bot — pas de regression.)

## Decision

Migrer `@rose-griffon/challonge` v2 → v3 en remplaçant l'ensemble Puppeteer par `BxcTransport`. **API publique préservée** (13 sub-paths exports + `ChallongeScraper` class signature inchangée) pour ne pas casser les 7 callers `apps/rpb-bot/`.

## Consequences

### Positive

- **Performance** : cold start /35x plus rapide, RAM /4-5x plus faible, latency /5x plus faible.
- **Robustesse Cloudflare** : pas de leak puppeteer-extra à détecter, le TLS fingerprint match Chrome au handshake. Cookie `cf_clearance` reste nécessaire (rotation manuelle), mais le bypass Cloudflare lui-même est plus résilient.
- **Simplification stack** : 4 deps removed, 1 added. Code lisible (BxcTransport ~400 LOC vs subprocess management ~800 LOC).
- **Bxc ré-utilisable** : autres apps vps (rpbey, rpb-dashboard) peuvent consommer bxc workspace dep. Une seule source de vérité pour le scraping.
- **Tests** : 121 → 194 tests (+73 nouveaux pour transport, scraper, observability, regression goldens).

### Negative

- **`/stations` endpoint non porté** : `scraped.stations = []` en v3.0.0. Acceptable post-finalize (tournoi terminé), bloquant si on veut afficher live stations en cours. À porter en v3.1.0.
- **`match.groupId = null`** : non populé. Utilisé seulement dans logging, pas critique.
- **`page.evaluate(<arbitrary JS>)` n'est plus supporté** : 4 callers historiques utilisaient ce pattern pour extraire du DOM. Migrés vers `dumpChallongeRaw(slug, sub)` qui retourne `{ html, store, parsed }`. La donnée `_initialStoreState` est inline dans le HTML statique — n'a jamais été nécessaire d'évaluer du JS pour la lire.
- **Cookie jar refresh** : `cf_clearance` rotation reste manuelle. À automatiser dans v3.1+ via Lightpanda harvest puis cache.
- **`libcurl-impersonate` chrome131 profile** : doit être bumpé tous les ~6 mois. Constante centralisée + env override `BXC_IMPERSONATE_PROFILE` permet de passer à `chrome142+` sans rebuild.

### Neutral

- **Lightpanda envisagé puis écarté** : on prévoyait Lightpanda comme fallback `fast` profile pour les pages SPA-hydratées (`/log` paginé). POC Phase 0 a montré que le HTML statique de Challonge contient déjà `_initialStoreState['LogEntryListStore']` inline (avec pagination metadata `{currentPage, totalPages, totalCount}`). Pas besoin d'hydrate JS.
- **rpbey (Vercel)** : a un duplicate vendoré similaire dans `src/lib/challonge-vendor/`. Out of scope de cette migration. À traiter en migration séparée (probablement dual-vendor de bxc FFI runtime n'est pas possible sur Vercel — il faudra un service-worker proxy via rpb-bot).

## Alternatives considered

### A — Continue avec rebrowser-puppeteer-core

- Pro : pas de migration, fonctionne aujourd'hui.
- Con : ne résout pas le RAM/latency, fragile à chaque update Cloudflare.

### B — FlareSolverr / Byparr (proxy server)

- Pro : "drop-in" replacement, solverr-compat API.
- Con : 500 MB+ RAM par instance, captcha solvers cassés Jan 2026 (FlareSolverr), maintainer activity faible.

### C — Migrer vers Playwright + nodriver

- Pro : maintainers actifs, CDP propre.
- Con : nodriver est Python-only, Playwright a les mêmes problèmes que Puppeteer (Chromium heavy). N'élimine pas les deps natives.

### D — bxc workspace dep (chosen)

- Pro : 35x cold start, 4-5x RAM, 5x latency, 0 subprocess, FFI partagé.
- Con : `bun:ffi` Linux-only (Vercel exclu — déjà le cas avec Puppeteer), `chrome131` profile à bumper.

## Implementation

5 phases, 12 sub-agents, ~3h wall-clock :

- **Phase 0** (POC) : valide profile=http suffit pour /log paginé.
- **Phase 1** : workspace migration `mv ~/bunmium/bxc ~/vps/packages/bxc` + BxcTransport + facade.
- **Phase 2** : 4 modules réécrits en parallèle (reverse, htmlrewriter, scraper, proxy).
- **Phase 3** : observability events JSON stderr.
- **Phase 4** : shadow-mode + suppression duplicate `apps/rpb-bot/src/services/challonge/` (5233 LOC).
- **Phase 5** : cleanup deps + release v3.0.0 + docs.

Voir [`CHANGELOG.md`](./CHANGELOG.md) et [`MIGRATION.md`](./MIGRATION.md).

## References

- bxc package : `~/vps/packages/bxc/` (workspace dep `@aphrody-code/bxc`)
- bxc FFI : `packages/bxc/src/ffi/curl-impersonate.ts` + `vendor/curl-impersonate/libcurl-impersonate.so.4.8.0`
- Audit Puppeteer / extra-stealth / rebrowser : `packages/bxc/docs/PUPPETEER-AUDIT.md`
- POC Phase 0 outputs : `/tmp/poc-http-log.html` (200 OK, 67 KB, LogEntryListStore inline)
- Plan : `~/.claude/plans/imperative-spinning-pumpkin.md`
- Sub-agents : a3a24c3f (Phase 1), a5b5a46c (2A), a7ea28ed (2B), ad2af27e (2C), aa81c84d (2D), ac63a5a7 (Phase 4), a1178e02 (Puppeteer audit)
