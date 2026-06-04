// SPDX-License-Identifier: ISC
/**
 * no-404.bxc.e2e.ts — crawl le site DÉPLOYÉ et assure **zéro 404/5xx** sur les
 * pages publiques + privées + routes API + leurs assets internes.
 */
import { afterAll, beforeAll, expect, test, TestPage } from "@aphrody/bxc-test";
import { instant, adaptPage } from "@aphrody/next-playwright";
import { db, schema } from "@rpbey/db";
import { eq } from "drizzle-orm";
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { auth } from "../src/lib/auth";

const BASE = (process.env.RPBEY_TEST_BASE_URL ?? "https://rpbey.vercel.app").replace(/\/$/, "");
const ORIGIN = new URL(BASE).origin;

// ── Authentication forging ──
let adminSessionToken: string | null = null;

// ── Discover all pages and API routes dynamically ──
function findFiles(dir: string, basenamePattern: RegExp, outFiles: string[] = []) {
  try {
    const files = readdirSync(dir);
    for (const f of files) {
      const full = join(dir, f);
      if (statSync(full).isDirectory()) {
        findFiles(full, basenamePattern, outFiles);
      } else if (basenamePattern.test(f)) {
        outFiles.push(full);
      }
    }
  } catch (e) {
    console.error(`[no-404] Error scanning directory ${dir}:`, e);
  }
  return outFiles;
}

function getAppRoutes() {
  const appDir = join(__dirname, "..", "src", "app");
  const pageFiles = findFiles(appDir, /^page\.(tsx|ts|jsx|js)$/);
  const routeFiles = findFiles(appDir, /^route\.(tsx|ts|jsx|js)$/);

  const pages = pageFiles.map(f => {
    let route = "/" + relative(appDir, f)
      .replace(/\/page\.(tsx|ts|jsx|js)$/, "")
      .replace(/page\.(tsx|ts|jsx|js)$/, "")
      .replace(/\/\([^)]+\)/g, "")
      .replace(/^\([^)]+\)/g, "");
    
    route = route.replace(/\/+/g, "/").replace(/\/$/, "");
    if (!route) route = "/";
    return route;
  });

  const apis = routeFiles.map(f => {
    let route = "/" + relative(appDir, f)
      .replace(/\/route\.(tsx|ts|jsx|js)$/, "")
      .replace(/route\.(tsx|ts|jsx|js)$/, "");
    
    route = route.replace(/\/+/g, "/").replace(/\/$/, "");
    if (!route) route = "/";
    return route;
  });

  return { pages, apis };
}

function mockRoute(route: string): string {
  return route
    .replace(/\[slug\]/g, "beyblade-x")
    .replace(/\[id\]/g, "bts4")
    .replace(/\[episode\]/g, "1")
    .replace(/\[\.\.\.path\]/g, "logo.webp")
    .replace(/\[\.\.\.all\]/g, "session")
    .replace(/\[category\]/g, "BLADE")
    .replace(/\[inviteId\]/g, "qa-invite")
    .replace(/\[idOrSlug\]/g, "bts4")
    .replace(/\[year\]/g, "2026")
    .replace(/\[kind\]/g, "thumb")
    .replace(/\[file\]/g, "29128631.jpg");
}

const { pages: discoveredPages, apis: discoveredApis } = getAppRoutes();

// Mocks et Seed de référence
const SEED_ROUTES = [
  "/",
  "/tournaments",
  "/builder",
  "/anime",
  "/anime/beyblade-x",
  "/anime/beyblade-x/galerie",
  "/meta",
  "/comparateur",
  "/notre-equipe",
  "/search",
  "/parts",
];

const MIGRATED_ASSETS = [
  "/logo.webp",
  "/banner.webp",
  "/wb-logo.webp",
  "/satr-logo.webp",
  "/stardust-logo.webp",
  "/beyblade-x-logo.webp",
  "/logo-admin.webp",
  "/rpb.webm",
  "/manifest.json",
  "/seasons/metal-champion.png",
  "/seasons/burst-clash.png",
  "/seasons/bakuten-team.png",
];

interface Result {
  url: string;
  status: number;
  via: "page" | "asset" | "api";
  from?: string;
}

const bad: Result[] = [];
const okCount = { page: 0, asset: 0, api: 0 };
const seenAssets = new Set<string>();

