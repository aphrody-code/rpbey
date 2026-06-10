import { NextResponse } from "next/server";

import { convertChallongeToBrackets } from "@/server/actions/brackets";

interface RouteParams {
  params: Promise<{ idOrSlug: string }>;
}

export async function GET(_req: Request, { params }: RouteParams): Promise<Response> {
  const { idOrSlug } = await params;
  const result = await convertChallongeToBrackets(idOrSlug);

  if (!result.success) {
    return NextResponse.json(result, { status: 502 });
  }

  return NextResponse.json(result.data, {
    headers: {
      "x-challonge-source": result.source.url,
      "x-challonge-fetched-at": result.fetchedAt,
      "cache-control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
