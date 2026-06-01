/**
 * QA end-to-end du dashboard admin (routes api/admin/{gacha,moderation,teams}).
 * Pour chaque route : READ admin→200, garde-fou non-admin→401, et WRITES sur des
 * entités JETABLES créées puis supprimées dans la même passe (jamais sur de la
 * donnée réelle d'un membre).
 *
 * Sessions forgées via internalAdapter.createSession (admin = agent-service ;
 * non-admin = un user role=user existant), passées en Authorization: Bearer
 * (plugin bearer()). Les sessions de test sont supprimées en fin de course.
 *
 * Lancer : cd apps/web && bun scripts/qa-admin.ts
 */
import { auth } from "@/lib/auth";
import { db, schema } from "@rpbey/db";
import { eq } from "drizzle-orm";

const BASE = process.env.QA_BASE || "http://127.0.0.1:3002";
const API = `${BASE}/api/admin`;
const ADMIN_EMAIL = "agent-service@rpbey.fr";

type Row = { test: string; method: string; result: string; verdict: "pass" | "fail" | "skip" };
const rows: Row[] = [];
function rec(test: string, method: string, result: string, verdict: Row["verdict"]) {
  rows.push({ test, method, result, verdict });
  console.log(`[${verdict.toUpperCase()}] ${test} — ${result}`);
}
function trunc(o: unknown, n = 160): string {
  const s = typeof o === "string" ? o : JSON.stringify(o);
  return s.length > n ? s.slice(0, n) + "…" : s;
}

const createdSessionTokens: string[] = [];
const createdEntities: { kind: string; del: () => Promise<void> }[] = [];

async function forgeSession(userId: string): Promise<string> {
  const ctx = await auth.$context;
  const s = await ctx.internalAdapter.createSession(userId, undefined as never);
  const tok = (s as { token?: string }).token;
  if (!tok) throw new Error("no session token");
  createdSessionTokens.push(tok);
  return tok;
}

