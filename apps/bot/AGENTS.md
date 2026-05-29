# AGENTS.md — rpbey Discord bot

Guide pour un agent IA qui modifie ce bot. Lis-le **avant** d'éditer. Les
sections « Pièges durs » sont des invariants : les violer compile parfois mais
casse au runtime.

## 1. Ce que c'est

Bot Discord communauté Beyblade (tournois, classements, gacha TCG, économie,
duels). Stack : **Bun** + **discordx** (fork `@rpbey/discordx`) + **tsyringe** DI
(`@rpbey/di`) + **discord.js v14.26.3**. Rendu d'images via `@aphrody-code/canvas`
(Skia natif) + `sharp`. DB **Postgres local** (socket unix) via **Drizzle**
(`@rpbey/db`). Cache **Redis** (client Bun natif). **Aucune IA/LLM** : toute
« intelligence » est algorithmique (scoring combat, probabilités gacha, ELO,
seuils de rôles).

## 2. Démarrage (`src/index.ts`)

Ordre **non négociable** :

1. `import "reflect-metadata"` en TOUTE PREMIÈRE ligne (sinon la DI tsyringe casse).
2. `DIService.engine = tsyringeDependencyRegistryEngine.setInjector(container)`.
3. `import "./_entry-imports.generated.ts"` — side-effect import de TOUS les
   fichiers décorés `@Discord`. **Auto-généré** par `scripts/gen-entry-imports.ts` :
   ne l'édite jamais à la main ; régénère-le si tu ajoutes une commande/event.
4. `claimSingletonOrExit()` (lock PID, exit(11) si une autre instance tourne),
   `startApiServer(3001)`, `setupEventBridge()`, login Discord.

## 3. Carte des dossiers (`src/`)

| Dossier                             | Rôle                                                              |
| ----------------------------------- | ----------------------------------------------------------------- |
| `commands/{Admin,Beyblade,General}` | 23 commandes slash (`@Discord`/`@Slash`/`@SlashGroup`).           |
| `components/`                       | Handlers de boutons/selects/modals (`@ButtonComponent`, etc.).    |
| `events/`, `events/guild/`          | 9 listeners (`@On`/`@Once`).                                      |
| `cron/tasks/` + `cron/index.ts`     | 7 tâches planifiées actives (`Bun.cron`) sur 11 fichiers `tasks/` (3 désactivées). |
| `guards/`                           | Guards discordx (`@Guard`).                                       |
| `services/`                         | Services injectables (DI singletons).                             |
| `lib/`                              | Cœur non-Discord : DB, cache, UI, moteurs, canvas, API, scrapers. |
| `lib/canvas/`, `lib/scrapers/`      | Primitives image / scrapers Challonge & co.                       |

## 4. Couche données — façade `lib/prisma.ts`

La DB est **Drizzle** (`@rpbey/db` → `{ db, schema }`), mais le bot l'interroge via
une **façade qui émule l'API Prisma** (`lib/prisma.ts`, ~900 lignes ;
`export const prisma`, injecté/importé). On garde la façade : ~295 call-sites
fonctionnent dessus sans réécriture. **N'appelle PAS Drizzle directement** dans
les commandes — passe par `this.prisma` / `prisma`.

Ce que la façade supporte (vérifié) : `findFirst/findMany/findUnique`, `create`
(+ nested writes), `createMany`, `update`, `updateMany`, `upsert`
(`onConflictDoUpdate`, clés composées), `delete/deleteMany`, `count`, `_count`,
`include` profond avec re-aliasing, `select`, `where` (relations, `in`, `not`,
`contains`+`mode:insensitive`), `{increment}`, `distinct`, `$transaction`
(forme callback = transaction Drizzle réelle ; **évite la forme tableau** qui
parallélise au lieu de sérialiser).

**Pièges data :**

- **Relations re-aliasées** : Drizzle nomme les relations différemment de Prisma.
  La façade ré-aliase (`deck.items`, `user.profile`, `part_bladeId → blade`, …).
  Reste dans le vocabulaire Prisma côté commandes.
- **Timestamps `mode:"string"`** : les colonnes timestamp renvoient/attendent des
  **strings**. Pour écrire une date : `new Date().toISOString()`, jamais un objet `Date`.
- **PK string sans default** : la façade génère l'`id` (cuid2) si omis ; ne fournis
  pas d'`id` manuel sauf tables à id externe (discordRole/Channel).
- **Codes d'erreur** : postgres-js lève SQLSTATE `23505` (unique), pas `P2002`.
  Le code tolère les deux où c'est de l'idempotence.
- Exception : `lib/gacha-api.ts` parle à un serveur gacha externe (port 5050) en
  `pg.Pool` brut — c'est volontaire, ne le migre pas vers la façade.

## 5. Sous-systèmes consolidés (single source of truth)

