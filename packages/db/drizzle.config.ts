import { defineConfig } from "drizzle-kit";

// Les migrations (drizzle-kit push/generate/migrate) utilisent une vraie session
// Postgres → endpoint *direct* Neon (`DIRECT_DATABASE_URL`), jamais le pooler.
// Fallback : `DATABASE_URL`, puis le socket local pour le dev VPS.
const url = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./drizzle",
  dbCredentials: url
    ? { url }
    : { host: "/var/run/postgresql", database: "rpb_neon", user: "ubuntu" },
});
