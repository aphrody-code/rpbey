import { NextResponse } from "next/server";

import { mock, type MockKey } from "@/lib/brackets";

export const dynamic = "force-static";
export const revalidate = false;

const KNOWN_KEYS: ReadonlySet<MockKey> = new Set([
	"roundRobin",
	"singleElimination",
	"doubleElimination",
]);

interface RouteParams {
	params: Promise<{ key: string }>;
}

export async function GET(
	_req: Request,
	{ params }: RouteParams,
): Promise<Response> {
	const { key } = await params;

	if (!KNOWN_KEYS.has(key as MockKey)) {
		return NextResponse.json(
			{ error: `unknown brackets key '${key}'`, known: [...KNOWN_KEYS] },
			{ status: 404 },
		);
	}

	return NextResponse.json(mock[key as MockKey], {
		headers: {
			"cache-control":
				"public, max-age=0, s-maxage=300, stale-while-revalidate=86400",
		},
	});
}
