/**
 * QA end-to-end du protocole Agent Auth (@better-auth/agent-auth) contre le
 * service live (127.0.0.1:3002 par défaut). Exerce le maillon JAMAIS testé :
 *   host/create (session) → register agent (host+jwt) → grant-capability (session)
 *   → sign agent+jwt → capability/execute (proxy onExecute → routes upstream).
 *
 * Clés Ed25519 générées à la volée (jose). Session admin forgée via
 * internalAdapter.createSession (même mécanisme que resolveHeaders), passée en
 * Authorization: Bearer (lue par le plugin bearer()).
 *
 * NETTOYAGE : l'agent + le host créés sont révoqués/supprimés en fin de course.
 * Lancer : cd apps/web && bun scripts/qa-agent-auth.ts
 */
import { auth } from "@/lib/auth";
import { db, schema } from "@rpbey/db";
import { eq } from "drizzle-orm";
import { exportJWK, generateKeyPair, calculateJwkThumbprint, SignJWT, type JWK } from "jose";

const BASE = process.env.QA_BASE || "http://127.0.0.1:3002";
const AUTH = `${BASE}/api/auth`;
const EXECUTE_URL = `${AUTH}/capability/execute`;
const SERVICE_EMAIL = "agent-service@rpbey.fr";

type Row = { test: string; method: string; result: string; verdict: "pass" | "fail" | "skip" };
const rows: Row[] = [];
function rec(test: string, method: string, result: string, verdict: Row["verdict"]) {
  rows.push({ test, method, result, verdict });
  console.log(`[${verdict.toUpperCase()}] ${test} — ${result}`);
}

function trunc(o: unknown, n = 220): string {
  const s = typeof o === "string" ? o : JSON.stringify(o);
  return s.length > n ? s.slice(0, n) + "…" : s;
}