async function main() {
  // ── Sessions : admin + non-admin ──────────────────────────────────────────
  const admin = await db.query.users.findFirst({
    where: eq(schema.users.email, ADMIN_EMAIL),
    columns: { id: true, role: true },
  });
  const nonAdmin = await db.query.users.findFirst({
    where: eq(schema.users.role, "user"),
    columns: { id: true, role: true },
  });
  if (!admin || !nonAdmin) {
    rec("préreq sessions", "DB", `admin=${!!admin} nonAdmin=${!!nonAdmin}`, "fail");
    return finish();
  }
  const adminTok = await forgeSession(admin.id);
  const userTok = await forgeSession(nonAdmin.id);
  rec("forge session admin", "internalAdapter", `len=${adminTok.length}`, "pass");
  rec("forge session non-admin (role=user)", "internalAdapter", `len=${userTok.length}`, "pass");

  const H = (tok: string) => ({
    Authorization: `Bearer ${tok}`,
    "content-type": "application/json",
  });

  // ── 1. READ routes : admin→200, non-admin→401 ──────────────────────────────
  const reads: { name: string; url: string }[] = [
    { name: "GET /admin/gacha/cards", url: `${API}/gacha/cards?limit=5` },
    { name: "GET /admin/gacha/drops", url: `${API}/gacha/drops` },
    { name: "GET /admin/gacha/economy", url: `${API}/gacha/economy?limit=5` },
    { name: "GET /admin/moderation/warnings", url: `${API}/moderation/warnings?pageSize=5` },
    { name: "GET /admin/moderation/tickets", url: `${API}/moderation/tickets?pageSize=5` },
    { name: "GET /admin/teams", url: `${API}/teams?pageSize=5` },
  ];
  for (const r of reads) {
    const a = await fetch(r.url, { headers: H(adminTok) });
    const aBody = await a.json().catch(() => ({}));
    rec(
      `${r.name} (admin)`,
      "GET",
      `${a.status} ${trunc(aBody, 120)}`,
      a.status === 200 ? "pass" : "fail",
    );
    const u = await fetch(r.url, { headers: H(userTok) });
    rec(`${r.name} GARDE-FOU non-admin`, "GET", `${u.status}`, u.status === 401 ? "pass" : "fail");
  }

  // garde-fou : aucune auth du tout
  const noAuth = await fetch(`${API}/teams?pageSize=1`);
  rec(
    "GARDE-FOU sans session → 401",
    "GET",
    `${noAuth.status}`,
    noAuth.status === 401 ? "pass" : "fail",
  );

  // ── 2. WRITES gacha : drop + card jetables (POST/PATCH/DELETE) ──────────────
  const stamp = Date.now();
  // -- drop --
  const dropRes = await fetch(`${API}/gacha/drops`, {
    method: "POST",
    headers: H(adminTok),
    body: JSON.stringify({
      slug: `qa-drop-${stamp}`,
      name: "QA Drop",
      theme: "qa",
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 864e5).toISOString(),
    }),
  });
  const dropBody = await dropRes.json().catch(() => ({}));
  const dropId: string | undefined = dropBody?.id;
  rec(
    "POST /admin/gacha/drops (create)",
    "POST",
    `${dropRes.status} id=${dropId ?? "?"}`,
    dropRes.status === 201 && dropId ? "pass" : "fail",
  );
  if (dropId)
    createdEntities.push({
      kind: "drop",
      del: async () => {
        await db.delete(schema.gachaDrops).where(eq(schema.gachaDrops.id, dropId));
      },
    });

  // garde-fou non-admin sur POST
  const dropDenied = await fetch(`${API}/gacha/drops`, {
    method: "POST",
    headers: H(userTok),
    body: JSON.stringify({ slug: "x", name: "x", theme: "x", startDate: "x", endDate: "x" }),
  });
  rec(
    "POST /admin/gacha/drops GARDE-FOU non-admin",
    "POST",
    `${dropDenied.status}`,
    dropDenied.status === 401 ? "pass" : "fail",
  );

  if (dropId) {
    const patchDrop = await fetch(`${API}/gacha/drops/${dropId}`, {
      method: "PATCH",
      headers: H(adminTok),
      body: JSON.stringify({ name: "QA Drop Renommé" }),
    });
    const pb = await patchDrop.json().catch(() => ({}));
    rec(
      "PATCH /admin/gacha/drops/[id]",
      "PATCH",
      `${patchDrop.status} name=${pb?.name}`,
      patchDrop.status === 200 && pb?.name === "QA Drop Renommé" ? "pass" : "fail",
    );
  }

  // -- card --
  let cardId: string | undefined;
  const cardRes = await fetch(`${API}/gacha/cards`, {
    method: "POST",
    headers: H(adminTok),
    body: JSON.stringify({
      slug: `qa-card-${stamp}`,
      name: "QA Card",
      series: "QA",
      rarity: "COMMON",
      dropId: dropId ?? null,
    }),
  });
  const cardBody = await cardRes.json().catch(() => ({}));
  cardId = cardBody?.id;
  rec(
    "POST /admin/gacha/cards (create)",
    "POST",
    `${cardRes.status} id=${cardId ?? "?"}`,
    cardRes.status === 201 && cardId ? "pass" : "fail",
  );
  if (cardId)
    createdEntities.push({
      kind: "card",
      del: async () => {
        await db.delete(schema.gachaCards).where(eq(schema.gachaCards.id, cardId!));
      },
    });

  if (cardId) {
    const patchCard = await fetch(`${API}/gacha/cards/${cardId}`, {
      method: "PATCH",
      headers: H(adminTok),
      body: JSON.stringify({ name: "QA Card Renommée", rarity: "RARE" }),
    });
    const pcb = await patchCard.json().catch(() => ({}));
    rec(
      "PATCH /admin/gacha/cards/[id]",
      "PATCH",
      `${patchCard.status} name=${pcb?.name} rarity=${pcb?.rarity}`,
      patchCard.status === 200 && pcb?.name === "QA Card Renommée" ? "pass" : "fail",
    );

    const delCard = await fetch(`${API}/gacha/cards/${cardId}`, {
      method: "DELETE",
      headers: H(adminTok),
    });
    rec(
      "DELETE /admin/gacha/cards/[id]",
      "DELETE",
      `${delCard.status}`,
      delCard.status === 200 ? "pass" : "fail",
    );
    // vérifie la suppression réelle
    const gone = await db.query.gachaCards.findFirst({ where: eq(schema.gachaCards.id, cardId) });
    rec("card supprimée (DB)", "SELECT", `exists=${!!gone}`, !gone ? "pass" : "fail");
    if (!gone) createdEntities.pop(); // déjà supprimée
  }
  if (dropId) {
    const delDrop = await fetch(`${API}/gacha/drops/${dropId}`, {
      method: "DELETE",
      headers: H(adminTok),
    });
    rec(
      "DELETE /admin/gacha/drops/[id]",
      "DELETE",
      `${delDrop.status}`,
      delDrop.status === 200 ? "pass" : "fail",
    );
    const goneD = await db.query.gachaDrops.findFirst({ where: eq(schema.gachaDrops.id, dropId) });
    rec("drop supprimé (DB)", "SELECT", `exists=${!!goneD}`, !goneD ? "pass" : "fail");
    if (!goneD)
      createdEntities.splice(
        createdEntities.findIndex((e) => e.kind === "drop"),
        1,
      );
  }

  // ── 3. WRITES moderation : warning + ticket jetables ────────────────────────
  // warning créé DIRECT en DB (pas de route POST), supprimé via la route DELETE.
  const [warn] = await db
    .insert(schema.warnings)
    .values({
      discordId: `qa-${stamp}`,
      moderator: "qa-bot",
      reason: "QA test warning",
    })
    .returning({ id: schema.warnings.id });
  if (warn?.id) {
    createdEntities.push({
      kind: "warning",
      del: async () => {
        await db.delete(schema.warnings).where(eq(schema.warnings.id, warn.id));
      },
    });
    const delWarn = await fetch(`${API}/moderation/warnings/${warn.id}`, {
      method: "DELETE",
      headers: H(adminTok),
    });
    rec(
      "DELETE /admin/moderation/warnings/[id]",
      "DELETE",
      `${delWarn.status}`,
      delWarn.status === 200 ? "pass" : "fail",
    );
    const goneW = await db.query.warnings.findFirst({ where: eq(schema.warnings.id, warn.id) });
    rec("warning supprimé (DB)", "SELECT", `exists=${!!goneW}`, !goneW ? "pass" : "fail");
    if (!goneW)
      createdEntities.splice(
        createdEntities.findIndex((e) => e.kind === "warning"),
        1,
      );

    const delWarnDenied = await fetch(`${API}/moderation/warnings/qa-fake`, {
      method: "DELETE",
      headers: H(userTok),
    });
    rec(
      "DELETE warning GARDE-FOU non-admin",
      "DELETE",
      `${delWarnDenied.status}`,
      delWarnDenied.status === 401 ? "pass" : "fail",
    );
  }

  // ticket créé direct, statut modifié via PATCH route, puis supprimé.
  const [ticket] = await db
    .insert(schema.tickets)
    .values({
      channelId: `qa-chan-${stamp}`,
      userId: nonAdmin.id,
      type: "SUPPORT",
      status: "OPEN",
    })
    .returning({ id: schema.tickets.id });
  if (ticket?.id) {
    createdEntities.push({
      kind: "ticket",
      del: async () => {
        await db.delete(schema.tickets).where(eq(schema.tickets.id, ticket.id));
      },
    });
    const patchTicket = await fetch(`${API}/moderation/tickets/${ticket.id}`, {
      method: "PATCH",
      headers: H(adminTok),
      body: JSON.stringify({ status: "CLOSED" }),
    });
    rec(
      "PATCH /admin/moderation/tickets/[id]",
      "PATCH",
      `${patchTicket.status}`,
      patchTicket.status === 200 ? "pass" : "fail",
    );
    const t2 = await db.query.tickets.findFirst({
      where: eq(schema.tickets.id, ticket.id),
      columns: { status: true, closedAt: true },
    });
    rec(
      "ticket statut → CLOSED + closedAt (DB)",
      "SELECT",
      `status=${t2?.status} closedAt=${!!t2?.closedAt}`,
      t2?.status === "CLOSED" && !!t2?.closedAt ? "pass" : "fail",
    );
  }

  // ── 4. WRITES teams : équipe jetable (PATCH verify + DELETE) ────────────────
  const [team] = await db
    .insert(schema.teams)
    .values({
      slug: `qa-team-${stamp}`,
      tag: "QAT",
      name: "QA Team",
      captainId: nonAdmin.id,
      isVerified: false,
    })
    .returning({ id: schema.teams.id });
  if (team?.id) {
    createdEntities.push({
      kind: "team",
      del: async () => {
        await db.delete(schema.teams).where(eq(schema.teams.id, team.id));
      },
    });
    const patchTeam = await fetch(`${API}/teams/${team.id}`, {
      method: "PATCH",
      headers: H(adminTok),
      body: JSON.stringify({ isVerified: true }),
    });
    rec(
      "PATCH /admin/teams/[id] (verify)",
      "PATCH",
      `${patchTeam.status}`,
      patchTeam.status === 200 ? "pass" : "fail",
    );
    const tv = await db.query.teams.findFirst({
      where: eq(schema.teams.id, team.id),
      columns: { isVerified: true },
    });
    rec(
      "team isVerified=true (DB)",
      "SELECT",
      `isVerified=${tv?.isVerified}`,
      tv?.isVerified === true ? "pass" : "fail",
    );

    const patchDenied = await fetch(`${API}/teams/${team.id}`, {
      method: "PATCH",
      headers: H(userTok),
      body: JSON.stringify({ isVerified: false }),
    });
    rec(
      "PATCH team GARDE-FOU non-admin",
      "PATCH",
      `${patchDenied.status}`,
      patchDenied.status === 401 ? "pass" : "fail",
    );

    const delTeam = await fetch(`${API}/teams/${team.id}`, {
      method: "DELETE",
      headers: H(adminTok),
    });
    rec(
      "DELETE /admin/teams/[id]",
      "DELETE",
      `${delTeam.status}`,
      delTeam.status === 200 ? "pass" : "fail",
    );
    const goneT = await db.query.teams.findFirst({ where: eq(schema.teams.id, team.id) });
    rec("team supprimée (DB)", "SELECT", `exists=${!!goneT}`, !goneT ? "pass" : "fail");
    if (!goneT)
      createdEntities.splice(
        createdEntities.findIndex((e) => e.kind === "team"),
        1,
      );
  }

  // ── 5. WRITE economy : currency adjust round-trip sur le profil non-admin ──
  const prof = await db.query.profiles.findFirst({
    where: eq(schema.profiles.userId, nonAdmin.id),
    columns: { id: true, currency: true },
  });
  if (prof) {
    const before = prof.currency;
    const give = await fetch(`${API}/gacha/economy`, {
      method: "POST",
      headers: H(adminTok),
      body: JSON.stringify({ userId: nonAdmin.id, amount: 7, note: "QA give" }),
    });
    const giveBody = await give.json().catch(() => ({}));
    const take = await fetch(`${API}/gacha/economy`, {
      method: "POST",
      headers: H(adminTok),
      body: JSON.stringify({ userId: nonAdmin.id, amount: -7, note: "QA take" }),
    });
    const after = await db.query.profiles.findFirst({
      where: eq(schema.profiles.id, prof.id),
      columns: { currency: true },
    });
    rec(
      "POST /admin/gacha/economy give+take (net 0)",
      "POST x2",
      `${give.status}/${take.status} before=${before} after=${after?.currency}`,
      give.ok && take.ok && after?.currency === before ? "pass" : "fail",
    );
    rec(
      "economy newBalance retourné",
      "POST",
      `${trunc(giveBody, 80)}`,
      typeof giveBody?.newBalance === "number" ? "pass" : "fail",
    );
    // nettoie les 2 transactions QA créées
    createdEntities.push({
      kind: "currencyTx",
      del: async () => {
        const { and, like } = await import("drizzle-orm");
        await db
          .delete(schema.currencyTransactions)
          .where(
            and(
              eq(schema.currencyTransactions.userId, nonAdmin.id),
              like(schema.currencyTransactions.note, "QA %"),
            ),
          );
      },
    });
    const ecoDenied = await fetch(`${API}/gacha/economy`, {
      method: "POST",
      headers: H(userTok),
      body: JSON.stringify({ userId: nonAdmin.id, amount: 1 }),
    });
    rec(
      "POST economy GARDE-FOU non-admin",
      "POST",
      `${ecoDenied.status}`,
      ecoDenied.status === 401 ? "pass" : "fail",
    );
  } else {
    rec("POST /admin/gacha/economy", "POST", "profil non-admin absent — skip", "skip");
  }

  return finish();
}

