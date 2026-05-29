#!/usr/bin/env bun
/**
 * docs.ts — gestionnaire de documentation du monorepo, 100 % API Bun native.
 *
 * Aucune dépendance externe : Bun.Glob (découverte), Bun.file (lecture),
 * Bun.write (écriture), Bun.markdown.html (validation du rendu CommonMark),
 * Bun.spawn (liste des fichiers suivis par git).
 *
 * Commandes :
 *   bun scripts/docs.ts check          audit complet (rendu, liens, orphelins, format) — exit 1 si erreur
 *   bun scripts/docs.ts fmt [--write]  normalise le format (LF, pas d'espace en fin, 1 newline finale)
 *   bun scripts/docs.ts index [--write] (re)génère docs/README.md (index arborescent)
 *   bun scripts/docs.ts list           liste les docs suivies avec leur titre H1
 *
 * Par défaut `fmt`/`index` font un dry-run ; `--write` applique.
 */

import { Glob } from "bun";

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

/** Docs racine canoniques qui servent de points d'entrée (jamais « orphelines »). */
const ENTRYPOINTS = new Set([
  "CLAUDE.md",
  "README.md",
  "docs/README.md",
  "task.md",
  "apps/web/AGENTS.md",
  "apps/bot/AGENTS.md",
  "apps/bot/CLAUDE.md",
  "apps/web/CLAUDE.md",
]);

interface DocFile {
  rel: string;
  abs: string;
  text: string;
  title: string | null;
  /** Cibles de liens relatifs (résolues en chemins repo-relatifs). */
  links: { raw: string; resolved: string; line: number }[];
  /** Liens wiki [[slug]] (mémoire-style), informatifs. */
  wikilinks: string[];
}

interface Finding {
  rel: string;
  kind: "render" | "link" | "format" | "orphan";
  detail: string;
}

function isExcluded(rel: string): boolean {
  return EXCLUDE_DIRS.some((d) => rel === d || rel.startsWith(`${d}/`) || rel.includes(`/${d}/`));
}

// Fichiers .md gérables = suivis par git OU nouveaux non-ignorés.
// `--cached` (trackés) + `--others --exclude-standard` (untracked hors .gitignore)
// en une passe : respecte la politique .gitignore (".md ignoré sauf négations
// docs, apps README, CLAUDE.md, task.md…") → les .md stray à la racine (ignorés)
// sont naturellement exclus, et les docs neuves trackables sont incluses.
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
    const text = await Bun.file(abs).text();
    docs.push({
      rel,
      abs,
      text,
      title: extractTitle(text),
      links: extractLinks(rel, text),
      wikilinks: extractWikilinks(text),
    });
  }
  return docs;
}

async function pathExists(repoRel: string): Promise<boolean> {
  // Un lien peut viser un fichier (doc, image, code) ou un dossier.
  if (await Bun.file(`${ROOT}/${repoRel}`).exists()) return true;
  // Bun.file().exists() est false pour un dossier → tester via un fichier sentinelle.
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

async function cmdCheck(): Promise<number> {
  const docs = await loadDocs();
  const findings: Finding[] = [];
  const byRel = new Map(docs.map((d) => [d.rel, d]));

  // Index inversé des cibles référencées (pour les orphelins).
  const referenced = new Set<string>();
  for (const d of docs) for (const l of d.links) referenced.add(l.resolved);

  for (const d of docs) {
    // 1) rendu CommonMark
    try {
      Bun.markdown.html(d.text);
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
          findings.push({
            rel: d.rel,
            kind: "link",
            detail: `L${l.line} lien cassé -> ${l.raw}`,
          });
        }
      } else if (!(await pathExists(l.resolved))) {
        findings.push({
          rel: d.rel,
          kind: "link",
          detail: `L${l.line} cible absente -> ${l.raw}`,
        });
      }
    }
    // 3) format
    for (const issue of formatIssues(d.text)) {
      findings.push({ rel: d.rel, kind: "format", detail: issue });
    }
    // 4) orphelins : doc du `docs/` racine, jamais référencée, hors points
    //    d'entrée. Les docs locales à une app/package (`apps/*/docs/`,
    //    `packages/*/docs/`) ont leur propre périmètre → non flaggées contre
    //    l'index racine.
    const isNestedLocalDoc = /^(apps|packages)\/[^/]+\/docs\//.test(d.rel);
    if (
      !ENTRYPOINTS.has(d.rel) &&
      !referenced.has(d.rel) &&
      !d.rel.endsWith("/README.md") &&
      !isNestedLocalDoc
    ) {
      findings.push({
        rel: d.rel,
        kind: "orphan",
        detail: "aucun lien entrant",
      });
    }
  }

  // Rapport
  const order: Finding["kind"][] = ["render", "link", "format", "orphan"];
  const counts = Object.fromEntries(
    order.map((k) => [k, findings.filter((f) => f.kind === k).length]),
  );
  console.log(`docs: ${docs.length} fichiers suivis`);
  console.log(
    `findings: render=${counts.render} link=${counts.link} format=${counts.format} orphan=${counts.orphan}`,
  );
  for (const kind of order) {
    const group = findings.filter((f) => f.kind === kind);
    if (group.length === 0) continue;
    console.log(`\n[${kind}]`);
    for (const f of group) console.log(`  ${f.rel}: ${f.detail}`);
  }
  // Les orphelins sont informatifs (warning), pas un échec. render/link/format = échec.
  const hard = counts.render + counts.link + counts.format;
  return hard > 0 ? 1 : 0;
}

async function cmdFmt(write: boolean): Promise<number> {
  const docs = await loadDocs();
  let changed = 0;
  for (const d of docs) {
    const norm = normalize(d.text);
    if (norm !== d.text) {
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
  for (const d of docs) console.log(`${d.rel}\t${d.title ?? "(sans titre H1)"}`);
  return 0;
}

/** Construit l'arbre des docs sous docs/ + les AGENTS/CLAUDE clés, en index markdown. */
async function buildIndex(docs: DocFile[]): Promise<string> {
  const groups = new Map<string, DocFile[]>();
  for (const d of docs) {
    if (!d.rel.startsWith("docs/")) continue;
    const sub = d.rel.slice("docs/".length);
    const top = sub.includes("/") ? sub.slice(0, sub.indexOf("/")) : "(racine)";
    if (!groups.has(top)) groups.set(top, []);
    groups.get(top)!.push(d);
  }
  const lines: string[] = [];
  lines.push("# Documentation — index", "");
  lines.push(
    "> Généré par `bun scripts/docs.ts index --write`. Ne pas éditer à la main : relancer le script.",
    "",
  );
  for (const top of [...groups.keys()].sort()) {
    const title = top === "(racine)" ? "Général" : top;
    lines.push(`## ${title}`, "");
    for (const d of groups.get(top)!.sort((a, b) => a.rel.localeCompare(b.rel))) {
      if (d.rel === "docs/README.md") continue;
      const link = d.rel.slice("docs/".length);
      lines.push(`- [${d.title ?? link}](${link})`);
    }
    lines.push("");
  }
  return normalize(lines.join("\n"));
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
  case "list":
    code = await cmdList();
    break;
  default:
    console.error(
      `commande inconnue: ${cmd}\nusage: bun scripts/docs.ts <check|fmt|index|list> [--write]`,
    );
    code = 2;
}
process.exit(code);
