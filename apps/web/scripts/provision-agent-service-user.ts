/**
 * Provisionne le compte de service "agent" utilisé par `resolveAutonomousUser`
 * (cf. plugin agentAuth dans src/lib/auth.ts) : c'est l'identité sous laquelle
 * un agent IA AUTONOME exécute les capabilities. Rôle admin (pleins pouvoirs,
 * conformément à l'intégration complète demandée). Idempotent.
 *
 * Lancer : cd apps/web && bun scripts/provision-agent-service-user.ts
 */
import { createId } from "@paralleldrive/cuid2";
import { db, schema } from "@rpbey/db";
import { eq } from "drizzle-orm";

const EMAIL = process.env.AGENT_SERVICE_EMAIL || "agent-service@rpbey.fr";

async function main() {
  const existing = await db.query.users.findFirst({
    where: eq(schema.users.email, EMAIL),
    columns: { id: true, role: true },
  });

  if (existing) {
    if (existing.role !== "admin") {
      await db.update(schema.users).set({ role: "admin" }).where(eq(schema.users.id, existing.id));
      console.log(`Service user existant promu admin (${EMAIL}, id=${existing.id}).`);
    } else {
      console.log(`Service user déjà présent et admin (${EMAIL}, id=${existing.id}).`);
    }
    process.exit(0);
  }

  const now = new Date();
  const id = createId();
  await db.insert(schema.users).values({
    id,
    name: "Agent RPB",
    email: EMAIL,
    emailVerified: true,
    role: "admin",
    username: "agent-rpb",
    displayUsername: "Agent RPB",
    createdAt: now,
    updatedAt: now,
  } as typeof schema.users.$inferInsert);

  console.log(`Service user créé : ${EMAIL} (id=${id}, role=admin).`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Échec provisioning service user:", err);
  process.exit(1);
});