| Module                    | Rôle                                                                                                                                                                                                                  | Ne PAS recréer ailleurs                                   |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `lib/battle-engine.ts`    | **3 variantes** de combat unifiées : `beyblade-x` (GameGroup), `tcg-duel` (DuelCommand, ELO K=32), `quick-battle` (battle-utils). Constantes par variante figées — **ne re-équilibre rien** sans intention explicite. | Pas de 4ᵉ moteur inline.                                  |
| `lib/ranking-provider.ts` | Calcul de points/agrégation partagé (BTS + Stardust). `loadPointsConfig`, `compareRankEntries`, `FINISH_BUCKET_MAP`.                                                                                                  | Pas de `POINTS_BY_FINISH` dupliqué.                       |
| `lib/role-sync.ts`        | `syncRolesByThreshold()` générique : **un seul** `guild.members.fetch()`, add/remove batchés par 25.                                                                                                                  | Les crons SyncRankingRoles/SyncSatrRoles délèguent ici.   |
| `lib/ranking-panel.ts`    | `renderRankingPanel()` (embed + canvas + composants) ; `listSeasons` caché (Redis 24h), `invalidateSeasonsCache()`.                                                                                                   | —                                                         |
| `lib/ui.ts`               | Factory UI (voir §6).                                                                                                                                                                                                 | Pas de `new EmbedBuilder` inline pour erreur/succès/info. |
| `lib/cache.ts`            | Cache Redis générique (voir §7).                                                                                                                                                                                      | Pas de `Map` cache mémoire pour des données chaudes.      |

## 6. UI — `lib/ui.ts`

- **Messages courts** (erreur/succès/avertissement/info) : `errorEmbed`,
  `successEmbed`, `warningEmbed`, `infoEmbed`. **N'inline jamais** un EmbedBuilder
  pour ça.
- **Boutons/rows** : `confirmRow`, `paginationRow`, `linkButton`, `actionButton`.
- **Components V2** (panels d'affichage canvas) : `v2ProfilePanel`,
  `v2GachaPullPanel`, `v2DuelResultPanel`, `v2DeckPanel`, `v2BattlePanel`,
  `v2Container`, `v2ImageCard`.
  - **Règle V2 all-or-nothing** : un message V2 (`flags: MessageFlags.IsComponentsV2`)
    ne peut PAS porter `embeds` ni `content`. Images → `MediaGalleryItemBuilder.setURL('attachment://x.png')` + `files:[new AttachmentBuilder(buf,{name:'x.png'})]` (le nom DOIT matcher).
  - V2 réservé aux **affichages** ; les flux interactifs multi-étapes restent en
    embeds classiques factorisés.
- **`customId` = contrat** : ne renomme jamais un `customId` sans mettre à jour le
  `@ButtonComponent`/`@SelectMenuComponent` correspondant dans `components/` — sinon
  le handler ne matche plus.

## 7. Cache — `lib/cache.ts`

`cached(key, ttl, compute)`, `cachedBuffer(...)` (PNG base64, survit au reboot),
`cacheGet/Set`, `cacheDel`, `TTL` (`STATIC` 24h, `RANKING` 5min, `CARD` 1h,
`SHORT` 60s). **Best-effort** : une panne Redis dégrade la latence, ne casse jamais
une commande. Clés `rpb:cache:<domaine>:<id>`. Invalide après écriture (ex. cron
ranking → `cacheDel`/`invalidateSeasonsCache`).

## 8. Cron — `cron/index.ts`

**`Bun.cron` n'existe qu'en Bun ≥ 1.3** : sous 1.2.x les crons sont morts
silencieusement (`Bun.cron is not a function`). Le bot **requiert Bun 1.3+**.
Tâches : LiveTournamentSync (5min), PreTournamentSync (horaire), TournamentReminder
(:30), SyncRankingRoles + SyncSatrRoles (30min), BBX meta (ven 18h), MentionsScan
(6h), nettoyage sessions (quotidien, 01:00 UTC). Évite tout travail lourd bloquant ; parallélise les
`await` indépendants (`Promise.all`).

## 9. API & lien avec le dashboard Next

`lib/api-server.ts` (`Bun.serve`, port 3001) : `/health` `/ready` `/metrics`
publics ; routes scrape/tournois protégées (Bearer `BOT_API_KEY`) ; WebSocket `/ws`
(topics `logs`/`bot-events`/`discord-events`). Le dashboard Next consomme status/logs
(REST) + un pont SSE. **DB partagée** : bot et web lisent/écrivent le même Postgres
(`users`, `tournaments`, `*Rankings`, gacha…). Auth web = better-auth (tables
`users/accounts/sessions`) que le bot lit pour résoudre discordId → id.

## 10. Pièges durs (invariants runtime)

1. **DI + `import type`** : une classe injectée (service, commande consommée) DOIT
   être `import { Class }`. `import type` efface `Reflect.metadata("design:paramtypes")`
   → l'injection devient `undefined` au runtime. Idem jamais d'`import type` sur les
   classes décorées.
2. **`reflect-metadata` en première ligne** de `index.ts` (et chargé avant tout
   usage DI dans les tests).
3. **Build = SWC** (`.swcrc`, legacy decorators + `emitDecoratorMetadata`), pas
   `bun build`. `bun run build` → `swc -d dist src`. tsc ne sert qu'au type-check.
4. **`Bun.$` rejette les NUL bytes** : pour piper du binaire, `Bun.spawn([...], {stdin:"pipe"})`.
5. **`.env` Bun substitue `$VAR`** : échappe `\$` (les quotes simples ne protègent pas).
6. **Bun only** : pas de `node`/`npm`/`tsx`.

## 11. Build & validation

```bash
cd ~/rpbey/apps/bot
bunx tsc --noEmit     # type-check → 0 erreur attendu
bun run build         # SWC → dist/ (~106 fichiers)
bun run start         # lance le bot (Bun 1.3+)
```

Toute modif doit laisser `tsc` à 0 **et** `bun run build` vert. Pas de commit
automatique par un agent sans demande explicite.
