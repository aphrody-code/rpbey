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

  let dirContents: any = {};
  try {
    dirContents.cwd = await readdir(cwd);
  } catch (e: any) {
    dirContents.cwd_error = e.message;
  }

  try {
    dirContents.data = await readdir(join(cwd, "data"));
  } catch (e: any) {
    dirContents.data_error = e.message;
  }

  try {
    dirContents.data_exports = await readdir(join(cwd, "data", "exports"));
  } catch (e: any) {
    dirContents.data_exports_error = e.message;
  }

  return NextResponse.json({
    cwd,
    results,
    dirContents,
  });
}