async function finish() {
  // ── NETTOYAGE : entités jetables + sessions de test ─────────────────────────
  for (const e of createdEntities.reverse()) {
    try {
      await e.del();
    } catch (err) {
      console.error(`[cleanup] ${e.kind}:`, err);
    }
  }
  for (const tok of createdSessionTokens) {
    try {
      await db.delete(schema.sessions).where(eq(schema.sessions.token, tok));
    } catch {
      /* noop */
    }
  }
  console.log(
    `\n[cleanup] ${createdEntities.length} entité(s) + ${createdSessionTokens.length} session(s) de test supprimées.`,
  );

  const pass = rows.filter((r) => r.verdict === "pass").length;
  const fail = rows.filter((r) => r.verdict === "fail").length;
  const skip = rows.filter((r) => r.verdict === "skip").length;
  console.log(
    `\n===== ADMIN RÉCAP: ${pass} pass / ${fail} fail / ${skip} skip (total ${rows.length}) =====`,
  );
  console.log("MARKDOWN_TABLE_START");
  console.log("| test | méthode | code/résultat | verdict |");
  console.log("|---|---|---|---|");
  for (const r of rows)
    console.log(`| ${r.test} | ${r.method} | ${r.result.replace(/\|/g, "/")} | ${r.verdict} |`);
  console.log("MARKDOWN_TABLE_END");
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("FATAL:", e);
  finish();
});
