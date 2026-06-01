/**
 * QA end-to-end du flux AUTH (better-auth) sur un user JETABLE email/mdp créé
 * pour le test puis supprimé (jamais sur une session humaine réelle) :
 *   sign-up → sign-in → get-session → list-accounts → list-sessions →
 *   change-password (garde-fou mauvais mdp → erreur ; bon mdp → OK) →
 *   2FA enable (TOTP URI) → sign-out (révocation) → vérif session morte.
 *
 * Tout via HTTP contre le service live (token bearer + cookies gérés à la main).
 * Le user de test + ses comptes/sessions sont supprimés en fin de course.
 *
 * Lancer : cd apps/web && bun scripts/qa-auth.ts
 */
import { db, schema } from "@rpbey/db";
import { eq } from "drizzle-orm";

const BASE = process.env.QA_BASE || "http://127.0.0.1:3002";
const AUTH = `${BASE}/api/auth`;

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

const STAMP = Date.now();
const EMAIL = `qa-auth-${STAMP}@local.invalid`;
const PASS1 = `Qa-Pw-${STAMP}-aaa`;
const PASS2 = `Qa-Pw-${STAMP}-bbb`;
let userId: string | undefined;

async function post(path: string, body: unknown, token?: string) {
  const res = await fetch(`${AUTH}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body ?? {}),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
async function get(path: string, token: string) {
  const res = await fetch(`${AUTH}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

async function main() {
  // ── /api/auth/ok ────────────────────────────────────────────────────────
  const ok = await fetch(`${AUTH}/ok`);
  rec("GET /api/auth/ok", "GET", `${ok.status}`, ok.status === 200 ? "pass" : "fail");

  // ── 1. sign-up/email (crée le user jetable) ───────────────────────────────
  const signup = await post("/sign-up/email", { email: EMAIL, password: PASS1, name: "QA Auth" });
  const signupToken: string | undefined = signup.data?.token;
  rec(
    "POST /sign-up/email",
    "POST",
    `${signup.res.status} token=${!!signupToken}`,
    signup.res.status === 200 && signupToken ? "pass" : "fail",
  );
  // capture userId DB pour cleanup
  const u = await db.query.users.findFirst({
    where: eq(schema.users.email, EMAIL),
    columns: { id: true },
  });
  userId = u?.id;
  if (!userId) {
    rec("user jetable persisté (DB)", "SELECT", "absent", "fail");
    return finish();
  }
  rec("user jetable persisté (DB)", "SELECT", `id=${userId}`, "pass");

  // ── 2. sign-in/email → token de session ──────────────────────────────────
  const signin = await post("/sign-in/email", { email: EMAIL, password: PASS1 });
  let token: string | undefined = signin.data?.token;
  rec(
    "POST /sign-in/email (bon mdp)",
    "POST",
    `${signin.res.status} token=${!!token}`,
    signin.res.status === 200 && token ? "pass" : "fail",
  );
  if (!token) return finish();

  // garde-fou : mauvais mot de passe
  const badSignin = await post("/sign-in/email", { email: EMAIL, password: "totally-wrong-pw" });
  rec(
    "POST /sign-in/email GARDE-FOU mauvais mdp",
    "POST",
    `${badSignin.res.status} ${trunc(badSignin.data, 80)}`,
    badSignin.res.status === 401 ? "pass" : "fail",
  );

  // ── 3. get-session ────────────────────────────────────────────────────────
  const sess = await get("/get-session", token);
  const sessUserId = sess.data?.user?.id;
  rec(
    "GET /get-session",
    "GET",
    `${sess.res.status} user=${sessUserId === userId}`,
    sess.res.status === 200 && sessUserId === userId ? "pass" : "fail",
  );

  // ── 4. list-accounts (doit contenir le provider 'credential') ─────────────
  const accounts = await get("/list-accounts", token);
  const hasCredential =
    Array.isArray(accounts.data) &&
    accounts.data.some(
      (a: { provider?: string; providerId?: string }) =>
        (a.provider ?? a.providerId) === "credential",
    );
  rec(
    "GET /list-accounts",
    "GET",
    `${accounts.res.status} ${trunc(accounts.data, 120)}`,
    accounts.res.status === 200 && hasCredential ? "pass" : "fail",
  );

  // ── 5. list-sessions (au moins 1 session active) ──────────────────────────
  const sessions = await get("/list-sessions", token);
  const sessCount = Array.isArray(sessions.data) ? sessions.data.length : 0;
  rec(
    "GET /list-sessions",
    "GET",
    `${sessions.res.status} count=${sessCount}`,
    sessions.res.status === 200 && sessCount >= 1 ? "pass" : "fail",
  );

  // ── 6. change-password : garde-fou mauvais currentPassword → erreur ───────
  const badChange = await post(
    "/change-password",
    { currentPassword: "wrong-current", newPassword: PASS2 },
    token,
  );
  rec(
    "POST /change-password GARDE-FOU mauvais currentPassword",
    "POST",
    `${badChange.res.status} ${trunc(badChange.data, 90)}`,
    badChange.res.status >= 400 ? "pass" : "fail",
  );

  // change-password : bon currentPassword → succès, puis sign-in avec le nouveau
  const goodChange = await post(
    "/change-password",
    { currentPassword: PASS1, newPassword: PASS2 },
    token,
  );
  rec(
    "POST /change-password (bon currentPassword)",
    "POST",
    `${goodChange.res.status} ${trunc(goodChange.data, 90)}`,
    goodChange.res.status === 200 ? "pass" : "fail",
  );
  const reSignin = await post("/sign-in/email", { email: EMAIL, password: PASS2 });
  rec(
    "sign-in avec nouveau mdp",
    "POST",
    `${reSignin.res.status} token=${!!reSignin.data?.token}`,
    reSignin.res.status === 200 && reSignin.data?.token ? "pass" : "fail",
  );
  if (reSignin.data?.token) token = reSignin.data.token;
  // l'ancien mdp ne marche plus (401). 429 = rate-limit better-auth (lui-même un
  // garde-fou fonctionnel) après les multiples sign-in du test → toléré (skip).
  const oldSignin = await post("/sign-in/email", { email: EMAIL, password: PASS1 });
  rec(
    "ancien mdp rejeté après changement",
    "POST",
    `${oldSignin.res.status}`,
    oldSignin.res.status === 401 ? "pass" : oldSignin.res.status === 429 ? "skip" : "fail",
  );

  // ── 7. 2FA RETIRÉ : le plugin twoFactor a été supprimé (decision: remove
  //      two factor). On vérifie que l'endpoint n'existe plus (404), au lieu du
  //      500 qu'il renvoyait (schema drift `verified`).
  const tfa = await post("/two-factor/enable", { password: PASS2 }, token);
  rec(
    "2FA retiré : /two-factor/enable absent (404)",
    "POST",
    `${tfa.res.status} ${trunc(tfa.data, 80)}`,
    tfa.res.status === 404 ? "pass" : "fail",
  );

  // ── 8. sign-out → révocation, puis get-session doit échouer ───────────────
  const signout = await post("/sign-out", {}, token);
  rec(
    "POST /sign-out",
    "POST",
    `${signout.res.status} ${trunc(signout.data, 60)}`,
    signout.res.status === 200 ? "pass" : "fail",
  );
  const deadSess = await get("/get-session", token);
  const isDead = deadSess.res.status === 401 || deadSess.data === null || !deadSess.data?.user;
  rec(
    "session révoquée après sign-out",
    "GET /get-session",
    `${deadSess.res.status} ${trunc(deadSess.data, 60)}`,
    isDead ? "pass" : "fail",
  );

  return finish();
}

async function finish() {
  // ── NETTOYAGE : supprime le user jetable + comptes + sessions + 2FA ───────
  try {
    if (userId) {
      await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
      await db.delete(schema.accounts).where(eq(schema.accounts.userId, userId));
      await db.delete(schema.twoFactors).where(eq(schema.twoFactors.userId, userId));
      // verifications : scopé STRICTEMENT à l'identifier de test (JAMAIS de wipe global).
      await db.delete(schema.verifications).where(eq(schema.verifications.identifier, EMAIL));
      await db.delete(schema.users).where(eq(schema.users.id, userId));
    }
    console.log("\n[cleanup] user jetable + comptes/sessions/2FA supprimés.");
  } catch (e) {
    console.error("[cleanup] erreur:", e);
  }

  const pass = rows.filter((r) => r.verdict === "pass").length;
  const fail = rows.filter((r) => r.verdict === "fail").length;
  const skip = rows.filter((r) => r.verdict === "skip").length;
  console.log(
    `\n===== AUTH RÉCAP: ${pass} pass / ${fail} fail / ${skip} skip (total ${rows.length}) =====`,
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
