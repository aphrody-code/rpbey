---
title: "Migration DB — Postgres local → Neon (managed)"
description: "Plan + procédure de migration de la base rpb_neon (socket local /var/run/postgresql) vers Neon Postgres managé (projet rpbey, org aphrody) : dump/restore, rewiring du client Drizzle sur DATABASE_URL, vérification par row-counts, secrets CI."
scope:
  - packages/db
status: "stable"
last_updated: "2026-06-04"
related_symbols:
  - client
  - db
  - DATABASE_URL
  - DIRECT_DATABASE_URL
---

# Migration DB — Postgres local → Neon (managed)

## Cible

| Élément | Avant (VPS) | Après (cloud) |
| --- | --- | --- |
| Moteur | Postgres 18 local, socket `/var/run/postgresql:5432`, base `rpb_neon`, user `ubuntu` (peer auth) | **Neon** Postgres 17, projet **`rpbey`**, org `aphrody` (`org-holy-smoke-94920538`) |
| Connexion app | `postgresql://ubuntu@/rpb_neon?host=/var/run/postgresql` (socket, sans mot de passe) | `DATABASE_URL` = endpoint **pooled** Neon (`...-pooler...`, `sslmode=require`) |
| Connexion migrations / restore | idem socket | `DIRECT_DATABASE_URL` = endpoint **direct** Neon (sans `-pooler`) |
| Accès | `@rpbey/db` (`packages/db/src/client.ts`), Drizzle + postgres-js | idem, mais lit `DATABASE_URL` en priorité |

> Neon expose **deux** connexion strings par branche : la **pooled** (PgBouncer,
> host `…-pooler.…`) pour le runtime applicatif (beaucoup de connexions courtes,
> serverless-friendly) et la **direct** (host sans `-pooler`) pour les opérations
> qui veulent une vraie session Postgres : `pg_restore`, migrations Drizzle,
> `CREATE EXTENSION`, etc. **Restore + migrate = direct ; runtime = pooled.**

## Décisions

1. **Une base unique partagée** (`@rpbey/db`) reste la source de vérité du schéma
   (~73 tables, Drizzle `schema.ts` + `relations.ts`). La migration ne change pas
   le schéma, seulement l'hôte.
2. **Projet Neon séparé** `rpbey` — ne JAMAIS toucher le projet `shenron`
   (`patient-star-28731823`) qui cohabite dans la même org.
3. **`client.ts` lit `DATABASE_URL`** s'il est défini, sinon retombe sur le socket
   local (`?? "/var/run/postgresql"`) pour garder le dev VPS et l'ancien chemin
   fonctionnels tant que le DNS n'est pas basculé (**fix-forward**, on ne casse
   rien). Le `prepare` est désactivé quand on passe par le pooler (PgBouncer en
   mode transaction ne supporte pas les prepared statements nommés).
4. **postgres-js** : avec une `DATABASE_URL`, on passe l'URL en 1er argument à
   `postgres()` ; les défauts socket ne s'appliquent plus.

## Procédure (exécutée en Phase 1)

```bash
# 1. Dump de la base locale (format custom, compressé)
pg_dump "postgresql://ubuntu@/rpb_neon?host=/var/run/postgresql" -Fc -f /tmp/rpb.dump

# 2. Restore vers Neon via la connexion DIRECT (pas la pooled)
pg_restore --no-owner --no-acl --no-comments -d "$NEON_DIRECT_URL" /tmp/rpb.dump

# 3. Vérification : les row-counts doivent matcher la source
#    (via Neon MCP run_sql + psql local)
```

### Rewiring `packages/db/src/client.ts`

`DATABASE_URL` (pooled) prioritaire, fallback socket pour le dev :

```ts
const url = process.env.DATABASE_URL;
export const client = url
  ? postgres(url, { max: 10, prepare: false })          // Neon pooled (PgBouncer)
  : postgres({ host: process.env.PGHOST ?? "/var/run/postgresql",
               database: "rpb_neon", username: "ubuntu", max: 10, prepare: true });
```

## Vérification

- `SELECT count(*)` sur un échantillon de tables (`users`, `profiles`,
  `tournament_matches`, `anime_frames`, `gacha_cards`) côté Neon (via MCP
  `run_sql`) == côté source (psql socket local). Voir la table de preuves dans
  le rapport de phase.
- `bun -e "import{db,schema}from'@rpbey/db';console.log(await db.select().from(schema.users).limit(1))"`
  avec `DATABASE_URL` exporté → renvoie une ligne depuis Neon.

## Secrets / CI

- `DATABASE_URL` (pooled) et `DIRECT_DATABASE_URL` (direct) sont fournis aux
  surfaces cloud via leurs propres stores : **Vercel env** (web), **GCP Secret
  Manager** (bot Cloud Run), **GitHub Actions secrets** (crons). Jamais commités.
- Le secret repo GitHub `DATABASE_URL` alimente les workflows cron (Phase 3).

## Reste human-gated

- **Basculer le DNS / désactiver le Postgres local** : ne PAS supprimer la base
  locale ni `systemctl disable` les services tant que toutes les surfaces cloud
  ne sont pas vérifiées live. Étape finale manuelle pour l'humain.
