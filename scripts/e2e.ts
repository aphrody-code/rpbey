#!/usr/bin/env bun
/**
 * E2E automatisé — teste CHAQUE page + CHAQUE route API avec un vrai Chromium
 * headless complet (Chrome for Testing via puppeteer). Sortie : rapport des
 * échecs (HTTP 500/erreur, erreurs console, requêtes same-origin échouées) +
 * screenshots dans .shots/.
 *
 *   CHROME=/usr/local/bin/chromium bun scripts/e2e.ts
 *   BASE=https://rpbey.fr (défaut)
 */
import puppeteer from "puppeteer";
import { readdirSync, statSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { $ } from "bun";

const BASE = process.env.BASE ?? "https://rpbey.fr";
const CHROME = process.env.CHROME ?? "/usr/local/bin/chromium";
const APP = "/home/ubuntu/rpbey/apps/web/src/app";
const OUT = "/home/ubuntu/rpbey/.shots";
mkdirSync(OUT, { recursive: true });

// Session admin (cookie fourni hors-repo) → teste les routes auth-gated authentifié.
let ADMIN_TOKEN = "";
try { ADMIN_TOKEN = readFileSync(process.env.ADMIN_TOKEN_FILE ?? "/home/ubuntu/.rpb-adm-session", "utf8").trim(); } catch {}
const AUTH_RE = /^\/(admin|dashboard|profile($|\/)|settings)/;
const cookieHeader = ADMIN_TOKEN ? `__Secure-rpb-auth.session_token=${ADMIN_TOKEN}` : "";
const setAuthCookie = async (page: any) => {
  if (!ADMIN_TOKEN) return;
  await page.setCookie({
    name: "__Secure-rpb-auth.session_token", value: ADMIN_TOKEN,
    domain: new URL(BASE).hostname, path: "/", secure: true, httpOnly: true, sameSite: "Lax",
  });
};

const sql = async (q: string): Promise<string> =>
  (await $`psql -d rpb_neon -tAc ${q}`.quiet().nothrow().text()).trim().split("\n")[0]?.trim() ?? "";

// ── Résolution des segments dynamiques via la DB ──────────────────────────
const sample: Record<string, string> = {
  // route-segment patterns → real value
};
async function resolveDynamics() {
  sample.tournament = await sql(`select id from tournaments order by "createdAt" desc limit 1`);
  sample.profile = await sql(`select id from users where "discordId" is not null limit 1`);
  sample.animeSlug = await sql(`select slug from anime_series limit 1`);
  sample.animeEp = await sql(`select e.number::text from anime_episodes e limit 1`) || "1";
  sample.part = await sql(`select id from parts limit 1`);
  sample.product = await sql(`select id from products limit 1`);
  sample.deck = await sql(`select id from decks limit 1`);
  sample.user = await sql(`select id from users limit 1`);
}

// ── Énumère les routes depuis le filesystem App Router ────────────────────
function walk(dir: string, seg = ""): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (!statSync(p).isDirectory()) continue;
    if (e.startsWith("_")) continue;
    const part = e.startsWith("(") && e.endsWith(")") ? "" : "/" + e; // route groups
    const child = seg + part;
    const files = readdirSync(p);
    if (files.includes("page.tsx") || files.includes("page.ts")) out.push(child || "/");
    if (files.includes("route.ts") || files.includes("route.tsx")) out.push("API " + (child || "/"));
    out.push(...walk(p, child));
  }
  return out;
}

function fillDynamic(route: string): string | null {
  // remplace [slug]/[id]/[episode] par des valeurs réelles ; null = skip si inconnu
  return route
    .replace(/\[\.\.\.[^\]]+\]/g, "x")
    .replace(/\[slug\]\/\[episode\]/g, () => `${sample.animeSlug}/${sample.animeEp}`)
    .replace(/anime\/\[slug\]/g, `anime/${sample.animeSlug}`)
    .replace(/tournaments\/\[id\]/g, `tournaments/${sample.tournament}`)
    .replace(/profile\/\[id\]/g, `profile/${sample.profile}`)
    .replace(/\[seriesId\]/g, sample.animeSlug)
    .replace(/api\/decks\/\[id\]/g, `api/decks/${sample.deck}`)
    .replace(/api\/parts\/\[id\]/g, `api/parts/${sample.part}`)
    .replace(/api\/users\/\[id\]/g, `api/users/${sample.user}`)
    .replace(/\[id\]/g, sample.tournament)
    .replace(/\[slug\]/g, sample.animeSlug)
    .replace(/\[[^\]]+\]/g, "x");
}

