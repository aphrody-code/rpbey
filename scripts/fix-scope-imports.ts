#!/usr/bin/env bun
// SPDX-License-Identifier: Apache-2.0
//
// fix-scope-imports.ts — scan / verify / fix package scopes toward `@aphrody/*`.
//
// During the npm-org consolidation, every first-party package moves from its
// old scope (`@aphrody-code/*`, and optionally `@n2b/*`, `@rpbey/*`, …) to the
// `@aphrody/*` scope published on npm. This rewrites the *references* — ES/CJS
// import specifiers AND `package.json` dependency keys — so consumers resolve
// the new names.
//
// 100 % Bun-native: `Bun.Glob` for discovery, `Bun.file().text()` to read,
// `Bun.write()` to persist. No external deps, no shelling out.
//
// Usage:
//   bun scripts/fix-scope-imports.ts                 # check (dry-run), exit 1 if stale refs
//   bun scripts/fix-scope-imports.ts --fix           # rewrite in place
//   bun scripts/fix-scope-imports.ts --fix --verify  # rewrite, then assert 0 remain + names known
//   bun scripts/fix-scope-imports.ts --root ../shenron --json
//
// Flags:
//   --root <dir>   repo root to scan            (default: cwd)
//   --fix          apply changes                (default: dry-run / check)
//   --verify       after the pass, re-scan to prove 0 stale refs remain, and
//                  warn on any `@aphrody/<name>` whose <name> is not in --known
//   --known a,b    comma list of valid @aphrody package suffixes for --verify
//                  (default: auto — every @aphrody/* found in node_modules)
//   --json         machine-readable report on stdout
//   --quiet        only the summary line
//   -h, --help

import { Glob } from "bun";
import { parseArgs } from "node:util";
import { isAbsolute, join, relative, resolve } from "node:path";

// ---------------------------------------------------------------------------
// Rename rules. Order matters: EXACT (whole-package, suffix-changing) is applied
// before the PREFIX swap so `@n2b/core` → `@aphrody/n2b-core` wins over a naive
// prefix match. Extend these two tables as the migration grows.
// ---------------------------------------------------------------------------

/** Whole-specifier renames where the suffix itself changes. */
const EXACT: Record<string, string> = {
  // "@n2b/core": "@aphrody/n2b-core",
  // "@n2b/plugin": "@aphrody/n2b-plugin",
  // "@n2b/shims": "@aphrody/n2b-shims",
  // "@n2b/types": "@aphrody/n2b-types",
};

/** Prefix swaps: `<from><suffix>` → `<to><suffix>` (suffix + subpath preserved). */
const PREFIX: Array<{ from: string; to: string }> = [{ from: "@aphrody-code/", to: "@aphrody/" }];

// Files we rewrite string literals in. package.json gets dep-key treatment too.
const SCAN_GLOB = "**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs,json,scss,sass,css}";
const IGNORE = [
  "**/node_modules/**",
  "**/.git/**",
  "**/dist/**",
  "**/build/**",
  "**/.next/**",
  "**/.turbo/**",
  "**/coverage/**",
  "**/vendor/**",
  "**/*.min.*",
];

// ---------------------------------------------------------------------------

interface Hit {
  file: string;
  line: number;
  col: number;
  before: string;
  after: string;
}

/**
 * Specifiers to NEVER rename. `@aphrody/canvas` is an external node-canvas
 * fork published only under that scope (no `@aphrody/canvas` exists / no source
 * repo on the VPS), so consumers keep depending on it as-is.
 */
const SKIP = new Set<string>([]);

/** Quote-aware matcher: only touches specifiers inside ' " or ` quotes. */
function rename(spec: string): string | null {
  // Honour SKIP for the package root and any subpath of a skipped package.
  for (const s of SKIP) if (spec === s || spec.startsWith(s + "/")) return null;
  if (EXACT[spec] !== undefined) return EXACT[spec];
  for (const k of Object.keys(EXACT)) {
    // EXACT applies to subpaths too: "@n2b/core/x" → "@aphrody/n2b-core/x"
    if (spec === k || spec.startsWith(k + "/")) return EXACT[k] + spec.slice(k.length);
  }
  for (const { from, to } of PREFIX) {
    if (spec.startsWith(from)) return to + spec.slice(from.length);
  }
  return null;
}

