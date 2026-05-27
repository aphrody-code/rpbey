import { connection, NextResponse } from 'next/server';
import { getDiscordStats } from '@/lib/discord-data';

export async function GET() {
  await connection();
  const stats = await getDiscordStats();
  return NextResponse.json(stats);
}
