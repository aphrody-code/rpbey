import { db, schema } from "@rpbey/db";
import { eq } from "drizzle-orm";
import { auth } from "../src/lib/auth";

async function main() {
  console.log("Forging admin session...");
  let adminUser = await db.query.users.findFirst({
    where: eq(schema.users.email, "agent-service@rpbey.fr"),
    columns: { id: true },
  });
  if (!adminUser) {
    adminUser = await db.query.users.findFirst({
      where: eq(schema.users.role, "admin"),
      columns: { id: true },
    });
  }
  if (!adminUser) {
    console.error("Admin user not found in DB!");
    process.exit(1);
  }

  const authCtx = await auth.$context;
  const s = await authCtx.internalAdapter.createSession(adminUser.id, undefined as never);
  const token = (s as { token?: string }).token;
  if (!token) {
    console.error("Failed to forge session token!");
    process.exit(1);
  }
  console.log("Session token forged:", token);

  const url = "https://rpbey.fr/api/admin/export/tournament/bts4";
  console.log(`Fetching ${url}...`);

  const headers = {
    Authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };

  const res = await fetch(url, { headers });
  console.log("Response Status:", res.status);
  console.log("Response Headers:", Object.fromEntries(res.headers.entries()));

  const text = await res.text();
  console.log("Response Body:", text);

  // Cleanup session
  await authCtx.internalAdapter.deleteSession(token);
  console.log("Session cleaned up.");
  process.exit(0);
}

main().catch(console.error);
