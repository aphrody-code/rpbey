# Migration guide v2.x to v3.0.0

## TL;DR

Aucune modification de code consommateur requise dans 95% des cas. L'API publique est préservée.

Le scraper `ChallongeScraper` ne lance plus Chromium — il utilise `BxcTransport` (curl-impersonate Chrome 131 via `bun:ffi`). Les options Puppeteer-style (`headless`, `viewport`, `blockResources`, `useRebrowser`, `navigationTimeoutMs`) sont silencieusement ignorées.

## What broke (and how to fix)

### 1. `scraper.openPage(url).evaluate(<arbitrary JS>)`

**Avant** :

```typescript
const page = await scraper.openPage(url);
const result = await page.evaluate(`document.querySelectorAll('.match-row').length`);
```

**Maintenant** : `evaluate()` ne supporte que `() => window._initialStoreState`. Toute autre expression lève une `CurlImpersonateError` claire pointant vers `dumpChallongeRaw`.

**Migration** :

```typescript
import { dumpChallongeRaw } from "@rose-griffon/challonge";

const { html, store, parsed } = await dumpChallongeRaw(slug, "module");
// store = { TournamentStore: {...}, LogEntryListStore: [...], ... }
// parsed = ChallongeTournamentSnapshot | null

// Si tu cherchais du DOM ad-hoc, parse le HTML avec HTMLRewriter ou regex :
const matchRowCount = [...html.matchAll(/<tr[^>]*class="match-row/g)].length;
```

### 2. `scraper.openPage(url).waitForFunction(...)` / `waitForSelector(...)`

**Avant** : ces methods attendaient le rendu React.

**Maintenant** : no-op (resolve immédiatement). Le HTML statique de Challonge contient déjà `_initialStoreState` inline — pas besoin d'attendre.

### 3. `scraped.stations` retourne `[]`

Le `/stations` endpoint n'est pas encore porté. Si tu en as besoin, soit :
- Continuer à appeler le legacy (rollback temporaire — pas recommandé)
- Implémenter `getStations(slug)` au-dessus de `BxcTransport` (~100 LOC)
- Désactiver `withStations: false` dans tes appels `scrape()` pour éviter le warn log

### 4. `match.groupId` est `null`

Pour les tournois two-stage (round-robin pools + bracket), le `groupId` n'est plus populé. Ne pas l'utiliser pour distinguer pool vs bracket — utiliser plutôt `bracketSide === "RR"`.

## Cookie jar

Path inchangé : `/home/ubuntu/vps/storage/cookies/challonge_cookie.json`. Format Puppeteer JSON conservé. Le `loadCookieJar()` lit toujours `forFetch` / `forPuppeteer` / `raw`.

## Rollout progressif (production)

```bash
# Phase A — dual-run shadow-mode (24-72h)
ssh prod "echo 'RPB_CHALLONGE_BACKEND=both' >> /etc/rpb-bot/env && systemctl restart rpb-bot"
# Monitor logs : `journalctl -u rpb-bot -f | grep shadow.diff`
# Si diff < 1% sur 24h, passer à Phase B

# Phase B — full bxc
ssh prod "sed -i 's/RPB_CHALLONGE_BACKEND=both/RPB_CHALLONGE_BACKEND=bxc/' /etc/rpb-bot/env && systemctl restart rpb-bot"
# Monitor 7 jours

# Phase C — cleanup (après 7j stable)
ssh prod "sed -i '/RPB_CHALLONGE_BACKEND/d' /etc/rpb-bot/env && systemctl restart rpb-bot"
# Default = "bxc" donc env var devient inutile
```

## Rollback

Si un bug critique se révèle :

### Rollback level 1 (zero-deploy, 30s)

```bash
ssh prod "sed -i 's/RPB_CHALLONGE_BACKEND=bxc/RPB_CHALLONGE_BACKEND=puppeteer/' /etc/rpb-bot/env && systemctl restart rpb-bot"
```

Note : nécessite que les deps puppeteer soient encore présentes dans rpb-bot/node_modules. Si Phase 5 cleanup les a supprimées, rollback level 2.

### Rollback level 2 (git revert, ~5min)

```bash
cd /home/ubuntu/vps
git revert 44b99fe50 # phase 4
git revert de06572b7 # phase 3
git revert f1907d238 # phase 2
git revert 2bad4ab73 # phase 1
bun install
sudo systemctl restart rpb-bot
```

### Rollback level 3 (full reset)

```bash
cd /home/ubuntu/vps
git reset --hard 86361f2ad # commit avant Phase 1 migration
bun install
sudo systemctl restart rpb-bot
```

## Observability

Activer JSON-structured logs :

```bash
RPB_CHALLONGE_OBSERVE=1 bun run scripts/finalize-tournament.ts B_TS5
```

Events à monitorer en prod :
- `transport.fetch` — toute requête HTTP, contient `url`, `status`, `durationMs`, `ok`
- `transport.cache.hit/miss` — efficacité du cache LRU
- `cookie.expired` — alerte rotation cookie nécessaire (cf_clearance)
- `shadow.diff` — divergence Puppeteer vs Bxc pendant phase A

Compatible `vector` / `Loki` / `Datadog Agent` — un JSON par ligne sur stderr.

## Performance baseline

| Metric | Puppeteer (v2) | Bxc (v3) |
|---|---|---|
| Cold start `scraper.scrape(B_TS5)` | ~3-5s | ~150ms |
| RAM peak per scrape | 250-400 MB | 50-100 MB |
| Latency `/log` page 1 | ~5-8s | ~1-2s |
| Concurrent scrapes safe | 1-2 (Chromium hog) | 5-10 (FFI shared lib) |

Mesures estimatives, à confirmer avec benchmark prod réel.

## Versions de référence

- `@aphrody-code/bxc: workspace:*` (commit `2bad4ab73` au 2026-05-10)
- `libcurl-impersonate v1.5.6` (lexiforest, vendored at `~/vps/packages/bxc/vendor/curl-impersonate/`)
- Profile TLS : `chrome131` (à bumper ~Apr 2026 avec libcurl-impersonate v1.6+)

## Support

- Issues : marquer `area:rpb-challonge` + `migration:v3`
- Slack : `#dev-bot`
- Docs : `/home/ubuntu/vps/packages/rpb-challonge/docs/{CHANGELOG,MIGRATION,ADR-001-bxc-migration}.md`
