#!/usr/bin/env bun
/**
 * har-capture.ts — capture d'endpoints Challonge via HAR (dev-only, Bun).
 *
 * Lance `bxc har record <url> <out.har>` (profil fast = vrai Chrome CDP → capture
 * XHR/GraphQL post-hydratation) sur la page `/module` d'un tournoi + la page de
 * recherche `/tournaments`, parse les .har (W3C HAR JSON), extrait les requêtes
 * XHR/API internes du domaine challonge (hors assets img/css/js/font), puis MET À
 * JOUR `data/challonge-endpoints.manifest.json` (merge non destructif : nouveaux
 * endpoints ajoutés, statut rafraîchi, capturedAt + source passés à "har").
 *
 * Best-effort : si `bxc` est indisponible ou si le CDP échoue, log proprement et
 * sort sans écraser le seed versionné.
 *
 * Usage :
 *   bun scripts/har-capture.ts <slug>            # ex. B_TS5  (ou worldbeyblade-org_slug)
 *   bun scripts/har-capture.ts <slug> <lang>     # lang par défaut : fr
 *
 * Ce script vit dans scripts/ (PAS src/) → la contrainte « no Bun.$ » du bot ne
 * s'applique pas ici : Bun.spawn est utilisé pour piloter bxc.
 */

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = join(SCRIPT_DIR, "..");
const MANIFEST_PATH = join(PKG_ROOT, "data", "challonge-endpoints.manifest.json");

const CHALLONGE_HOST_RE = /(^|\.)challonge\.com$/i;
// Assets à exclure : extensions statiques + hôtes d'assets connus.
const ASSET_EXT_RE =
  /\.(?:js|mjs|css|png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|eot|map|mp4|webm)(?:$|\?)/i;
const ASSET_HOST_RE = /^(?:assets|user-assets)\.challonge\.com$/i;
// Types de ressource CDP/HAR considérés comme « appel applicatif » (vs navigation/asset).
const XHR_RESOURCE_TYPES = new Set(["xhr", "fetch", "websocket", "eventsource"]);

interface HarHeader {
  name: string;
  value: string;
}
interface HarRequest {
  method: string;
  url: string;
  headers?: HarHeader[];
}
interface HarResponse {
  status: number;
  content?: { mimeType?: string };
}
interface HarEntry {
  request: HarRequest;
  response: HarResponse;
  _resourceType?: string; // extension Chrome (chrome-har)
  resourceType?: string;
}
interface HarFile {
  log?: { entries?: HarEntry[] };
}

interface ManifestEndpoint {
  method: string;
  urlPattern: string;
  kind: string;
  status: number;
  notes?: string;
}
interface Manifest {
  capturedAt: string | null;
  source: string;
  notes?: string;
  endpoints: ManifestEndpoint[];
}

function log(...args: unknown[]): void {
  console.error("[har-capture]", ...args);
}

/** Résout le binaire bxc : $BXC_BIN, ou ~/bxc/bin/bxc, ou PATH. */
async function resolveBxc(): Promise<string | null> {
  const fromEnv = process.env.BXC_BIN;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  const home = process.env.HOME ?? "";
  const candidate = home ? join(home, "bxc", "bin", "bxc") : "";
  if (candidate && existsSync(candidate)) return candidate;
  // Fallback PATH via `which`.
  try {
    const proc = Bun.spawn(["which", "bxc"], {
      stdout: "pipe",
      stderr: "ignore",
    });
    const out = (await new Response(proc.stdout).text()).trim();
    await proc.exited;
    if (proc.exitCode === 0 && out && existsSync(out)) return out;
  } catch {
    // ignore
  }
  return null;
}

