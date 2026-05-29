/**
 * GET /api/gacha/drops
 * List all gacha drops with card counts
 */
import { NextResponse } from "next/server";
import { listGachaDrops } from "@/server/dal/gacha";
import { serverError } from "../helpers";

export async function GET() {
  try {
    const drops = await listGachaDrops();
    return NextResponse.json({ success: true, drops });
  } catch (error) {
    return serverError(error);
  }
}
