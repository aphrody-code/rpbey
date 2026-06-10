import { NextResponse } from "next/server";
import { getBotStatus } from "@/lib/bot";

export async function GET() {
  const status = await getBotStatus();
  if (!status) {
    return NextResponse.json({ status: "offline", error: "Bot unreachable" }, { status: 503 });
  }
  return NextResponse.json(status);
}
