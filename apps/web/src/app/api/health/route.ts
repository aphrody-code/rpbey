import { NextResponse } from "next/server";
import { pingDatabase } from "@/server/dal/infra";

export async function GET() {
  const checks: Record<string, "ok" | "error"> = {};

  checks.db = (await pingDatabase()) ? "ok" : "error";

  const allOk = Object.values(checks).every((v) => v === "ok");

  return NextResponse.json(
    { status: allOk ? "ok" : "degraded", checks, uptime: process.uptime() },
    { status: allOk ? 200 : 503 },
  );
}
