#!/usr/bin/env bun
// SPDX-License-Identifier: Apache-2.0
//
// test-all.ts — custom Bun test runner that covers EVERY workspace scope.
//
// Why this exists: `turbo run test` only runs scopes that declare a `test`
// script, so script-less members (e.g. apps/gacha-server and apps/web here —
// which HAVE test files) are SILENTLY skipped, and zero-test scopes are
// invisible. This runner enumerates every member from the `workspaces` globs
// (including the nested packages/discordx/packages/*), assigns each discovered
// test file to its deepest owning member, runs `bun test` per scope in its OWN
// cwd (so each scope's bunfig [test].preload applies — reflect-metadata for the
// bot, happy-dom for the web dashboard), classifies the vendored discordx fork
// and the broken/generated scopes EXPLICITLY (no silent skips), prints a full
// scope matrix, and fails on any unexplained gap.
//
// Test-file discovery is git-based (tracked + untracked-but-not-ignored), which
// auto-prunes node_modules/.next/dist/coverage via .gitignore — so the
// .next/standalone build-output COPY of utils.test.ts is never double-run — and
// still picks up brand-new, uncommitted test files.
//
// Usage:
//   bun scripts/test-all.ts                 # default offline tier (unit scopes)
//   bun scripts/test-all.ts --vendored      # also run the vendored discordx fork
//   bun scripts/test-all.ts --strict        # zero-test scopes FAIL the run
//   bun scripts/test-all.ts --coverage      # per-scope lcov into coverage/<scope>/
//   bun scripts/test-all.ts --junit         # per-scope JUnit xml into test-results/
//   bun scripts/test-all.ts --filter web    # only scopes whose name/path contains "web"
//   bun scripts/test-all.ts --randomize --rerun-each=3   # flake / order-dependence hunt
//   bun scripts/test-all.ts --json          # machine-readable summary
//
// Exit code: 0 iff every selected runnable scope passed and (in --strict) no gap.

import { Glob } from "bun";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");

// ── CLI ───────────────────────────────────────────────────────────────────────
const argvList = Bun.argv.slice(2);
const argv = new Set(argvList);
const flag = (n: string) => argv.has(n);
const opt = (n: string): string | undefined => {
  for (let i = 0; i < argvList.length; i++) {
    if (argvList[i].startsWith(`${n}=`)) return argvList[i].slice(n.length + 1);
    if (argvList[i] === n && i + 1 < argvList.length && !argvList[i + 1].startsWith("--"))
      return argvList[i + 1];
  }
  return undefined;
};
const RUN_LIVE = flag("--live") || flag("--all");
const RUN_VENDORED = flag("--vendored") || flag("--all");
const STRICT = flag("--strict");
const COVERAGE = flag("--coverage");
const JUNIT = flag("--junit");
const BAIL = flag("--bail");
const JSON_OUT = flag("--json");
const FILTER = opt("--filter");

// Flags forwarded verbatim to every per-scope `bun test` — make the runner a
// real flake / order-dependence harness: --randomize/--seed surface shared-state
// coupling, --rerun-each catches non-determinism, --retry mitigates flakes,
// --concurrent/--max-concurrency add intra-file parallelism, -t narrows by name.
const PASSTHROUGH: string[] = (() => {
  const out: string[] = [];
  for (const b of ["--randomize", "--concurrent"]) if (flag(b)) out.push(b);
  for (const v of [
    "--seed",
    "--rerun-each",
    "--retry",
    "--max-concurrency",
    "--test-name-pattern",
    "-t",
  ]) {
    const val = opt(v);
    if (val !== undefined) out.push(v, val);
  }
  return out;
})();

// ── Scope policy ──────────────────────────────────────────────────────────────
type Mode = "unit" | "live" | "vendored" | "skip";
interface Policy {
  mode?: Mode;
  reason?: string;
  perFile?: boolean; // run each file in its own process (fixture isolation)
  preload?: string[];
  prep?: string[][];
  env?: Record<string, string>;
  timeoutMs?: number;
}