// Matches a quoted module specifier: the quote, an @scope/name(/sub…), the quote.
const SPEC_RE = /(['"`])(@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._\-/]*)\1/gi;

/** Returns [rewrittenText, hits] for a source/JSON file's raw text. */
function transform(rel: string, text: string): [string, Hit[]] {
  const hits: Hit[] = [];
  const out = text.replace(SPEC_RE, (m, q: string, spec: string, offset: number) => {
    const renamed = rename(spec);
    if (renamed === null || renamed === spec) return m;
    const upto = text.slice(0, offset);
    const line = upto.split("\n").length;
    const col = offset - upto.lastIndexOf("\n");
    hits.push({ file: rel, line, col, before: spec, after: renamed });
    return q + renamed + q;
  });
  return [out, hits];
}

// ---------------------------------------------------------------------------

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    root: { type: "string", default: "." },
    fix: { type: "boolean", default: false },
    verify: { type: "boolean", default: false },
    known: { type: "string" },
    json: { type: "boolean", default: false },
    quiet: { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
  allowPositionals: false,
});

if (values.help) {
  console.log(
    "fix-scope-imports — scan/verify/fix package scopes toward @aphrody/*\n" +
      "  bun scripts/fix-scope-imports.ts [--fix] [--verify] [--root dir] [--known a,b] [--json] [--quiet]",
  );
  process.exit(0);
}

const root = resolve(isAbsolute(values.root!) ? values.root! : join(process.cwd(), values.root!));
const glob = new Glob(SCAN_GLOB);

const allHits: Hit[] = [];
let filesScanned = 0;
let filesChanged = 0;

for await (const entry of glob.scan({ cwd: root, dot: false })) {
  if (IGNORE.some((ig) => new Glob(ig).match(entry))) continue;
  const abs = join(root, entry);
  filesScanned++;
  const text = await Bun.file(abs).text();
  if (!text.includes("@aphrody-code/") && !Object.keys(EXACT).some((k) => text.includes(k))) {
    continue; // fast skip: no candidate scope present
  }
  const [out, hits] = transform(entry, text);
  if (hits.length === 0) continue;
  allHits.push(...hits);
  if (values.fix && out !== text) {
    await Bun.write(abs, out);
    filesChanged++;
  }
}

// --- verify pass ----------------------------------------------------------
const warnings: string[] = [];
if (values.verify) {
  // Known @aphrody suffixes: explicit --known, else everything under node_modules/@aphrody.
  let known = new Set<string>();
  if (values.known) {
    known = new Set(
      values.known
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    );
  } else {
    const nm = join(root, "node_modules", "@aphrody");
    try {
      for await (const d of new Glob("*").scan({ cwd: nm, onlyFiles: false })) known.add(d);
    } catch {
      /* no node_modules/@aphrody yet — skip resolvability check */
    }
  }
  // After a --fix, re-read and assert nothing stale remains; collect unknown @aphrody names.
  let staleRemaining = 0;
  for await (const entry of glob.scan({ cwd: root, dot: false })) {
    if (IGNORE.some((ig) => new Glob(ig).match(entry))) continue;
    const text = await Bun.file(join(root, entry)).text();
    if (text.includes("@aphrody-code/")) staleRemaining++;
    if (known.size) {
      for (const m of text.matchAll(/['"`]@aphrody\/([a-z0-9][a-z0-9._-]*)/gi)) {
        if (!known.has(m[1]!)) warnings.push(`${entry}: unknown @aphrody/${m[1]} (not installed)`);
      }
    }
  }
  if (values.fix && staleRemaining > 0) {
    warnings.push(
      `VERIFY FAILED: ${staleRemaining} files still reference @aphrody-code/ after --fix`,
    );
  }
}

// --- report ---------------------------------------------------------------
const byFile = new Map<string, Hit[]>();
for (const h of allHits) (byFile.get(h.file) ?? byFile.set(h.file, []).get(h.file)!).push(h);

if (values.json) {
  console.log(
    JSON.stringify(
      {
        root,
        mode: values.fix ? "fix" : "check",
        filesScanned,
        filesChanged,
        hits: allHits,
        warnings,
      },
      null,
      2,
    ),
  );
} else {
  if (!values.quiet) {
    for (const [file, hits] of [...byFile].sort()) {
      console.log(`\n${file}`);
      for (const h of hits) console.log(`  ${h.line}:${h.col}  ${h.before}  →  ${h.after}`);
    }
    for (const w of [...new Set(warnings)]) console.log(`\n⚠ ${w}`);
  }
  const verb = values.fix ? "rewrote" : "would rewrite";
  console.log(
    `\n${verb} ${allHits.length} reference(s) across ${byFile.size} file(s) ` +
      `(${filesScanned} scanned, root ${relative(process.cwd(), root) || "."})`,
  );
}

// Exit codes: check-mode with stale refs → 1 (CI gate); verify failure → 1; clean → 0.
const verifyFailed = warnings.some((w) => w.startsWith("VERIFY FAILED"));
if (verifyFailed) process.exit(1);
if (!values.fix && allHits.length > 0) process.exit(1);
process.exit(0);
