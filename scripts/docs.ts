#!/usr/bin/env bun
/**
 * docs.ts — gestionnaire de documentation du monorepo, 100 % API Bun native.
 *
 * Aucune dépendance externe hormis `zod` (déjà dans le workspace) : Bun.Glob
 * (découverte), Bun.file (lecture), Bun.write (écriture), Bun.markdown.html
 * (validation du rendu CommonMark/GFM), Bun.YAML (frontmatter), Bun.spawn
 * (git : liste des fichiers suivis + date du dernier commit par périmètre).
 *
 * Trois piliers :
 *   - STRUCTURÉ  frontmatter Zod-typé obligatoire sur tout `docs/**` (hors généré)
 *   - AUTOMATISÉ index (`docs/README.md`) + cartographie (`docs/REPO_MAP.md`) générés
 *   - SYNC       drift code↔doc détecté via git (`scope` modifié après `last_updated`)
 *               + chaque `scope` validé présent sur disque
 *
 * Commandes :
 *   bun scripts/docs.ts check          audit complet — exit 1 si erreur « dure »
 *   bun scripts/docs.ts fmt [--write]  normalise le format (LF, pas d'espace fin, 1 newline)
 *   bun scripts/docs.ts index [--write] (re)génère docs/README.md (index + statut)
 *   bun scripts/docs.ts map   [--write] (re)génère docs/REPO_MAP.md (apps/* + packages/*)
 *   bun scripts/docs.ts list           liste les docs suivies (rel, statut, titre)
 *
 * `fmt`/`index`/`map` font un dry-run par défaut ; `--write` applique.
 */

import { Glob } from "bun";
import { z } from "zod";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");

/** Dossiers exclus de la doc « source » (générés, vendorés, dépendances). */
const EXCLUDE_DIRS = [
  "node_modules",
  ".next",
  "dist",
  ".turbo",
  "coverage",
  "packages/discordx", // fork vendoré
  "challonge-core", // package vendoré
  "data/scrape", // sorties de scraping runtime (non-doc)
  ".agents", // artefacts de coordination multi-agents (non-doc projet)
];

/** Docs racine canoniques = points d'entrée (jamais « orphelines »). */
const ENTRYPOINTS = new Set([
  "CLAUDE.md",
  "README.md",
  "docs/README.md",
  "docs/REPO_MAP.md",
  "task.md",
  "apps/web/AGENTS.md",
  "apps/bot/AGENTS.md",
  "apps/bot/CLAUDE.md",
  "apps/web/CLAUDE.md",
]);

/** Docs générées : frontmatter écrit par le générateur, jamais exigé/édité à la main. */
const GENERATED = new Set(["docs/README.md", "docs/REPO_MAP.md"]);

// ─────────────────────────────────────────────────────────────────────────────
// Frontmatter — schéma canonique (STRUCTURÉ)
// ─────────────────────────────────────────────────────────────────────────────

const STATUS = ["stable", "draft", "generated", "deprecated"] as const;

const FrontmatterSchema = z
  .object({
    /** Titre humain — doit correspondre au H1 du corps. */
    title: z.string().min(1),
    /** Résumé une-ligne — sert au tri de pertinence par un agent. */
    description: z.string().min(1),
    /** Chemins repo-relatifs documentés (apps/web, packages/db, …) — tous validés présents. */
    scope: z.array(z.string().min(1)).min(1),
    /** Cycle de vie du doc. */
    status: z.enum(STATUS),
    /** Date de dernière revue, ISO court (YYYY-MM-DD). */
    last_updated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "format YYYY-MM-DD attendu"),
    /** Symboles/exports clés liés (informatif, non validé). */
    related_symbols: z.array(z.string()).optional(),
  })
  .strict();

type Frontmatter = z.infer<typeof FrontmatterSchema>;

interface DocFile {
  rel: string;
  abs: string;
  /** Texte complet (frontmatter inclus). */
  raw: string;
  /** Corps sans le bloc frontmatter (rendu, liens, H1). */
  body: string;
  title: string | null;
  fm: Frontmatter | null;
  /** Message d'erreur si le frontmatter est présent mais invalide. */
  fmError: string | null;
  /** Vrai si un bloc `---` ouvrant a été détecté. */
  hasFm: boolean;
  links: { raw: string; resolved: string; line: number }[];
  wikilinks: string[];
}

