import { connection, NextResponse } from "next/server";
import { db, schema, count, eq } from "@/lib/db";

type PartType = (typeof schema.partType.enumValues)[number];

async function getRandomPart(type: PartType) {
  const [countRow] = await db
    .select({ value: count() })
    .from(schema.parts)
    .where(eq(schema.parts.type, type));
  const total = countRow?.value ?? 0;
  if (total === 0) return null;
  const skip = Math.floor(Math.random() * total);
  return await db.query.parts.findFirst({
    where: eq(schema.parts.type, type),
    offset: skip,
  });
}

export async function GET() {
  await connection();
  try {
    const [randomBlade, randomRatchet, randomBit] = await Promise.all([
      getRandomPart("BLADE"),
      getRandomPart("RATCHET"),
      getRandomPart("BIT"),
    ]);

    if (!randomBlade || !randomRatchet || !randomBit) {
      return NextResponse.json({ error: "Not enough parts found" }, { status: 404 });
    }

    return NextResponse.json({
      blade: randomBlade,
      ratchet: randomRatchet,
      bit: randomBit,
    });
  } catch (error) {
    console.error("Failed to fetch random parts:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
