import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import * as relations from "./relations";

export const client = postgres({
  host: process.env.PGHOST ?? "/var/run/postgresql",
  database: process.env.PGDATABASE ?? "rpb_neon",
  username: process.env.PGUSER ?? "ubuntu",
  max: 10,
  prepare: true,
});

export const db = drizzle(client, { schema: { ...schema, ...relations } });