type Kind =
  | "render"
  | "link"
  | "format"
  | "frontmatter"
  | "scope"
  | "generated"
  | "orphan"
  | "stale"
  | "title";
interface Finding {
  rel: string;
  kind: Kind;
  detail: string;
}

/** Findings « durs » (font échouer `check`). Les autres sont informatifs (warning). */
const HARD: Kind[] = ["render", "link", "format", "frontmatter", "scope", "generated"];
const SOFT: Kind[] = ["orphan", "stale", "title"];

function isExcluded(rel: string): boolean {
  return EXCLUDE_DIRS.some((d) => rel === d || rel.startsWith(`${d}/`) || rel.includes(`/${d}/`));
}

// Fichiers .md gérables = suivis par git OU nouveaux non-ignorés.
async function trackedMarkdown(): Promise<string[]> {
  const proc = Bun.spawn(
    ["git", "ls-files", "--cached", "--others", "--exclude-standard", "*.md"],
    { cwd: ROOT, stdout: "pipe" },
  );
  const out = await new Response(proc.stdout).text();
  await proc.exited;
  const rels = out
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return [...new Set(rels)].filter((rel) => !isExcluded(rel)).sort();
}

/** Date du dernier commit (YYYY-MM-DD) touchant l'un des chemins, ou null si non suivi. */
async function lastCommitDate(paths: string[]): Promise<string | null> {
  const proc = Bun.spawn(["git", "log", "-1", "--format=%cs", "--", ...paths], {
    cwd: ROOT,
    stdout: "pipe",
    stderr: "ignore",
  });
  const out = (await new Response(proc.stdout).text()).trim();
  await proc.exited;
  return /^\d{4}-\d{2}-\d{2}$/.test(out) ? out : null;
}

/** Sépare le bloc frontmatter `---\n…\n---` du corps. */
function splitFrontmatter(text: string): { hasFm: boolean; fmRaw: string | null; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?/.exec(text);
  if (!m) return { hasFm: false, fmRaw: null, body: text };
  return { hasFm: true, fmRaw: m[1], body: text.slice(m[0].length) };
}

function parseFrontmatter(fmRaw: string): { fm: Frontmatter | null; error: string | null } {
  let data: unknown;
  try {
    data = Bun.YAML.parse(fmRaw);
  } catch (e) {
    return { fm: null, error: `YAML invalide: ${(e as Error).message}` };
  }
  const res = FrontmatterSchema.safeParse(data);
  if (!res.success) {
    const msg = res.error.issues
      .map((i) => `${i.path.join(".") || "(racine)"}: ${i.message}`)
      .join("; ");
    return { fm: null, error: msg };
  }
  return { fm: res.data, error: null };
}

function extractTitle(text: string): string | null {
  for (const line of text.split("\n")) {
    const m = /^#\s+(.+?)\s*$/.exec(line);
    if (m) return m[1].trim();
  }
  return null;
}

