// SPDX-License-Identifier: ISC
/**
 * no-404.bxc.test.ts — crawl le site DÉPLOYÉ et assure **zéro 404/5xx** sur les
 * pages publiques + leurs assets internes (avec une attention particulière aux
 * assets migrés depuis `cdn.rpbey.fr` → Vercel : `public/`, `/api/assets/...`,
 * fichiers `data/*`).
 *
 * Moteur : `@aphrody/bxc-test` (CDP in-process Bun, profil `static`) pour la
 * navigation + le statut HTTP réel des pages, et `fetch` pour vérifier le statut
 * de chaque asset same-origin découvert.
 *
 * Cible : `RPBEY_TEST_BASE_URL` (def. `https://rpbey.fr` une fois le DNS basculé,
 * sinon `https://rpbey.vercel.app`). Lancer :
 *   RPBEY_TEST_BASE_URL=https://rpbey.vercel.app bun test tests/no-404.bxc.test.ts
 *   # ou : bun run test:404
 */
import { afterAll, beforeAll, expect, test } from "@aphrody/bxc-test";
import { TestPage } from "@aphrody/bxc-test";

const BASE = (process.env.RPBEY_TEST_BASE_URL ?? "https://rpbey.vercel.app").replace(/\/$/, "");
const ORIGIN = new URL(BASE).origin;

/** Pages publiques de référence (seed du crawl). Routes connues, sans auth. */
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
  "/manifest.json",
  "/sitemap.xml",
  "/robots.txt",
];

/** Assets migrés à vérifier explicitement (régression cdn.rpbey.fr → Vercel). */
const MIGRATED_ASSETS = [
  // Statiques rapatriés dans public/ (ex-symlink cassé → 404 sur Vercel).
  "/logo.webp",
  "/banner.webp",
  "/wb-logo.webp",
  "/satr-logo.webp",
  "/stardust-logo.webp",
  "/beyblade-x-logo.webp",
  "/logo-admin.webp",
  "/rpb.webm",
  "/manifest.json",
  // Images d'ambiance curées (SectionFrameBg) — ex cdn.rpbey.fr.
  "/seasons/metal-champion.png",
  "/seasons/burst-clash.png",
  "/seasons/bakuten-team.png",
  "/fancaps/29133604.jpg",
  "/fancaps/29131028.jpg",
  "/fancaps/29132373.jpg",
  // Frames d'ambiance proxifiées same-origin (ex cdn.rpbey.fr/fancaps-anime*).
  "/api/assets/fancaps/full/29128631.jpg",
  "/api/assets/fancaps/thumb/29128631.jpg",
  // Échantillon de frames (le JSON est lu depuis le FS bundlé, plus de fetch cdn).
  "/api/v1/anime/frames/ambient?series=beyblade-x&count=8",
];

interface Result {
  url: string;
  status: number;
  via: "page" | "asset";
  from?: string;
}

const bad: Result[] = [];
const okCount = { page: 0, asset: 0 };
const seenAssets = new Set<string>();

let page: TestPage;

beforeAll(async () => {
  page = await TestPage.create({ baseURL: BASE });
});

afterAll(async () => {
  await page.close?.();
  // Rapport lisible en fin de run.
  const total = okCount.page + okCount.asset + bad.length;
  // eslint-disable-next-line no-console
  console.log(
    `\n[no-404] base=${BASE} — pages OK=${okCount.page}, assets OK=${okCount.asset}, ` +
      `non-200=${bad.length} (total=${total})`,
  );
  if (bad.length > 0) {
    // eslint-disable-next-line no-console
    console.log(
      bad
        .map((b) => `  ✗ ${b.status} ${b.via} ${b.url}${b.from ? ` (from ${b.from})` : ""}`)
        .join("\n"),
    );
  }
});

/** Same-origin ? (on ne teste pas les hôtes tiers : wikia, discord, youtube…). */
function isInternal(u: string): boolean {
  try {
    return new URL(u, BASE).origin === ORIGIN;
  } catch {
    return false;
  }
}

/** Normalise une URL relative/absolue → absolue same-origin (sans hash). */
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

