import { schema } from "../src/app/api/graphql/schema";
import { printSchema } from "graphql";
import * as fs from "fs";
import * as path from "path";

try {
  const sdl = printSchema(schema);
  fs.writeFileSync(path.join(__dirname, "../schema.graphql"), sdl);
  console.log("GraphQL Schema dumped to apps/web/schema.graphql");
} catch (err) {
  console.error("Failed to dump GraphQL schema:", err);
  process.exit(1);
}