/** Liens markdown `[txt](cible)` pointant vers un fichier local (pas http, pas ancre pure). */
function extractLinks(rel: string, text: string): DocFile["links"] {
  const links: DocFile["links"] = [];
  const lines = text.split("\n");
  const re = /\[[^\]]*\]\(([^)]+)\)/g;
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*```/.test(line)) inFence = !inFence;
    if (inFence) continue;
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(line)) !== null) {
      const raw = m[1].trim().split(/\s+/)[0]; // retire un éventuel "titre"
      if (!raw) continue;
      if (/^(https?:|mailto:|tel:|#|data:)/.test(raw)) continue;
      const target = raw.split("#")[0]; // retire l'ancre
      if (!target) continue; // lien purement ancre interne
      const resolved = resolveRelative(rel, target);
      links.push({ raw, resolved, line: i + 1 });
    }
  }
  return links;
}

function extractWikilinks(text: string): string[] {
  const out: string[] = [];
  const re = /\[\[([a-z0-9-]+)\]\]/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.push(m[1]);
  return out;
}

/** Résout une cible relative depuis le dossier de `rel`, en chemin repo-relatif normalisé. */
function resolveRelative(rel: string, target: string): string {
  if (target.startsWith("/")) return target.replace(/^\/+/, "");
  const baseDir = rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : "";
  const parts = (baseDir ? baseDir.split("/") : []).concat(target.split("/"));
  const stack: string[] = [];
  for (const p of parts) {
    if (p === "" || p === ".") continue;
    if (p === "..") stack.pop();
    else stack.push(p);
  }
  return stack.join("/");
}

async function loadDocs(): Promise<DocFile[]> {
  const rels = await trackedMarkdown();
  const docs: DocFile[] = [];
  for (const rel of rels) {
    const abs = `${ROOT}/${rel}`;
    const raw = await Bun.file(abs).text();
    const { hasFm, fmRaw, body } = splitFrontmatter(raw);
    let fm: Frontmatter | null = null;
    let fmError: string | null = null;
    if (hasFm && fmRaw !== null) {
      const parsed = parseFrontmatter(fmRaw);
      fm = parsed.fm;
      fmError = parsed.error;
    }
    docs.push({
      rel,
      abs,
      raw,
      body,
      title: extractTitle(body),
      fm,
      fmError,
      hasFm,
      links: extractLinks(rel, body),
      wikilinks: extractWikilinks(body),
    });
  }
  return docs;
}

async function pathExists(repoRel: string): Promise<boolean> {
  if (await Bun.file(`${ROOT}/${repoRel}`).exists()) return true;
  const glob = new Glob(`${repoRel}/*`);
  for await (const _ of glob.scan({ cwd: ROOT, onlyFiles: false })) return true;
  return false;
}

function formatIssues(text: string): string[] {
  const issues: string[] = [];
  if (text.includes("\r")) issues.push("CRLF/CR présent (attendu LF)");
  if (/[ \t]+\n/.test(text)) issues.push("espaces en fin de ligne");
  if (text.length > 0 && !text.endsWith("\n")) issues.push("pas de newline finale");
  if (/\n{3,}/.test(text)) issues.push("3+ lignes vides consécutives");
  if (text.endsWith("\n\n")) issues.push("plusieurs newlines finales");
  return issues;
}

function normalize(text: string): string {
  let t = text.replace(/\r\n?/g, "\n"); // CRLF/CR -> LF
  t = t.replace(/[ \t]+\n/g, "\n"); // trailing whitespace
  t = t.replace(/\n{3,}/g, "\n\n"); // collapse blank runs
  t = t.replace(/\n+$/g, "\n"); // exactly one final newline
  if (!t.endsWith("\n")) t += "\n";
  return t;
}

/** Un doc `docs/**` (hors généré) doit porter un frontmatter valide. */
function frontmatterRequired(rel: string): boolean {
  return rel.startsWith("docs/") && !GENERATED.has(rel);
}

