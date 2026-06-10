import { connection, NextResponse } from "next/server";
import { getRandomPartByType } from "@/server/dal/parts";

export async function GET() {
  await connection();
  try {
    const [randomBlade, randomRatchet, randomBit] = await Promise.all([
      getRandomPartByType("BLADE"),
      getRandomPartByType("RATCHET"),
      getRandomPartByType("BIT"),
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