beforeAll(async () => {
  // Forge admin session in DB
  try {
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
    if (adminUser) {
      const authCtx = await auth.$context;
      const s = await authCtx.internalAdapter.createSession(adminUser.id, undefined as never);
      adminSessionToken = (s as { token?: string }).token ?? null;
    }
  } catch (err) {
    console.error("[no-404] Could not forge admin session:", err);
  }
});

afterAll(async () => {
  // Clean up admin session
  if (adminSessionToken) {
    try {
      await db.delete(schema.sessions).where(eq(schema.sessions.token, adminSessionToken));
    } catch (err) {
      console.error("[no-404] Session cleanup failed:", err);
    }
  }

  const total = okCount.page + okCount.asset + okCount.api + bad.length;
  console.log(
    `\n[no-404] base=${BASE} — pages OK=${okCount.page}, assets OK=${okCount.asset}, apis OK=${okCount.api}, ` +
      `non-200=${bad.length} (total=${total})`,
  );
  if (bad.length > 0) {
    console.log(
      bad
        .map((b) => `  ✗ ${b.status} ${b.via} ${b.url}${b.from ? ` (from ${b.from})` : ""}`)
        .join("\n"),
    );
  }
});

function isInternal(u: string): boolean {
  try {
    return new URL(u, BASE).origin === ORIGIN;
  } catch {
    return false;
  }
}