async function cmdCheck(): Promise<number> {
  const docs = await loadDocs();
  const findings: Finding[] = [];
  const byRel = new Map(docs.map((d) => [d.rel, d]));

  const referenced = new Set<string>();
  for (const d of docs) for (const l of d.links) referenced.add(l.resolved);

  for (const d of docs) {
    // 1) rendu CommonMark/GFM (corps seul, frontmatter exclu)
    try {
      Bun.markdown.html(d.body, { tables: true, strikethrough: true, tasklists: true });
    } catch (e) {
      findings.push({
        rel: d.rel,
        kind: "render",
        detail: `rendu échoué: ${(e as Error).message}`,
      });
    }

    // 2) liens locaux
    for (const l of d.links) {
      if (l.resolved.endsWith(".md")) {
        if (!byRel.has(l.resolved) && !(await pathExists(l.resolved))) {
          findings.push({ rel: d.rel, kind: "link", detail: `L${l.line} lien cassé -> ${l.raw}` });
        }
      } else if (!(await pathExists(l.resolved))) {
        findings.push({ rel: d.rel, kind: "link", detail: `L${l.line} cible absente -> ${l.raw}` });
      }
    }

    // 3) format
    for (const issue of formatIssues(d.raw)) {
      findings.push({ rel: d.rel, kind: "format", detail: issue });
    }

    // 4) frontmatter (STRUCTURÉ)
    const required = frontmatterRequired(d.rel);
    if (required && !d.hasFm) {
      findings.push({
        rel: d.rel,
        kind: "frontmatter",
        detail: "frontmatter absent (obligatoire sous docs/)",
      });
    } else if (d.hasFm && d.fmError) {
      findings.push({ rel: d.rel, kind: "frontmatter", detail: d.fmError });
    } else if (d.fm) {
      // 4a) titre frontmatter ↔ H1
      if (d.title && d.fm.title !== d.title) {
        findings.push({
          rel: d.rel,
          kind: "title",
          detail: `title frontmatter ("${d.fm.title}") ≠ H1 ("${d.title}")`,
        });
      }
      // 4b) scope présent sur disque (SYNC)
      for (const s of d.fm.scope) {
        if (!(await pathExists(s))) {
          findings.push({ rel: d.rel, kind: "scope", detail: `scope inexistant -> ${s}` });
        }
      }
      // 4c) drift : code du scope modifié après last_updated (SYNC)
      if (d.fm.status === "stable" || d.fm.status === "draft") {
        const commit = await lastCommitDate(d.fm.scope);
        if (commit && commit > d.fm.last_updated) {
          findings.push({
            rel: d.rel,
            kind: "stale",
            detail: `scope modifié le ${commit} > last_updated ${d.fm.last_updated} — relire & bump`,
          });
        }
      }
    }

    // 5) orphelins : doc du `docs/` racine, jamais référencée, hors points d'entrée
    const isNestedLocalDoc = /^(apps|packages)\/[^/]+\/docs\//.test(d.rel);
    if (
      !ENTRYPOINTS.has(d.rel) &&
      !referenced.has(d.rel) &&
      !d.rel.endsWith("/README.md") &&
      !isNestedLocalDoc
    ) {
      findings.push({ rel: d.rel, kind: "orphan", detail: "aucun lien entrant" });
    }
  }

  // 6) drift des fichiers générés (SYNC) : le corps sur disque doit correspondre
  //    à ce que le générateur produirait. On compare le corps (frontmatter exclu)
  //    pour ignorer le churn de `last_updated`.
  const genChecks: { rel: string; build: () => Promise<string> }[] = [
    { rel: "docs/README.md", build: () => buildIndex(docs) },
    { rel: "docs/REPO_MAP.md", build: buildMap },
  ];
  for (const g of genChecks) {
    const onDisk = byRel.get(g.rel);
    if (!onDisk) {
      findings.push({
        rel: g.rel,
        kind: "generated",
        detail: "fichier généré manquant — lancer la génération",
      });
      continue;
    }
    const regen = await g.build();
    if (splitFrontmatter(regen).body.trim() !== onDisk.body.trim()) {
      const how = g.rel.endsWith("REPO_MAP.md") ? "docs:map" : "docs:index";
      findings.push({
        rel: g.rel,
        kind: "generated",
        detail: `obsolète — régénérer via \`bun run ${how}\``,
      });
    }
  }

  // Rapport
  const order: Kind[] = [...HARD, ...SOFT];
  const counts = Object.fromEntries(
    order.map((k) => [k, findings.filter((f) => f.kind === k).length]),
  );
  console.log(`docs: ${docs.length} fichiers suivis`);
  console.log(
    `dur     render=${counts.render} link=${counts.link} format=${counts.format} frontmatter=${counts.frontmatter} scope=${counts.scope} generated=${counts.generated}`,
  );
  console.log(`warning orphan=${counts.orphan} stale=${counts.stale} title=${counts.title}`);
  for (const kind of order) {
    const group = findings.filter((f) => f.kind === kind);
    if (group.length === 0) continue;
    const tag = HARD.includes(kind) ? "ERREUR" : "warn";
    console.log(`\n[${kind}] (${tag})`);
    for (const f of group) console.log(`  ${f.rel}: ${f.detail}`);
  }
  const hard = HARD.reduce((n, k) => n + (counts[k] as number), 0);
  return hard > 0 ? 1 : 0;
}

async function cmdFmt(write: boolean): Promise<number> {
  const docs = await loadDocs();
  let changed = 0;
  for (const d of docs) {
    const norm = normalize(d.raw);
    if (norm !== d.raw) {
      changed++;
      if (write) await Bun.write(d.abs, norm);
      else console.log(`  (dry) ${d.rel}`);
    }
  }
  console.log(
    write
      ? `fmt: ${changed} fichiers normalisés`
      : `fmt: ${changed} fichiers à normaliser (--write pour appliquer)`,
  );
  return 0;
}