async function main() {
  // ── Forge une session admin (service agent) ──────────────────────────────
  const admin = await db.query.users.findFirst({
    where: eq(schema.users.email, SERVICE_EMAIL),
    columns: { id: true, role: true },
  });
  if (!admin) {
    rec("forge admin session", "DB", `user ${SERVICE_EMAIL} absent`, "fail");
    return finish();
  }
  // internalAdapter via auth context.
  const ctx = await auth.$context;
  const session = await ctx.internalAdapter.createSession(admin.id, undefined as never);
  const sessionToken = (session as { token?: string })?.token;
  if (!sessionToken) {
    rec("forge admin session", "internalAdapter.createSession", "pas de token", "fail");
    return finish();
  }
  rec(
    "forge admin session",
    "internalAdapter.createSession",
    `token len=${sessionToken.length}`,
    "pass",
  );
  const sessHeaders = {
    Authorization: `Bearer ${sessionToken}`,
    "content-type": "application/json",
  };

  // ── 0. Discovery + capability/list (publics) ─────────────────────────────
  const disco = await fetch(`${BASE}/.well-known/agent-configuration`);
  rec(
    "discovery /.well-known/agent-configuration",
    "GET",
    `${disco.status}`,
    disco.ok ? "pass" : "fail",
  );
  const capList = await fetch(`${AUTH}/capability/list`).then((r) => r.json());
  const capNames: string[] = (capList.capabilities ?? []).map((c: { name: string }) => c.name);
  rec(
    "capability/list",
    "GET",
    `${capNames.length} capabilities`,
    capNames.length === 36 ? "pass" : "fail",
  );

  // ── 1. Génère clés host + agent ──────────────────────────────────────────
  const hostKP = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
  const agentKP = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
  const hostPubJwk = (await exportJWK(hostKP.publicKey)) as JWK;
  const agentPubJwk = (await exportJWK(agentKP.publicKey)) as JWK;
  hostPubJwk.crv = "Ed25519";
  agentPubJwk.crv = "Ed25519";
  const hostKid = await calculateJwkThumbprint(hostPubJwk);
  hostPubJwk.kid = hostKid;

  // ── 2. host/create (session) ─────────────────────────────────────────────
  const createRes = await fetch(`${AUTH}/host/create`, {
    method: "POST",
    headers: sessHeaders,
    body: JSON.stringify({
      name: "qa-agent-auth-host",
      public_key: hostPubJwk,
      // Défauts SCOPÉS (pas toutes les caps) pour pouvoir tester le garde-fou
      // « capability non accordée » : botLogs n'est volontairement PAS ici.
      default_capabilities: [
        "getRankings",
        "globalSearch",
        "getMeta",
        "listParts",
        "getPublicUser",
      ],
    }),
  });
  const createBody = await createRes.json().catch(() => ({}));
  const hostId: string | undefined =
    createBody.hostId ?? createBody.id ?? createBody.host?.id ?? createBody.host_id;
  rec(
    "host/create",
    "POST (session)",
    `${createRes.status} hostId=${hostId ?? "?"} ${trunc(createBody, 120)}`,
    createRes.ok && hostId ? "pass" : "fail",
  );
  if (!hostId) return finish(hostId, undefined, sessionToken, session);

  // ── 3. Sign host+jwt (carrying agent_public_key) → register agent ────────
  const hostJwt = await new SignJWT({
    aud: BASE,
    agent_public_key: agentPubJwk,
    host_public_key: hostPubJwk,
  })
    .setProtectedHeader({ alg: "EdDSA", typ: "host+jwt", kid: hostKid })
    .setIssuer(hostId)
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(hostKP.privateKey);

  const regRes = await fetch(`${AUTH}/agent/register`, {
    method: "POST",
    headers: { Authorization: `Bearer ${hostJwt}`, "content-type": "application/json" },
    body: JSON.stringify({
      name: "qa-agent-auth-agent",
      mode: "delegated",
      reason: "QA end-to-end test",
      capabilities: ["getRankings", "globalSearch", "getMeta", "listParts", "getPublicUser"],
    }),
  });
  const regBody = await regRes.json().catch(() => ({}));
  const agentId: string | undefined =
    regBody.agent_id ?? regBody.agent?.id ?? regBody.id ?? regBody.sub;
  rec(
    "agent/register",
    "POST (host+jwt)",
    `${regRes.status} agentId=${agentId ?? "?"} status=${regBody.status ?? regBody.agent?.status ?? "?"} ${trunc(regBody, 160)}`,
    regRes.ok && agentId ? "pass" : "fail",
  );
  if (!agentId) return finish(hostId, agentId, sessionToken, session);

  // ── 4. grant-capability (session) — accorde explicitement les caps ───────
  const grantTargets = [
    "getRankings",
    "globalSearch",
    "getMeta",
    "listParts",
    "getPublicUser",
    "trackAnalyticsEvent",
  ];
  const grantRes = await fetch(`${AUTH}/agent/grant-capability`, {
    method: "POST",
    headers: sessHeaders,
    body: JSON.stringify({ agent_id: agentId, capabilities: grantTargets }),
  });
  const grantBody = await grantRes.json().catch(() => ({}));
  rec(
    "agent/grant-capability",
    "POST (session)",
    `${grantRes.status} ${trunc(grantBody, 200)}`,
    grantRes.ok ? "pass" : "fail",
  );

  // verify grants in DB
  const grantsDb = await db.query.agentCapabilityGrants.findMany({
    where: eq(schema.agentCapabilityGrants.agentId, agentId),
    columns: { capability: true, status: true },
  });
  rec(
    "grants persisted (DB)",
    "SELECT",
    `${grantsDb.length} grants: ${grantsDb.map((g) => g.capability).join(",")}`,
    grantsDb.length > 0 ? "pass" : "fail",
  );

  // ── 5. agent/status (agent+jwt or host+jwt) ──────────────────────────────
  const statusJwt = await signAgentJwt(agentKP.privateKey, agentId, hostId, BASE, ["getRankings"]);
  const statusRes = await fetch(`${AUTH}/agent/status`, {
    headers: { Authorization: `Bearer ${statusJwt}` },
  });
  const statusBody = await statusRes.json().catch(() => ({}));
  rec(
    "agent/status",
    "GET (agent+jwt)",
    `${statusRes.status} ${trunc(statusBody, 160)}`,
    statusRes.ok ? "pass" : "fail",
  );

  // ── 6. EXÉCUTION des capabilities (le cœur du test) ──────────────────────
  const execTargets: { cap: string; args?: Record<string, unknown> }[] = [
    { cap: "getRankings", args: {} },
    { cap: "globalSearch", args: { q: "dran", limit: 3 } },
    { cap: "getMeta", args: {} },
    { cap: "listParts", args: {} },
    { cap: "getPublicUser", args: { id: admin.id } },
    { cap: "trackAnalyticsEvent", args: { name: "qa_agent_auth_test", path: "/qa" } },
  ];
  for (const t of execTargets) {
    // chaque execute = jti unique → pas de replay
    const jwt = await signAgentJwt(agentKP.privateKey, agentId, hostId, EXECUTE_URL, [t.cap]);
    let res: Response,
      body: unknown,
      ok = false;
    try {
      res = await fetch(EXECUTE_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${jwt}`, "content-type": "application/json" },
        body: JSON.stringify({ capability: t.cap, arguments: t.args }),
      });
      body = await res.json().catch(() => res.text());
      // success = 200 et pas un wrapper d'erreur upstream
      ok =
        res.ok &&
        !(
          typeof body === "object" &&
          body !== null &&
          "error" in (body as object) &&
          Object.keys(body as object).length === 1
        );
      rec(
        `execute ${t.cap}`,
        "POST capability/execute",
        `${res.status} ${trunc(body, 200)}`,
        ok ? "pass" : "fail",
      );
    } catch (e) {
      rec(`execute ${t.cap}`, "POST capability/execute", `EXCEPTION ${String(e)}`, "fail");
    }
  }

  // ── 7. Garde-fou : capability non accordée → refus ───────────────────────
  const ungrantedJwt = await signAgentJwt(agentKP.privateKey, agentId, hostId, EXECUTE_URL, [
    "botLogs",
  ]);
  const ungrantedRes = await fetch(EXECUTE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${ungrantedJwt}`, "content-type": "application/json" },
    body: JSON.stringify({ capability: "botLogs", arguments: {} }),
  });
  const ungrantedBody = await ungrantedRes.json().catch(() => ({}));
  const denied =
    ungrantedRes.status === 403 ||
    ungrantedRes.status === 401 ||
    (typeof ungrantedBody === "object" &&
      ungrantedBody !== null &&
      "code" in ungrantedBody &&
      String((ungrantedBody as { code: string }).code).includes("not_granted"));
  rec(
    "garde-fou: capability non accordée refusée",
    "POST capability/execute",
    `${ungrantedRes.status} ${trunc(ungrantedBody, 120)}`,
    denied ? "pass" : "fail",
  );

  // ── 8. Garde-fou : JWT replay (réutiliser le même jti) ───────────────────
  const replayJwt = await signAgentJwt(agentKP.privateKey, agentId, hostId, EXECUTE_URL, [
    "getMeta",
  ]);
  const r1 = await fetch(EXECUTE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${replayJwt}`, "content-type": "application/json" },
    body: JSON.stringify({ capability: "getMeta", arguments: {} }),
  });
  const r2 = await fetch(EXECUTE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${replayJwt}`, "content-type": "application/json" },
    body: JSON.stringify({ capability: "getMeta", arguments: {} }),
  });
  rec(
    "garde-fou: JWT replay (même jti) rejeté",
    "POST x2",
    `1er=${r1.status} 2e=${r2.status}`,
    r1.ok && r2.status >= 400 ? "pass" : "fail",
  );

  return finish(hostId, agentId, sessionToken, session);
}