await resolveDynamics();
const all = [...new Set(walk(APP))].sort();
const pages = all.filter((r) => !r.startsWith("API ")).map(fillDynamic).filter(Boolean) as string[];
const apis = all.filter((r) => r.startsWith("API ")).map((r) => fillDynamic(r.slice(4))).filter(Boolean) as string[];

// codes "OK" attendus pour les routes gated (auth/param/key)
const okCodes = new Set([200, 204, 301, 302, 304, 307, 308, 400, 401, 403, 405]);
// Bruit non-bug : prefetch RSC annulés, images externes ORB (discord/challonge/…),
// et 429/ERR_FAILED dus au martèlement du harness (50 pages d'affilée → rate-limit
// get-session). On les ignore pour ne remonter que les VRAIES erreurs.
const benign = (u: string) =>
  /_rsc=|cdn\.discordapp|user-assets\.challonge|googleusercontent|ytimg|takaratomy|\/api\/auth\/get-session|429|Too Many Requests|net::ERR_FAILED|ERR_ABORTED|status of 404 \(\)/.test(u);

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
});

const fails: string[] = [];

// ── PAGES ─────────────────────────────────────────────────────────────────
console.log(`\n=== PAGES (${pages.length}) — Chromium: ${CHROME} ===`);
for (const route of pages) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  if (AUTH_RE.test(route)) await setAuthCookie(page);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push("PAGEERROR " + String(e.message).slice(0, 160)));
  // Les "Failed to load resource" console sont redondants avec le handler response
  // (qui a l'URL pour filtrer le bruit) → on ne garde que les vraies erreurs JS console.
  page.on("console", (m) => { const t = m.text(); if (m.type() === "error" && !/Failed to load resource/.test(t) && !benign(t)) errors.push("console " + t.slice(0, 160)); });
  page.on("response", (r) => { if (r.status() >= 400 && r.url().startsWith(BASE) && !benign(r.url())) errors.push(`${r.status()} ${r.url().slice(BASE.length).slice(0, 90)}`); });
  let status = 0;
  try {
    const resp = await page.goto(BASE + route, { waitUntil: "networkidle2", timeout: 30000 });
    status = resp?.status() ?? 0;
    await new Promise((r) => setTimeout(r, 800));
  } catch (e) { errors.push("GOTO " + String((e as Error).message).slice(0, 120)); }
  await new Promise((r) => setTimeout(r, 250)); // évite le rate-limit get-session sous charge
  const name = (route === "/" ? "home" : route.replace(/[/?=&]/g, "_").replace(/^_/, "")).slice(0, 80);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false }).catch(() => {});
  const authedRedirect = AUTH_RE.test(route) && [301, 302, 307, 308].includes(status);
  const bad = !okCodes.has(status) || errors.length > 0 || authedRedirect;
  if (bad) fails.push(`PAGE ${status} ${route}${authedRedirect ? " (auth NON appliquée → redirect sign-in)" : ""}\n    ${errors.slice(0, 4).join("\n    ")}`);
  console.log(`${bad ? "✗" : "✓"} ${status} ${route}${errors.length ? `  (${errors.length} err)` : ""}`);
  await page.close();
}

// ── API ───────────────────────────────────────────────────────────────────
console.log(`\n=== API (${apis.length}) ===`);
for (const route of apis) {
  let status = 0, body = "";
  try {
    if (/\/api\/(events|bot\/events)/.test(route)) { console.log("- skip SSE " + route); continue; }
    const r = await fetch(BASE + route, { redirect: "manual", headers: cookieHeader ? { cookie: cookieHeader } : {}, signal: AbortSignal.timeout(10000) });
    status = r.status; body = (await r.text()).slice(0, 80);
  } catch (e) { body = String((e as Error).message).slice(0, 80); }
  const bad = !okCodes.has(status);
  if (bad) fails.push(`API ${status} ${route}  ${body}`);
  console.log(`${bad ? "✗" : "✓"} ${status} ${route}`);
}

await browser.close();

console.log(`\n=== RÉSULTAT : ${fails.length} échec(s) ===`);
for (const f of fails) console.log("✗ " + f);
if (fails.length === 0) console.log("✅ Toutes les pages + API passent");
process.exit(fails.length ? 1 : 0);