/** Enregistre une URL en HAR via bxc (profil fast → Chrome CDP). Retourne le HAR parsé ou null. */
async function recordHar(bxc: string, url: string, outPath: string): Promise<HarFile | null> {
  log(`record ${url} → ${outPath}`);
  try {
    const proc = Bun.spawn([bxc, "har", "record", url, outPath, "--profile", "fast", "--quiet"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const exited = await Promise.race([
      proc.exited,
      // garde-fou : 90 s max par capture (CDP peut bloquer sur CF).
      new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), 90_000)),
    ]);
    if (exited === "timeout") {
      log(`timeout sur ${url} — kill`);
      proc.kill();
      return null;
    }
    if (proc.exitCode !== 0) {
      const err = (await new Response(proc.stderr).text()).trim();
      log(`bxc har record exit ${proc.exitCode} sur ${url}${err ? ` : ${err.slice(0, 200)}` : ""}`);
      return null;
    }
  } catch (e) {
    log(`spawn échoué sur ${url} : ${(e as Error).message}`);
    return null;
  }

  if (!existsSync(outPath)) {
    log(`HAR absent après record : ${outPath}`);
    return null;
  }
  try {
    return (await Bun.file(outPath).json()) as HarFile;
  } catch (e) {
    log(`parse HAR échoué (${outPath}) : ${(e as Error).message}`);
    return null;
  }
}

function resourceTypeOf(entry: HarEntry): string {
  return (entry._resourceType ?? entry.resourceType ?? "").toLowerCase();
}

/** Vrai si l'entrée est un appel applicatif Challonge (XHR/fetch, hors asset). */
function isInternalApiCall(entry: HarEntry): boolean {
  const { url, method } = entry.request;
  let host: string;
  let path: string;
  try {
    const u = new URL(url);
    host = u.hostname;
    path = u.pathname;
  } catch {
    return false;
  }
  if (!CHALLONGE_HOST_RE.test(host) && !/^api\.challonge\.com$/i.test(host)) return false;
  if (ASSET_HOST_RE.test(host)) return false;
  if (ASSET_EXT_RE.test(url)) return false;
  if (!method) return false;

  const rtype = resourceTypeOf(entry);
  if (rtype && !XHR_RESOURCE_TYPES.has(rtype)) {
    // Document/navigate/stylesheet/script/image/font → ignoré sauf si endpoint .json explicite.
    if (rtype === "document" && /\.json(?:$|\?)/i.test(path)) {
      // une navigation vers un .json reste un endpoint utile à noter
    } else {
      return false;
    }
  }
  return true;
}

/**
 * Normalise une URL observée en urlPattern paramétré (mêmes placeholders que le seed).
 * Conserve le path, remplace les segments dynamiques connus et compacte la query en clés.
 */
function toUrlPattern(rawUrl: string): string {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return rawUrl;
  }
  const segments = u.pathname.split("/").filter(Boolean);
  const langs = new Set(["fr", "en", "es", "de", "pt", "it", "ja", "ko", "zh", "ru"]);
  const mapped: string[] = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i] ?? "";
    if (i === 0 && langs.has(seg.toLowerCase())) {
      mapped.push("{lang}");
      continue;
    }
    if (seg === "users" && i + 1 < segments.length) {
      mapped.push("users", "{username}");
      i++;
      continue;
    }
    // suffixes de route connus (laissés littéraux)
    if (
      [
        "module",
        "standings",
        "log",
        "participants",
        "groups",
        "predictions",
        "announcements",
      ].includes(seg)
    ) {
      mapped.push(seg);
      continue;
    }
    // .json final → slug.json
    if (
      /\.json$/i.test(seg) &&
      i === segments.length - 1 &&
      !["games.json", "tournaments.json"].includes(seg)
    ) {
      mapped.push("{slug}.json");
      continue;
    }
    // games.json / tournaments.json littéraux
    if (["games.json", "tournaments.json"].includes(seg)) {
      mapped.push(seg);
      continue;
    }
    // segment "tournaments" littéral (listing/recherche)
    if (seg === "tournaments") {
      mapped.push(seg);
      continue;
    }
    // sinon : slug de tournoi
    mapped.push("{slug}");
  }
  let pattern = `${u.protocol}//${u.host}/${mapped.join("/")}`;
  const keys = [...u.searchParams.keys()];
  if (keys.length > 0) {
    pattern += `?${keys.map((k) => `${k}={${k}}`).join("&")}`;
  }
  return pattern;
}

