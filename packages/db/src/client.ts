import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import * as relations from "./relations";

// Connexion DB — priorité à DATABASE_URL (Neon managé, endpoint *pooled*),
// fallback sur le socket Postgres local pour le dev VPS / l'ancien chemin.
//
// Neon pooled = PgBouncer en mode transaction : il ne supporte PAS les
// prepared statements nommés → `prepare: false` obligatoire sur cette voie.
// Le socket local garde `prepare: true` (vraies sessions Postgres).
//
// `DATABASE_URL` doit pointer sur l'endpoint *pooled* (`...-pooler...`) pour le
// runtime ; les migrations / restore utilisent l'endpoint *direct*
// (`DIRECT_DATABASE_URL`), jamais ce client.
const url = process.env.DATABASE_URL;

export const client = url
  ? postgres(url, { max: 10, prepare: false })
  : postgres({
      host: process.env.PGHOST ?? "/var/run/postgresql",
      database: process.env.PGDATABASE ?? "rpb_neon",
      username: process.env.PGUSER ?? "ubuntu",
      max: 10,
      prepare: true,
    });

export const db = drizzle(client, { schema: { ...schema, ...relations } });
