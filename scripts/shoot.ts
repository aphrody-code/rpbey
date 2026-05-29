#!/usr/bin/env bun
/** QA visuel : screenshot toutes les pages + collecte erreurs console/réseau. */
import puppeteer from "puppeteer";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE ?? "https://rpbey.fr";
const OUT = "/home/ubuntu/rpbey/.shots";
mkdirSync(OUT, { recursive: true });

const ROUTES = [
  "/",
  "/notre-equipe",
  "/profile",
  "/anime",
  "/tournaments",
  "/rankings",
  "/meta",
  "/tv",
  "/app",
  "/builder",
  "/privacy",
  "/reglement",
  "/tournaments/wb",
  "/tournaments/satr",
  "/sign-in",
  "/dashboard",
];

const exec =
  process.env.CHROME ??
  "/home/ubuntu/.cache/puppeteer/chrome/linux-148.0.7778.97/chrome-linux64/chrome";

const browser = await puppeteer.launch({
  executablePath: exec,
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
});

const report: Record<string, { status: number; consoleErrors: string[]; failed: string[] }> = {};

for (const route of ROUTES) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  const consoleErrors: string[] = [];
  const failed: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200));
  });
  page.on("pageerror", (e) => consoleErrors.push("PAGEERROR: " + String(e.message).slice(0, 200)));
  page.on("requestfailed", (r) =>
    failed.push(`${r.failure()?.errorText} ${r.url().slice(0, 120)}`),
  );
  page.on("response", (r) => {
    if (r.status() >= 400 && r.url().startsWith(BASE))
      failed.push(`${r.status()} ${r.url().slice(BASE.length, BASE.length + 120)}`);
  });

  let status = 0;
  try {
    const resp = await page.goto(BASE + route, { waitUntil: "networkidle2", timeout: 30000 });
    status = resp?.status() ?? 0;
    await new Promise((r) => setTimeout(r, 1200)); // laisse le client hydrater
  } catch (e) {
    consoleErrors.push("GOTO: " + String((e as Error).message).slice(0, 150));
  }
  const name = route === "/" ? "home" : route.replace(/\//g, "_").replace(/^_/, "");
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true }).catch(() => {});
  report[route] = {
    status,
    consoleErrors: [...new Set(consoleErrors)],
    failed: [...new Set(failed)],
  };
  await page.close();
  console.log(
    `${status} ${route}  err:${report[route].consoleErrors.length} failedReq:${report[route].failed.length}`,
  );
}
await browser.close();

console.log("\n=== DÉTAIL ERREURS ===");
for (const [r, d] of Object.entries(report)) {
  if (d.consoleErrors.length || d.failed.length) {
    console.log(`\n## ${r} (HTTP ${d.status})`);
    d.consoleErrors.slice(0, 6).forEach((e) => console.log("  console: " + e));
    d.failed.slice(0, 8).forEach((f) => console.log("  req: " + f));
  }
}
