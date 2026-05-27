import { type NextRequest, NextResponse } from "next/server";
import { db, schema, eq } from "@/lib/db";

export async function POST(req: NextRequest) {
	if (process.env.NODE_ENV === "production") {
		return NextResponse.json(
			{ error: "Not allowed in production" },
			{ status: 403 },
		);
	}

	const { email } = await req.json();

	const user = await db.query.users.findFirst({
		where: eq(schema.users.email, email),
	});

	if (!user) {
		return NextResponse.json({ error: "User not found" }, { status: 404 });
	}

	// Set session using Better Auth API
	// We need to construct a headers object that Next.js can return
	// Better Auth's `api.signIn` might work if we can bypass password,
	// but strictly speaking `createSession` is what we want.

	// const session = await auth.api.createSession({
	//   headers: req.headers,
	//   body: {
	//     userId: user.id,
	//   },
	// });

	// if (!session) {
	//   return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
	// }

	return NextResponse.json(
		{ error: "dev-login not implemented for this auth version" },
		{ status: 501 },
	);
	// return NextResponse.json({ success: true, user });
}
