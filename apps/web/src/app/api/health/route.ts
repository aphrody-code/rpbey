import { db, sql } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
	const checks: Record<string, "ok" | "error"> = {};

	try {
		await db.execute(sql`SELECT 1`);
		checks.db = "ok";
	} catch {
		checks.db = "error";
	}

	const allOk = Object.values(checks).every((v) => v === "ok");

	return NextResponse.json(
		{ status: allOk ? "ok" : "degraded", checks, uptime: process.uptime() },
		{ status: allOk ? 200 : 503 },
	);
}
