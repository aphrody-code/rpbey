import { db, schema } from "@rpbey/db";

async function main() {
  console.log("Connecting to DB...");
  const adminUser = await db.query.users.findFirst({
    columns: { id: true, email: true, role: true },
  });
  console.log("Admin user:", adminUser);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