// Explicit overrides keyed by package name. Anything not here is classified by
// classify() below (path rules) and defaults to { mode: "unit" }.
const POLICY: Record<string, Policy> = {
  // The bot suite uses process-global `mock.module` + top-level-await dynamic
  // imports, so sharing one `bun test` process leaks mocks across files (an
  // order-dependent failure). Isolate each file in its own process — matches
  // the bot's intent and is deterministic regardless of discovery order.
  "@rose-griffon/bot": { mode: "unit", perFile: true, timeoutMs: 30_000 },
  // Generated OpenAPI SDK — its surface is exercised by @rpbey/api-contract's
  // own suite (the schemas it is generated from), so a separate suite would be
  // redundant. Skipped with a reason rather than reported as a gap.
  "@rpbey/api-client": {
    mode: "skip",
    reason: "generated SDK (@hey-api) from @rpbey/api-contract — covered by that scope's tests",
  },
  // The vendored fork's broken leaf: its self-import `discordx` is absent from
  // node_modules (Cannot find package 'discordx'); excluded in CI upstream.
  "@rpbey/discordx": {
    mode: "skip",
    reason:
      "vendored discordx fork: missing self-dep 'discordx' (Cannot find package) — excluded in CI",
  },
};

// Path-based classification for the nested vendored fork subtree.
function classify(name: string, rel: string): Policy {
  if (POLICY[name]) return POLICY[name];
  if (rel === "packages/discordx" || rel.startsWith("packages/discordx/")) {
    return { mode: "vendored", reason: "vendored discordx fork (use --vendored)" };
  }
  return { mode: "unit" };
}

// ── Workspace discovery ───────────────────────────────────────────────────────
const PRUNE = ["node_modules", ".next", "dist", "build", "coverage", ".turbo", ".git"];

interface Member {
  name: string;
  dir: string; // absolute
  rel: string; // relative to ROOT
  policy: Policy;
  files: string[]; // absolute test-file paths assigned to this member
}

async function discoverMembers(): Promise<Member[]> {
  const rootPkg = (await Bun.file(join(ROOT, "package.json")).json()) as {
    workspaces?: string[] | { packages?: string[] };
  };
  const ws = rootPkg.workspaces;
  const globs = Array.isArray(ws) ? ws : (ws?.packages ?? []);
  const seen = new Set<string>();
  const members: Member[] = [];
  for (const g of globs) {
    const glob = new Glob(`${g}/package.json`);
    for await (const rel of glob.scan({ cwd: ROOT, onlyFiles: true, followSymlinks: false })) {
      if (PRUNE.some((p) => rel.split("/").includes(p))) continue;
      const dir = resolve(ROOT, rel, "..");
      if (seen.has(dir)) continue;
      seen.add(dir);
      let name = rel;
      try {
        name = ((await Bun.file(resolve(ROOT, rel)).json()) as { name?: string }).name ?? rel;
      } catch {
        /* keep rel */
      }
      const relDir = dir.slice(ROOT.length + 1);
      members.push({ name, dir, rel: relDir, policy: classify(name, relDir), files: [] });
    }
  }
  members.sort((a, b) => a.rel.localeCompare(b.rel));
  return members;
}

// All non-ignored test files repo-wide, via git (auto-prunes .gitignore trees,
// includes fresh untracked files). Falls back to a Glob walk if git is absent.
async function discoverTestFiles(): Promise<string[]> {
  const pats = [
    "*.test.ts",
    "*.test.tsx",
    "*.test.js",
    "*.test.jsx",
    "*.spec.ts",
    "*.spec.tsx",
    "*_test.ts",
    "*_spec.ts",
  ];
  const gitList = async (extra: string[]): Promise<string[]> => {
    const proc = Bun.spawn(["git", "-C", ROOT, "ls-files", ...extra, "--", ...pats], {
      stdout: "pipe",
      stderr: "ignore",
    });
    const text = await new Response(proc.stdout).text();
    const code = await proc.exited;
    if (code !== 0) throw new Error("git ls-files failed");
    return text.split("\n").filter(Boolean);
  };
  try {
    const tracked = await gitList([]);
    const untracked = await gitList(["--others", "--exclude-standard"]);
    return [...new Set([...tracked, ...untracked])].map((r) => join(ROOT, r));
  } catch {
    // Fallback: Glob walk with manual prune (slower; no git in env).
    const glob = new Glob("**/*.{test,spec}.{ts,tsx,js,jsx}");
    const out: string[] = [];
    for await (const rel of glob.scan({ cwd: ROOT, onlyFiles: true, followSymlinks: false })) {
      if (PRUNE.some((p) => rel.split("/").includes(p))) continue;
      out.push(join(ROOT, rel));
    }
    return out;
  }
}

