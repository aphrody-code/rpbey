import { NextResponse } from "next/server";
import { pingDatabase } from "@/server/dal/infra";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const checks: Record<string, "ok" | "error"> = {};

  checks.db = (await pingDatabase()) ? "ok" : "error";

  const allOk = Object.values(checks).every((v) => v === "ok");

  return NextResponse.json(
    { status: allOk ? "ok" : "degraded", checks, uptime: process.uptime() },
    { status: allOk ? 200 : 503 },
  );
}
