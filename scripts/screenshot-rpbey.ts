/**
 * screenshot-rpbey.ts — capture toutes les pages publiques de rpbey.fr.
 *
 * But : corpus visuel de référence pour la migration MUI -> material-web.
 * Headless, via le chromium système (pas de download playwright browser).
 *
 * Usage : bun scripts/screenshot-rpbey.ts
 * Sortie : /home/ubuntu/material-web/migration/.rpbey-screenshots/{desktop,mobile}/<slug>.png
 *          + index.json (route -> {desktop, mobile, status, title})
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

const BASE = "https://rpbey.fr";
const OUT = "/home/ubuntu/material-web/migration/.rpbey-screenshots";
const CHROME = "/usr/local/bin/chromium";

// Routes publiques (les groupes (marketing)/(public-parts) sont transparents en URL).
// Les routes auth (dashboard/admin) redirigent vers sign-in : on capture quand même
// pour documenter l'état non-authentifié + les pages d'auth elles-mêmes.
const ROUTES: string[] = [
  "/",
  "/anime",
  "/builder",
  "/comparateur",
  "/meta",
  "/notre-equipe",
  "/privacy",
  "/rankings",
  "/reglement",
  "/tournaments",
  "/tournaments/satr",
  "/tournaments/stardust",
  "/tournaments/wb",
  "/tv",
  "/parts",
  "/sign-in",
  "/sign-up",
  "/admin-login",
  "/dashboard",
  "/dashboard/gacha",
];

const slug = (r: string) => (r === "/" ? "home" : r.replace(/^\//, "").replace(/\//g, "_"));

interface Shot {
  route: string;
  status: number | null;
  title: string;
  desktop: string | null;
  mobile: string | null;
  error?: string;
}

async function run() {
  await mkdir(`${OUT}/desktop`, { recursive: true });
  await mkdir(`${OUT}/mobile`, { recursive: true });

  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });

  const results: Shot[] = [];

  for (const route of ROUTES) {
    const url = `${BASE}${route}`;
    const shot: Shot = {
      route,
      status: null,
      title: "",
      desktop: null,
      mobile: null,
    };
    try {
      // Desktop
      const ctxD = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
        userAgent:
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36 rpb-migration-shot",
      });
      const pageD = await ctxD.newPage();
      const resp = await pageD.goto(url, {
        waitUntil: "networkidle",
        timeout: 45_000,
      });
      shot.status = resp?.status() ?? null;
      shot.title = await pageD.title();
      // laisser les animations/fonts/images se poser
      await pageD.waitForTimeout(2500);
      const dPath = `${OUT}/desktop/${slug(route)}.png`;
      await pageD.screenshot({ path: dPath, fullPage: true });
      shot.desktop = dPath;
      await ctxD.close();

      // Mobile (412x915, Pixel-ish) — informe la migration responsive M3
      const ctxM = await browser.newContext({
        viewport: { width: 412, height: 915 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        userAgent:
          "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36 rpb-migration-shot",
      });
      const pageM = await ctxM.newPage();
      await pageM.goto(url, { waitUntil: "networkidle", timeout: 45_000 });
      await pageM.waitForTimeout(2000);
      const mPath = `${OUT}/mobile/${slug(route)}.png`;
      await pageM.screenshot({ path: mPath, fullPage: true });
      shot.mobile = mPath;
      await ctxM.close();

      console.log(`[ok ${shot.status}] ${route} — "${shot.title.slice(0, 50)}"`);
    } catch (e) {
      shot.error = String(e).slice(0, 200);
      console.log(`[ERR] ${route} — ${shot.error}`);
    }
    results.push(shot);
  }

  await browser.close();
  await writeFile(`${OUT}/index.json`, JSON.stringify(results, null, 2));
  const ok = results.filter((r) => r.desktop).length;
  console.log(`\nDONE: ${ok}/${ROUTES.length} pages capturées. Index: ${OUT}/index.json`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
