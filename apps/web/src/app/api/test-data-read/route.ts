import { NextResponse } from "next/server";
import { join } from "node:path";
import { readdir, stat } from "node:fs/promises";

export const dynamic = "force-dynamic";

export async function GET() {
  const cwd = process.cwd();
  const normalized = "data/exports/B_TS1.json";

  const candidates = [
    { name: "CWD/data/...", path: join(cwd, normalized) },
    { name: "CWD/public/data/...", path: join(cwd, "public", normalized) },
    { name: "CWD/apps/web/data/...", path: join(cwd, "apps", "web", normalized) },
    { name: "CWD/../data/...", path: join(cwd, "..", normalized) },
    { name: "CWD/../../data/...", path: join(cwd, "..", "..", normalized) },
  ];

  const results: any[] = [];
  for (const c of candidates) {
    try {
      const stats = await stat(c.path);
      results.push({ name: c.name, path: c.path, exists: true, size: stats.size });
    } catch (e: any) {
      results.push({ name: c.name, path: c.path, exists: false, error: e.message });
    }
  }

  // Also inspect directory contents of CWD and potential parent directories to see where we are
  let dirContents: any = {};
  try {
    dirContents.cwd = await readdir(cwd);
  } catch (e: any) {
    dirContents.cwd_error = e.message;
  }

  try {
    dirContents.cwd_parent = await readdir(join(cwd, ".."));
  } catch (e: any) {
    dirContents.cwd_parent_error = e.message;
  }

  return NextResponse.json({
    cwd,
    results,
    dirContents,
  });
}