async function signAgentJwt(
  priv: CryptoKey,
  agentId: string,
  hostId: string,
  aud: string,
  capabilities: string[],
): Promise<string> {
  return new SignJWT({ aud, capabilities })
    .setProtectedHeader({ alg: "EdDSA", typ: "agent+jwt" })
    .setSubject(agentId)
    .setIssuer(hostId)
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(priv);
}

async function finish(hostId?: string, agentId?: string, sessionToken?: string, session?: unknown) {
  // ── NETTOYAGE : supprime agent + host + grants + la session forgée ───────
  try {
    void agentId;
    void hostId;
    // Sweep par NOM : supprime tout l'arbre des entités de test (robuste même si
    // une run précédente a planté avant register, laissant un host orphelin).
    const qaHosts = await db.query.agentHosts.findMany({
      where: eq(schema.agentHosts.name, "qa-agent-auth-host"),
      columns: { id: true },
    });
    for (const h of qaHosts) {
      const ags = await db.query.agents.findMany({
        where: eq(schema.agents.hostId, h.id),
        columns: { id: true },
      });
      for (const a of ags) {
        await db
          .delete(schema.agentCapabilityGrants)
          .where(eq(schema.agentCapabilityGrants.agentId, a.id));
      }
      await db.delete(schema.agents).where(eq(schema.agents.hostId, h.id));
      await db.delete(schema.agentHosts).where(eq(schema.agentHosts.id, h.id));
    }
    const tok = (session as { token?: string })?.token ?? sessionToken;
    if (tok) {
      await db.delete(schema.sessions).where(eq(schema.sessions.token, tok));
    }
    console.log("\n[cleanup] agent/host/grants/session de test supprimés.");
  } catch (e) {
    console.error("[cleanup] erreur:", e);
  }

  // ── RÉCAP ─────────────────────────────────────────────────────────────────
  const pass = rows.filter((r) => r.verdict === "pass").length;
  const fail = rows.filter((r) => r.verdict === "fail").length;
  const skip = rows.filter((r) => r.verdict === "skip").length;
  console.log(
    `\n===== AGENT-AUTH RÉCAP: ${pass} pass / ${fail} fail / ${skip} skip (total ${rows.length}) =====`,
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
  process.exit(1);
});
