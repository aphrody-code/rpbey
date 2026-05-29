import "server-only";
import { count, countDistinct, db, eq, max, schema, sql } from "@/lib/db";
import type { ModerationSummary, WarningCountResponse } from "@rpbey/api-contract";

/**
 * Data Access Layer — modération (warnings / tickets / reminders).
 * SEUL endroit autorisé à importer `@rpbey/db` pour ce domaine. UI-agnostic.
 *
 * Toutes les tables sont en `mode:"string"` (aucune table auth) : les colonnes
 * `createdAt`/`expiresAt`/`closedAt` reviennent déjà en string ISO, donc aucune
 * conversion `Date` n'est requise — on les renvoie telles quelles.
 *
 * Surface PUBLIQUE uniquement : agrégats anonymisés et compteur par `discordId`.
 * Aucune PII (raison, modérateur, contenu de ticket) n'est lue ici.
 */

/** Cliché agrégé anonymisé de l'activité de modération. */
export async function getModerationSummary(): Promise<ModerationSummary> {
  const [warnAgg, ticketTotalRows, ticketStatusRows, ticketTypeRows, ticketLastRows, reminderRows] =
    await Promise.all([
      db
        .select({
          total: count(),
          uniqueMembers: countDistinct(schema.warnings.discordId),
          last: max(schema.warnings.createdAt),
        })
        .from(schema.warnings),
      db.select({ total: count() }).from(schema.tickets),
      db
        .select({ status: schema.tickets.status, value: count() })
        .from(schema.tickets)
        .groupBy(schema.tickets.status),
      db
        .select({ type: schema.tickets.type, value: count() })
        .from(schema.tickets)
        .groupBy(schema.tickets.type),
      db.select({ last: max(schema.tickets.createdAt) }).from(schema.tickets),
      db
        .select({
          total: count(),
          fired: sql<number>`count(*) filter (where ${schema.reminders.fired} = true)`.mapWith(
            Number,
          ),
        })
        .from(schema.reminders),
    ]);

  const byStatus = ticketStatusRows.map((r) => ({
    status: r.status,
    count: r.value,
  }));
  const byType = ticketTypeRows.map((r) => ({ type: r.type, count: r.value }));

  const ticketsTotal = ticketTotalRows[0]?.total ?? 0;
  // `closed` = tickets dont le statut est explicitement CLOSED (insensible à la casse).
  const closed = byStatus
    .filter((s) => s.status.toUpperCase() === "CLOSED")
    .reduce((acc, s) => acc + s.count, 0);
  const open = byStatus
    .filter((s) => s.status.toUpperCase() === "OPEN")
    .reduce((acc, s) => acc + s.count, 0);

  const remindersTotal = reminderRows[0]?.total ?? 0;
  const remindersFired = reminderRows[0]?.fired ?? 0;

  return {
    warnings: {
      total: warnAgg[0]?.total ?? 0,
      uniqueMembers: warnAgg[0]?.uniqueMembers ?? 0,
      lastWarningAt: warnAgg[0]?.last ?? null,
    },
    tickets: {
      total: ticketsTotal,
      open,
      closed,
      byStatus,
      byType,
      lastTicketAt: ticketLastRows[0]?.last ?? null,
    },
    reminders: {
      total: remindersTotal,
      pending: remindersTotal - remindersFired,
      fired: remindersFired,
    },
  };
}

/**
 * Compteur de warnings pour un membre Discord donné — sans PII.
 * Renvoie le total et la date du dernier warning (string ISO ou `null`).
 */
export async function getWarningCount(discordId: string): Promise<WarningCountResponse> {
  const [row] = await db
    .select({
      value: count(),
      last: max(schema.warnings.createdAt),
    })
    .from(schema.warnings)
    .where(eq(schema.warnings.discordId, discordId));

  return {
    discordId,
    count: row?.value ?? 0,
    lastWarningAt: row?.last ?? null,
  };
}