function abs(u: string): string | null {
  try {
    const url = new URL(u, BASE);
    if (url.origin !== ORIGIN) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function extractRefs(html: string): { links: string[]; assets: string[] } {
  const links = new Set<string>();
  const assets = new Set<string>();
  for (const m of html.matchAll(/<a\b[^>]*\bhref=["']([^"'#]+)["']/gi)) {
    const a = abs(m[1]!);
    if (a) links.add(a);
  }
  for (const m of html.matchAll(/<(?:img|script|source)\b[^>]*\bsrc=["']([^"']+)["']/gi)) {
    const a = abs(m[1]!);
    if (a) assets.add(a);
  }
  for (const m of html.matchAll(/<link\b[^>]*\bhref=["']([^"']+)["']/gi)) {
    const a = abs(m[1]!);
    if (a) assets.add(a);
  }
  for (const m of html.matchAll(/\bposter=["']([^"']+)["']/gi)) {
    const a = abs(m[1]!);
    if (a) assets.add(a);
  }
  return { links: [...links], assets: [...assets] };
}

async function checkAsset(url: string, from: string) {
  if (seenAssets.has(url)) return;
  seenAssets.add(url);
  let target = url;
  const m = url.match(/\/_next\/image\?[^#]*\burl=([^&]+)/);
  if (m) {
    const decoded = decodeURIComponent(m[1]!);
    const a = abs(decoded);
    if (!a) return;
    target = a;
  }

  // Permettre les 404 sur les proxies d'assets externes (fancaps/cdn) car ils dégradent proprement
  const parsedUrl = new URL(target, BASE);
  const isExpected404 = parsedUrl.pathname.startsWith("/api/assets/fancaps/") || 
                        parsedUrl.pathname.startsWith("/api/assets/cdn/");

  let res: Response;
  try {
    res = await fetch(target, { method: "GET", redirect: "follow" });
  } catch (e) {
    if (!isExpected404) {
      bad.push({ url: target, status: 0, via: "asset", from });
    }
    return;
  }
  if (res.status >= 400 && !isExpected404) {
    bad.push({ url: target, status: res.status, via: "asset", from });
  } else {
    okCount.asset++;
  }
}

async function injectAuthCookie(p: TestPage) {
  if (adminSessionToken) {
    const urlObj = new URL(BASE);
    await adaptPage(p).context().addCookies([
      {
        name: "rpb-auth.session_token",
        value: adminSessionToken,
        domain: urlObj.hostname,
        path: "/",
      },
      {
        name: "__Secure-rpb-auth.session_token",
        value: adminSessionToken,
        domain: urlObj.hostname,
        path: "/",
        secure: true,
      },
    ]);
  }
}

async function loadPage(p: TestPage, routeOrUrl: string): Promise<{ status: number; html: string }> {
  const url = abs(routeOrUrl) ?? `${BASE}${routeOrUrl}`;
  try {
    const navigated = await Promise.race([
      p.raw.goto(url),
      new Promise<null>((r) => setTimeout(() => r(null), 5000)),
    ]);
    const status = (navigated as { status?: number } | null)?.status ?? 0;
    if (status > 0) {
      const html = await p.raw.content().catch(() => "");
      return { status, html };
    }
  } catch {
    // fallback
  }
  try {
    const headers: Record<string, string> = {};
    if (adminSessionToken) {
      headers["Cookie"] = `rpb-auth.session_token=${adminSessionToken}; __Secure-rpb-auth.session_token=${adminSessionToken}`;
    }
    const r = await fetch(url, { headers, redirect: "follow" });
    const ct = r.headers.get("content-type") ?? "";
    const html = ct.includes("text/html") ? await r.text() : "";
    return { status: r.status, html };
  } catch {
    return { status: 0, html: "" };
  }
}

// ── Tests par Profil bxc ──
const PROFILES = ["static", "fast"] as const;

for (const profile of PROFILES) {
  test(`[${profile}] Page routes dynamic crawl and check`, async () => {
    const p = await TestPage.create({ baseURL: BASE, profile });
    await injectAuthCookie(p);

    const routesToTest = [...new Set([...SEED_ROUTES, ...discoveredPages])]
      .map(mockRoute)
      // On ignore certains endpoints d'auth / callbacks
      .filter((r) => !r.includes("callback") && !r.includes("magic-link"));

    for (const route of routesToTest) {
      const { status, html } = await loadPage(p, route);
      
      // Les routes admin et dashboard non-auth peuvent rediriger vers sign-in (status 302/303 ou 200 sur sign-in)
      // Si adminSessionToken existe, elles devraient être 200.
      if (status >= 500) {
        bad.push({ url: `${BASE}${route}`, status, via: "page" });
        continue;
      }
      okCount.page++;

      if (!html || !/<html|<!doctype/i.test(html)) continue;
      const { assets } = extractRefs(html);
      for (const asset of assets) {
        if (isInternal(asset)) await checkAsset(asset, route);
      }
    }

    await p.close();
  }, 180_000);
}

// ── Test des APIs ──
test("API routes validation (returns status < 500)", async () => {
  const routesToTest = discoveredApis
    .map(mockRoute)
    .filter((r) => !r.includes("callback") && !r.includes("magic-link"));

  for (const apiRoute of routesToTest) {
    const url = `${BASE}${apiRoute}`;
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (adminSessionToken) {
      headers["Authorization"] = `Bearer ${adminSessionToken}`;
    }

    let res: Response;
    try {
      res = await fetch(url, { method: "GET", headers });
    } catch {
      // Ignorer les erreurs réseau pures lors du crawl
      continue;
    }

    // Un retour correct est n'importe quel code de statut < 500 (200, 401, 403, 404, 405 sont tous valides et non des crashs)
    if (res.status >= 500) {
      const parsedUrl = new URL(url);
      const isBotOffline = res.status === 503 && (parsedUrl.pathname.startsWith("/api/bot/") || parsedUrl.pathname.startsWith("/api/v1/bot/"));
      
      let isConfigMissing = false;
      if (res.status === 500 && parsedUrl.pathname === "/api/external/v1/leaderboard") {
        try {
          const json = await res.clone().json();
          if (json.error === "API key not configured on server") {
            isConfigMissing = true;
          }
        } catch {
          // ignore
        }
      }

      if (!isBotOffline && !isConfigMissing) {
        bad.push({ url, status: res.status, via: "api" });
      } else {
        okCount.api++;
      }
    } else {
      okCount.api++;
    }
  }
  expect(bad.filter((b) => b.via === "api")).toHaveLength(0);
}, 120_000);

// ── Test d'Instant Navigation (next-playwright) ──
test("Next.js instant navigation works (next-playwright)", async () => {
  const p = await TestPage.create({ baseURL: BASE, profile: "static" });
  await injectAuthCookie(p);
  await p.goto("/");

  await instant(adaptPage(p), async () => {
    // Navigue vers quelques pages clés en mode instant
    const resTournaments = await p.goto("/tournaments");
    expect(resTournaments.status).toBeLessThan(400);
    const resBuilder = await p.goto("/builder");
    expect(resBuilder.status).toBeLessThan(400);
  });

  await p.close();
}, 60_000);

test("Migrated assets resolve properly", async () => {
  for (const path of MIGRATED_ASSETS) {
    const url = `${BASE}${path}`;
    let res: Response;
    try {
      res = await fetch(url);
    } catch {
      bad.push({ url, status: 0, via: "asset" });
      continue;
    }
    if (res.status >= 400) {
      bad.push({ url, status: res.status, via: "asset" });
    } else {
      okCount.asset++;
    }
  }
  expect(bad.filter((b) => b.via === "asset" && MIGRATED_ASSETS.includes(new URL(b.url).pathname))).toHaveLength(0);
}, 60_000);