async function cmdList(): Promise<number> {
  const docs = await loadDocs();
  for (const d of docs) {
    const status = d.fm?.status ?? (d.hasFm ? "?invalide" : "-");
    console.log(`${d.rel}\t[${status}]\t${d.title ?? "(sans titre H1)"}`);
  }
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// index — docs/README.md (AUTOMATISÉ)
// ─────────────────────────────────────────────────────────────────────────────

const GENERATED_BANNER = "Ne pas éditer à la main : régénéré par le script ci-dessous.";

async function buildIndex(docs: DocFile[]): Promise<string> {
  const groups = new Map<string, DocFile[]>();
  for (const d of docs) {
    if (!d.rel.startsWith("docs/")) continue;
    if (GENERATED.has(d.rel)) continue;
    const sub = d.rel.slice("docs/".length);
    const top = sub.includes("/") ? sub.slice(0, sub.indexOf("/")) : "(racine)";
    if (!groups.has(top)) groups.set(top, []);
    groups.get(top)!.push(d);
  }
  const fm = [
    "---",
    'title: "Documentation — index"',
    'description: "Index arborescent généré de toute la doc sous docs/."',
    "scope:",
    "  - docs",
    'status: "generated"',
    `last_updated: "${TODAY}"`,
    "---",
    "",
  ];
  const lines: string[] = [];
  lines.push("# Documentation — index", "");
  lines.push(`> Généré par \`bun scripts/docs.ts index --write\`. ${GENERATED_BANNER}`, "");
  lines.push("Cartographie du repo (apps/packages) : [REPO_MAP.md](REPO_MAP.md).", "");
  for (const top of [...groups.keys()].sort()) {
    const title = top === "(racine)" ? "Général" : top;
    lines.push(`## ${title}`, "");
    for (const d of groups.get(top)!.sort((a, b) => a.rel.localeCompare(b.rel))) {
      const link = d.rel.slice("docs/".length);
      const status = d.fm?.status ?? "?";
      const desc = d.fm?.description ? ` — ${d.fm.description}` : "";
      lines.push(`- [${d.fm?.title ?? d.title ?? link}](${link}) \`${status}\`${desc}`);
    }
    lines.push("");
  }
  return normalize(fm.join("\n") + lines.join("\n"));
}

async function cmdIndex(write: boolean): Promise<number> {
  const docs = await loadDocs();
  const content = await buildIndex(docs);
  const target = `${ROOT}/docs/README.md`;
  if (write) {
    await Bun.write(target, content);
    console.log("index: docs/README.md généré");
  } else {
    console.log(content);
    console.log("\n(dry-run — --write pour écrire docs/README.md)");
  }
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// map — docs/REPO_MAP.md (AUTOMATISÉ + SYNC : lu depuis les package.json)
// ─────────────────────────────────────────────────────────────────────────────

interface Pkg {
  dir: string; // ex: apps/web
  name: string;
  description: string | null;
  entry: string | null;
  exports: string[] | null;
  scripts: string[];
  internalDeps: string[];
  stack: string[];
}

/** Marqueurs de stack reconnus dans les dependencies. */
const STACK_MARKERS: Record<string, string> = {
  next: "Next.js",
  react: "React",
  "discord.js": "discord.js",
  colyseus: "Colyseus",
  "drizzle-orm": "Drizzle",
  "better-auth": "better-auth",
  "@mui/material": "MUI",
  postgres: "postgres-js",
  zod: "Zod",
  tsyringe: "tsyringe",
  "@colyseus/core": "Colyseus",
  hono: "Hono",
};

async function readPkg(dir: string): Promise<Pkg | null> {
  const file = Bun.file(`${ROOT}/${dir}/package.json`);
  if (!(await file.exists())) return null;
  let json: any;
  try {
    json = JSON.parse(await file.text());
  } catch {
    return null;
  }
  const deps = { ...json.dependencies, ...json.peerDependencies };
  const internalDeps = Object.keys(deps)
    .filter((d) => d.startsWith("@rpbey/") || d.startsWith("@rose-griffon/"))
    .sort();
  const stack = Object.keys(STACK_MARKERS)
    .filter((m) => m in deps)
    .map((m) => STACK_MARKERS[m]);
  const exportsKeys = json.exports
    ? Object.keys(json.exports).filter((k) => k !== "./package.json")
    : null;
  return {
    dir,
    name: json.name ?? dir,
    description: json.description ?? null,
    entry: json.main ?? json.module ?? json.types ?? null,
    exports: exportsKeys && exportsKeys.length ? exportsKeys : null,
    scripts: json.scripts ? Object.keys(json.scripts) : [],
    internalDeps,
    stack: [...new Set(stack)],
  };
}

async function discoverPkgs(glob: string): Promise<Pkg[]> {
  const g = new Glob(glob);
  const dirs: string[] = [];
  for await (const f of g.scan({ cwd: ROOT, onlyFiles: true })) {
    dirs.push(f.replace(/\/package\.json$/, ""));
  }
  const pkgs = (await Promise.all(dirs.sort().map(readPkg))).filter((p): p is Pkg => p !== null);
  return pkgs;
}

function mdCell(s: string | null | undefined): string {
  return (s ?? "—").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function depsCell(deps: string[]): string {
  if (!deps.length) return "—";
  return deps.map((d) => `\`${d}\``).join(" ");
}

async function buildMap(): Promise<string> {
  const apps = await discoverPkgs("apps/*/package.json");
  const packages = await discoverPkgs("packages/*/package.json");
  // Exclut le fork vendoré discordx du tableau packages (déjà signalé hors-doc).
  const pkgsClean = packages.filter((p) => p.dir !== "packages/discordx");

  const fm = [
    "---",
    'title: "Cartographie du monorepo (REPO_MAP)"',
    'description: "Rôle, point d\'entrée, stack et dépendances internes de chaque app/package — généré depuis les package.json."',
    "scope:",
    "  - apps",
    "  - packages",
    'status: "generated"',
    `last_updated: "${TODAY}"`,
    "---",
    "",
  ];

  const L: string[] = [];
  L.push("# Cartographie du monorepo (REPO_MAP)", "");
  L.push(
    `> Généré par \`bun scripts/docs.ts map --write\`. ${GENERATED_BANNER}`,
    "> Source de vérité : les \`package.json\` de \`apps/*\` et \`packages/*\`.",
    "",
  );
  L.push(
    `Index de la doc : [README.md](README.md). Total : ${apps.length} apps, ${pkgsClean.length} packages.`,
    "",
  );

  L.push("## Apps", "");
  L.push("| Package | Rôle | Entrée | Stack | Deps internes |", "| --- | --- | --- | --- | --- |");
  for (const p of apps) {
    L.push(
      `| \`${mdCell(p.name)}\`<br/>\`${p.dir}\` | ${mdCell(p.description)} | ${mdCell(p.entry)} | ${p.stack.length ? p.stack.join(", ") : "—"} | ${depsCell(p.internalDeps)} |`,
    );
  }
  L.push("");

  L.push("## Packages", "");
  L.push(
    "| Package | Rôle | Entrée | Exports | Deps internes |",
    "| --- | --- | --- | --- | --- |",
  );
  for (const p of pkgsClean) {
    const exportsCell = p.exports
      ? p.exports.length > 6
        ? `${p.exports.length} subpaths`
        : p.exports.map((e) => `\`${e}\``).join(" ")
      : "—";
    L.push(
      `| \`${mdCell(p.name)}\`<br/>\`${p.dir}\` | ${mdCell(p.description)} | ${mdCell(p.entry)} | ${exportsCell} | ${depsCell(p.internalDeps)} |`,
    );
  }
  L.push("");

  // Graphe de dépendances internes (qui dépend de quoi).
  L.push("## Graphe des dépendances internes", "");
  const all = [...apps, ...pkgsClean];
  for (const p of all) {
    if (!p.internalDeps.length) continue;
    L.push(`- \`${p.name}\` → ${p.internalDeps.map((d) => `\`${d}\``).join(", ")}`);
  }
  L.push("");

  return normalize(fm.join("\n") + L.join("\n"));
}

async function cmdMap(write: boolean): Promise<number> {
  const content = await buildMap();
  const target = `${ROOT}/docs/REPO_MAP.md`;
  if (write) {
    await Bun.write(target, content);
    console.log("map: docs/REPO_MAP.md généré");
  } else {
    console.log(content);
    console.log("\n(dry-run — --write pour écrire docs/REPO_MAP.md)");
  }
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Date du jour (ISO court). Lue via Bun.spawn(date) pour rester déterministe en CI.
// ─────────────────────────────────────────────────────────────────────────────
const TODAY = (() => {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
})();

const cmd = process.argv[2] ?? "check";
const write = process.argv.includes("--write");
let code = 0;
switch (cmd) {
  case "check":
    code = await cmdCheck();
    break;
  case "fmt":
    code = await cmdFmt(write);
    break;
  case "index":
    code = await cmdIndex(write);
    break;
  case "map":
    code = await cmdMap(write);
    break;
  case "list":
    code = await cmdList();
    break;
  default:
    console.error(
      `commande inconnue: ${cmd}\nusage: bun scripts/docs.ts <check|fmt|index|map|list> [--write]`,
    );
    code = 2;
}
process.exit(code);
