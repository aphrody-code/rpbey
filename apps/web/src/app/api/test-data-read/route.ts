import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    message: "Test data read endpoint is disabled in production.",
  });
}