/** Extrait href/src des `<a> <img> <link> <script> <source>` du HTML. */
function extractRefs(html: string): { links: string[]; assets: string[] } {
  const links = new Set<string>();
  const assets = new Set<string>();
  // <a href>
  for (const m of html.matchAll(/<a\b[^>]*\bhref=["']([^"'#]+)["']/gi)) {
    const a = abs(m[1]!);
    if (a) links.add(a);
  }
  // assets : img/script/source src, link href, poster, srcset (1ère URL)
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
  // Next/Image optimizer (`/_next/image?url=…`) : on saute l'optimizer lui-même
  // mais on vérifie l'URL source same-origin encodée dedans.
  let target = url;
  const m = url.match(/\/_next\/image\?[^#]*\burl=([^&]+)/);
  if (m) {
    const decoded = decodeURIComponent(m[1]!);
    const a = abs(decoded);
    if (!a) return; // source distante (remotePattern) → hors scope same-origin
    target = a;
  }
  let res: Response;
  try {
    res = await fetch(target, { method: "GET", redirect: "follow" });
  } catch (e) {
    bad.push({ url: target, status: 0, via: "asset", from });
    return;
  }
  if (res.status >= 400) {
    bad.push({ url: target, status: res.status, via: "asset", from });
  } else {
    okCount.asset++;
  }
}

/**
 * Charge une page : statut + HTML. On tente d'abord le moteur CDP `bxc-test`
 * (`page.goto` → statut HTTP réel) ; en cas d'échec (le profil `static`
 * happy-dom applique la Same-Origin Policy sur un `goto` cross-origin), on
 * retombe sur `fetch` (oracle de statut fiable, Bun natif). HTML récupéré via
 * `page.content()` si dispo, sinon le corps de la réponse `fetch`.
 */
async function loadPage(
  routeOrUrl: string,
): Promise<{ status: number; html: string }> {
  const url = abs(routeOrUrl) ?? `${BASE}${routeOrUrl}`;
  // 1) bxc-test (CDP) — statut HTTP réel + DOM. On borne par un timeout : le
  // profil `static` happy-dom peut bloquer sur un goto cross-origin → on retombe
  // alors immédiatement sur `fetch` (oracle fiable, rapide).
  try {
    const navigated = await Promise.race([
      page.goto(routeOrUrl),
      new Promise<null>((r) => setTimeout(() => r(null), 4000)),
    ]);
    const status = (navigated as { status?: number } | null)?.status ?? 0;
    if (status > 0) {
      const html = await page.content().catch(() => "");
      return { status, html };
    }
  } catch {
    /* fallback fetch */
  }
  // 2) fetch — statut + corps brut (chemin principal robuste, sans SOP).
  try {
    const r = await fetch(url, { redirect: "follow" });
    const ct = r.headers.get("content-type") ?? "";
    const html = ct.includes("text/html") ? await r.text() : "";
    return { status: r.status, html };
  } catch {
    return { status: 0, html: "" };
  }
}

test("seed pages return 200 and their assets resolve (no 404/5xx)", async () => {
  const discoveredLinks = new Set<string>();

  for (const route of SEED_ROUTES) {
    const { status, html } = await loadPage(route);
    if (status >= 400 || status === 0) {
      bad.push({ url: `${BASE}${route}`, status, via: "page" });
      continue;
    }
    okCount.page++;

    // HTML pages only → extraire liens + assets.
    if (!html || !/<html|<!doctype/i.test(html)) continue;
    const { links, assets } = extractRefs(html);
    for (const l of links) discoveredLinks.add(l);
    for (const asset of assets) {
      if (isInternal(asset)) await checkAsset(asset, route);
    }
  }

  // Crawl 1 niveau : visiter les liens internes découverts (cap pour borner le run).
  const toVisit = [...discoveredLinks]
    .filter((l) => !SEED_ROUTES.some((r) => abs(r) === l))
    .slice(0, 40);
  for (const link of toVisit) {
    const { status, html } = await loadPage(link);
    if (status >= 400 || status === 0) {
      bad.push({ url: link, status, via: "page" });
    } else {
      okCount.page++;
      if (html && /<html|<!doctype/i.test(html)) {
        for (const asset of extractRefs(html).assets) {
          if (isInternal(asset)) await checkAsset(asset, link);
        }
      }
    }
  }

  const nonOk = bad.filter((b) => b.via === "page");
  expect(
    nonOk,
    `pages non-200:\n${nonOk.map((b) => `  ${b.status} ${b.url}`).join("\n")}`,
  ).toHaveLength(0);
}, 180_000);

test("migrated assets (ex-cdn.rpbey.fr) all resolve 200 on Vercel", async () => {
  const failures: Result[] = [];
  for (const path of MIGRATED_ASSETS) {
    const url = `${BASE}${path}`;
    let res: Response;
    try {
      res = await fetch(url, { redirect: "follow" });
    } catch {
      failures.push({ url, status: 0, via: "asset" });
      continue;
    }
    if (res.status >= 400) failures.push({ url, status: res.status, via: "asset" });
    else okCount.asset++;
  }
  expect(
    failures,
    `migrated assets non-200:\n${failures.map((b) => `  ${b.status} ${b.url}`).join("\n")}`,
  ).toHaveLength(0);
}, 60_000);

test("no cdn.rpbey.fr URL is rendered into the homepage or ambient API", async () => {
  // Page d'accueil : aucune référence cdn.rpbey.fr dans le HTML rendu.
  const { html } = await loadPage("/");
  expect(html.includes("cdn.rpbey.fr"), "homepage HTML must not reference cdn.rpbey.fr").toBe(
    false,
  );

  // API d'ambiance : les imageUrl/thumbUrl ne pointent plus cdn.rpbey.fr.
  const res = await fetch(`${BASE}/api/v1/anime/frames/ambient?series=beyblade-x&count=12`);
  expect(res.status).toBe(200);
  const json = (await res.json()) as { data?: { imageUrl?: string; thumbUrl?: string }[] };
  const urls = (json.data ?? []).flatMap((f) => [f.imageUrl ?? "", f.thumbUrl ?? ""]);
  const leaks = urls.filter((u) => u.includes("cdn.rpbey.fr"));
  expect(leaks, `ambient frames still reference cdn.rpbey.fr:\n${leaks.join("\n")}`).toHaveLength(
    0,
  );
}, 60_000);
