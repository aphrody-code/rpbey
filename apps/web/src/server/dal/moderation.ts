import "server-only";
import { and, count, countDistinct, db, desc, eq, ilike, max, or, schema, sql } from "@/lib/db";

/**
 * Data Access Layer — modération (warnings / tickets / reminders).
 * SEUL endroit autorisé à importer `@rpbey/db` pour ce domaine. UI-agnostic.
 *
 * Toutes les tables sont en `mode:"string"` (aucune table auth) : les colonnes
 * `createdAt`/`expiresAt`/`closedAt` reviennent déjà en string ISO.
 */

export interface ModerationSummary {
  warnings: {
    total: number;
    uniqueMembers: number;
    lastWarningAt: string | null;
  };
  tickets: {
    total: number;
    open: number;
    closed: number;
    byStatus: { status: string; count: number }[];
    byType: { type: string; count: number }[];
    lastTicketAt: string | null;
  };
  reminders: {
    total: number;
    pending: number;
    fired: number;
  };
}

export interface WarningCountResponse {
  discordId: string;
  count: number;
  lastWarningAt: string | null;
}

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

// ─── Admin : liste complète des warnings ─────────────────────────────────────

export interface WarningRow {
  id: string;
  discordId: string;
  moderator: string;
  reason: string;
  createdAt: string;
}

/** Liste paginée des warnings admin. */
export async function listWarnings(opts: {
  page?: number;
  pageSize?: number;
  search?: string;
}): Promise<{ warnings: WarningRow[]; total: number }> {
  const { page = 1, pageSize = 25, search = "" } = opts;
  const offset = (page - 1) * pageSize;
  const where = search
    ? or(
        ilike(schema.warnings.discordId, `%${search}%`),
        ilike(schema.warnings.moderator, `%${search}%`),
        ilike(schema.warnings.reason, `%${search}%`),
      )
    : undefined;

  const [rows, totalRows] = await Promise.all([
    db.query.warnings.findMany({
      where,
      orderBy: desc(schema.warnings.createdAt),
      limit: pageSize,
      offset,
    }),
    db.select({ value: count() }).from(schema.warnings).where(where),
  ]);

  return {
    warnings: rows.map((w) => ({
      id: w.id,
      discordId: w.discordId,
      moderator: w.moderator,
      reason: w.reason,
      createdAt: w.createdAt,
    })),
    total: totalRows[0]?.value ?? 0,
  };
}

/** Supprime un warning par id. */
export async function deleteWarning(id: string): Promise<void> {
  await db.delete(schema.warnings).where(eq(schema.warnings.id, id));
}

// ─── Admin : tickets ─────────────────────────────────────────────────────────

export interface TicketRow {
  id: string;
  channelId: string;
  userId: string;
  type: string;
  status: string;
  createdAt: string;
  closedAt: string | null;
}

/** Liste paginée des tickets admin. */
export async function listTickets(opts: {
  page?: number;
  pageSize?: number;
  status?: string;
}): Promise<{ tickets: TicketRow[]; total: number }> {
  const { page = 1, pageSize = 25, status } = opts;
  const offset = (page - 1) * pageSize;
  const where = status ? eq(schema.tickets.status, status) : undefined;

  const [rows, totalRows] = await Promise.all([
    db.query.tickets.findMany({
      where,
      orderBy: desc(schema.tickets.createdAt),
      limit: pageSize,
      offset,
    }),
    db.select({ value: count() }).from(schema.tickets).where(where),
  ]);

  return {
    tickets: rows.map((t) => ({
      id: t.id,
      channelId: t.channelId,
      userId: t.userId,
      type: t.type,
      status: t.status,
      createdAt: t.createdAt,
      closedAt: t.closedAt ?? null,
    })),
    total: totalRows[0]?.value ?? 0,
  };
}

/** Met à jour le statut d'un ticket. */
export async function updateTicketStatus(id: string, status: string): Promise<void> {
  await db
    .update(schema.tickets)
    .set({
      status,
      ...(status.toUpperCase() === "CLOSED" && { closedAt: new Date().toISOString() }),
    })
    .where(eq(schema.tickets.id, id));
}

// ─── Admin : summary teams (pour la page modération) ─────────────────────────

export async function getModerationAdminStats() {
  const [warningsTotal, ticketsOpen, ticketsClosed, remindersTotal] = await Promise.all([
    db.select({ value: count() }).from(schema.warnings),
    db
      .select({ value: count() })
      .from(schema.tickets)
      .where(and(eq(schema.tickets.status, "OPEN"))),
    db.select({ value: count() }).from(schema.tickets).where(eq(schema.tickets.status, "CLOSED")),
    db.select({ value: count() }).from(schema.reminders),
  ]);
  return {
    warningsTotal: warningsTotal[0]?.value ?? 0,
    ticketsOpen: ticketsOpen[0]?.value ?? 0,
    ticketsClosed: ticketsClosed[0]?.value ?? 0,
    remindersTotal: remindersTotal[0]?.value ?? 0,
  };
}