function classifyKind(rawUrl: string, mimeType: string | undefined): string {
  let host = "";
  let path = "";
  try {
    const u = new URL(rawUrl);
    host = u.hostname;
    path = u.pathname;
  } catch {
    // ignore
  }
  if (/^api\.challonge\.com$/i.test(host)) {
    if (path.includes("/graphql")) return "absent";
    if (path.includes("/oauth/")) return "oauth";
    if (path.includes("/v2.1/") || path.includes("/v2/")) return "rest-v2.1";
    if (path.includes("/v1/")) return "rest-v1";
    return "json-api";
  }
  if (path.endsWith("games.json")) return "asset-catalog";
  const isJson = /json/i.test(mimeType ?? "") || /\.json(?:$|\?)/i.test(path);
  return isJson ? "json-xhr" : "ssr-html";
}

async function loadManifest(): Promise<Manifest> {
  return (await Bun.file(MANIFEST_PATH).json()) as Manifest;
}

/** Merge les endpoints observés dans le manifest, par clé (method + urlPattern). */
function mergeEndpoints(manifest: Manifest, observed: ManifestEndpoint[]): number {
  const index = new Map<string, ManifestEndpoint>();
  for (const ep of manifest.endpoints) index.set(`${ep.method} ${ep.urlPattern}`, ep);
  let added = 0;
  for (const ep of observed) {
    const key = `${ep.method} ${ep.urlPattern}`;
    const existing = index.get(key);
    if (existing) {
      existing.status = ep.status; // rafraîchit le statut observé
      existing.notes = existing.notes ? `${existing.notes} [har:${ep.status}]` : ep.notes;
    } else {
      manifest.endpoints.push(ep);
      index.set(key, ep);
      added++;
    }
  }
  return added;
}

async function main(): Promise<void> {
  const slug = process.argv[2];
  const lang = process.argv[3] ?? "fr";
  if (!slug) {
    log("usage: bun scripts/har-capture.ts <slug> [lang=fr]");
    process.exitCode = 2;
    return;
  }

  const bxc = await resolveBxc();
  if (!bxc) {
    log(
      "bxc introuvable ($BXC_BIN / ~/bxc/bin/bxc / PATH) — seed conservé intact, sortie best-effort.",
    );
    return;
  }
  log(`bxc = ${bxc}`);

  const targets: { url: string; tag: string }[] = [
    { url: `https://challonge.com/${lang}/${slug}/module`, tag: "module" },
    {
      url: `https://challonge.com/${lang}/tournaments?game_id=337197&state=ended&tournament_type=double_elimination&page=1`,
      tag: "search",
    },
  ];

  const tmpDir = process.env.TMPDIR ?? "/tmp";
  const observed: ManifestEndpoint[] = [];
  const seenKeys = new Set<string>();
  let anySuccess = false;

  for (const { url, tag } of targets) {
    const outPath = join(tmpDir, `challonge-har-${tag}-${Date.now()}.har`);
    const har = await recordHar(bxc, url, outPath);
    // nettoyage best-effort du fichier temporaire
    try {
      if (existsSync(outPath)) await Bun.file(outPath).delete?.();
    } catch {
      // ignore
    }
    if (!har) continue;
    anySuccess = true;

    const entries = har.log?.entries ?? [];
    for (const entry of entries) {
      if (!isInternalApiCall(entry)) continue;
      const pattern = toUrlPattern(entry.request.url);
      const method = entry.request.method.toUpperCase();
      const key = `${method} ${pattern}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      observed.push({
        method,
        urlPattern: pattern,
        kind: classifyKind(entry.request.url, entry.response.content?.mimeType),
        status: entry.response.status,
        notes: `Observé via HAR (CDP fast) sur ${tag}`,
      });
    }
    log(`${tag} : ${entries.length} entrées HAR, ${observed.length} endpoints internes cumulés`);
  }

  if (!anySuccess) {
    log("aucune capture réussie (CDP/CF) — seed conservé intact, sortie best-effort.");
    return;
  }

  const manifest = await loadManifest();
  const added = mergeEndpoints(manifest, observed);
  manifest.capturedAt = new Date().toISOString();
  manifest.source = "har";
  await Bun.write(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  log(
    `manifest mis à jour : ${observed.length} observés, ${added} nouveaux, total ${manifest.endpoints.length}.`,
  );
}

await main();
