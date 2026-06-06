import { db, schema } from "@rpbey/db";
import { eq } from "drizzle-orm";

async function main() {
  console.log("Updating category color in DB...");
  const res = await db
    .update(schema.tournamentCategories)
    .set({ color: "#dc2626" })
    .where(eq(schema.tournamentCategories.id, "ogeeqzwe9az29i1uvj0vdtst"));
  console.log("Updated successfully:", res);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
