import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    host: "/var/run/postgresql",
    database: "rpb_neon",
    user: "ubuntu",
  },
});