// Assign each test file to the member with the deepest (longest) dir prefix.
function assignFiles(members: Member[], files: string[]): void {
  const byDepth = [...members].sort((a, b) => b.dir.length - a.dir.length);
  for (const f of files) {
    const owner = byDepth.find((m) => f === m.dir || f.startsWith(`${m.dir}/`));
    if (owner) owner.files.push(f);
  }
  for (const m of members) m.files.sort();
}

// ── Execution ─────────────────────────────────────────────────────────────────
type Status = "PASS" | "FAIL" | "NO-TESTS" | "SKIP" | "PREP-FAIL";
interface Result {
  member: Member;
  status: Status;
  tests: number;
  durationMs: number;
  note?: string;
}

const safeName = (name: string) => name.replace(/[@/]/g, "_").replace(/^_+/, "");

async function runCmd(cmd: string[], cwd: string, env: Record<string, string>): Promise<number> {
  const proc = Bun.spawn(cmd, {
    cwd,
    env: { ...process.env, ...env },
    stdout: "inherit",
    stderr: "inherit",
  });
  return await proc.exited;
}

async function runScope(m: Member): Promise<Result> {
  const t0 = Bun.nanoseconds();
  const env: Record<string, string> = {
    NODE_ENV: "test",
    FORCE_COLOR: "1",
    ...(m.policy.env ?? {}),
  };

  for (const cmd of m.policy.prep ?? []) {
    if ((await runCmd(cmd, m.dir, env)) !== 0) {
      return {
        member: m,
        status: "PREP-FAIL",
        tests: m.files.length,
        durationMs: (Bun.nanoseconds() - t0) / 1e6,
        note: `prep failed: ${cmd.join(" ")}`,
      };
    }
  }

  const extra: string[] = [];
  for (const p of m.policy.preload ?? []) extra.push("--preload", p);
  if (m.policy.timeoutMs) extra.push("--timeout", String(m.policy.timeoutMs));
  if (BAIL) extra.push("--bail");
  if (COVERAGE)
    extra.push(
      "--coverage",
      "--coverage-reporter=lcov",
      `--coverage-dir=${join(ROOT, "coverage", safeName(m.name))}`,
    );
  if (JUNIT)
    extra.push(
      "--reporter=junit",
      "--reporter-outfile",
      join(ROOT, "test-results", `${safeName(m.name)}.xml`),
    );
  extra.push(...PASSTHROUGH);

  let failed = false;
  if (m.policy.perFile) {
    for (const f of m.files) {
      if ((await runCmd(["bun", "test", f, ...extra], m.dir, env)) !== 0) failed = true;
    }
  } else {
    // Explicit absolute paths => Bun treats them as paths, not name-filters, and
    // never re-discovers artifact copies under .next/dist.
    if ((await runCmd(["bun", "test", ...m.files, ...extra], m.dir, env)) !== 0) failed = true;
  }
  return {
    member: m,
    status: failed ? "FAIL" : "PASS",
    tests: m.files.length,
    durationMs: (Bun.nanoseconds() - t0) / 1e6,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────
const members = await discoverMembers();
assignFiles(members, await discoverTestFiles());
const selected = members.filter(
  (m) => !FILTER || m.name.includes(FILTER) || m.rel.includes(FILTER),
);

console.log(
  `\x1b[1mtest-all\x1b[0m — ${selected.length}/${members.length} scopes selected` +
    (FILTER ? ` (filter: ${FILTER})` : ""),
);
console.log(
  `tiers: unit=on  live=${RUN_LIVE ? "on" : "off"}  vendored=${RUN_VENDORED ? "on" : "off"}  strict=${STRICT ? "on" : "off"}  coverage=${COVERAGE ? "on" : "off"}\n`,
);

const results: Result[] = [];
for (const m of selected) {
  const mode = m.policy.mode ?? "unit";
  if (mode === "skip") {
    results.push({
      member: m,
      status: "SKIP",
      tests: m.files.length,
      durationMs: 0,
      note: m.policy.reason ?? "policy: skip",
    });
    continue;
  }
  if (mode === "live" && !RUN_LIVE) {
    results.push({
      member: m,
      status: "SKIP",
      tests: m.files.length,
      durationMs: 0,
      note: m.policy.reason ?? "live tier (use --live)",
    });
    continue;
  }
  if (mode === "vendored" && !RUN_VENDORED) {
    results.push({
      member: m,
      status: "SKIP",
      tests: m.files.length,
      durationMs: 0,
      note: m.policy.reason ?? "vendored (use --vendored)",
    });
    continue;
  }
  if (m.files.length === 0) {
    results.push({
      member: m,
      status: "NO-TESTS",
      tests: 0,
      durationMs: 0,
      note: "scope has zero test files",
    });
    continue;
  }
  console.log(`\x1b[36m▶ ${m.name}\x1b[0m (${m.rel}) — ${m.files.length} file(s)`);
  results.push(await runScope(m));
  console.log("");
}

// ── Report ────────────────────────────────────────────────────────────────────
const colour: Record<Status, string> = {
  PASS: "\x1b[32mPASS\x1b[0m",
  FAIL: "\x1b[31mFAIL\x1b[0m",
  "NO-TESTS": "\x1b[33mNO-TESTS\x1b[0m",
  SKIP: "\x1b[90mSKIP\x1b[0m",
  "PREP-FAIL": "\x1b[31mPREP-FAIL\x1b[0m",
};
const pad = (s: string, n: number) => s + " ".repeat(Math.max(0, n - s.length));
const nameW = Math.max(...results.map((r) => r.member.name.length), 12);

console.log("\x1b[1m── scope matrix ───────────────────────────────────────────────\x1b[0m");
for (const r of results) {
  const dur = r.durationMs ? `${(r.durationMs / 1000).toFixed(2)}s` : "";
  console.log(
    `  ${colour[r.status]}  ${pad(r.member.name, nameW)}  ${pad(String(r.tests) + "f", 5)} ${pad(dur, 8)} ${r.note ?? ""}`,
  );
}

const pass = results.filter((r) => r.status === "PASS");
const fail = results.filter((r) => r.status === "FAIL" || r.status === "PREP-FAIL");
const gaps = results.filter((r) => r.status === "NO-TESTS");
const skipped = results.filter((r) => r.status === "SKIP");
const totalFiles = results.reduce(
  (n, r) => n + (r.status === "PASS" || r.status === "FAIL" ? r.tests : 0),
  0,
);

console.log("\x1b[1m───────────────────────────────────────────────────────────────\x1b[0m");
console.log(
  `scopes: ${selected.length}  |  \x1b[32m${pass.length} pass\x1b[0m  \x1b[31m${fail.length} fail\x1b[0m  ` +
    `\x1b[33m${gaps.length} no-tests\x1b[0m  \x1b[90m${skipped.length} skip\x1b[0m  |  ${totalFiles} test files run`,
);
if (gaps.length) console.log(`gaps (no tests): ${gaps.map((g) => g.member.name).join(", ")}`);

if (JSON_OUT) {
  console.log(
    JSON.stringify(
      {
        scopes: results.map((r) => ({
          name: r.member.name,
          rel: r.member.rel,
          status: r.status,
          tests: r.tests,
          ms: Math.round(r.durationMs),
          note: r.note,
        })),
      },
      null,
      2,
    ),
  );
}

const failed = fail.length > 0 || (STRICT && gaps.length > 0);
if (STRICT && gaps.length)
  console.log("\x1b[31m✗ strict mode: zero-test scopes are failures\x1b[0m");
process.exit(failed ? 1 : 0);
