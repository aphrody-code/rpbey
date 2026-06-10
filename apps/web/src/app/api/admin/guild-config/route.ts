import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import {
  getBotConfig,
  updateBotConfigSection,
  BOT_CONFIG_SECTIONS,
  type BotConfigSection,
} from "@/server/dal/bot-config";

const GUILD_ID = process.env.GUILD_ID ?? process.env.DISCORD_GUILD_ID ?? "";

export async function GET() {
  if (!(await requireAdmin())) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (!GUILD_ID) {
    return NextResponse.json({ error: "GUILD_ID not configured" }, { status: 500 });
  }
  try {
    const config = await getBotConfig(GUILD_ID);
    return NextResponse.json(config);
  } catch (err) {
    console.error("[guild-config] GET error", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin())) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (!GUILD_ID) {
    return NextResponse.json({ error: "GUILD_ID not configured" }, { status: 500 });
  }

  let body: { section: string; data: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { section, data } = body;

  if (!BOT_CONFIG_SECTIONS.includes(section as BotConfigSection)) {
    return NextResponse.json({ error: `Unknown section: ${section}` }, { status: 400 });
  }

  let row: unknown;
  try {
    row = await updateBotConfigSection(GUILD_ID, section as BotConfigSection, data);
  } catch (err) {
    console.error("[guild-config] PATCH DB error", err);
    return NextResponse.json(
      { error: "Validation or DB error", detail: String(err) },
      { status: 400 },
    );
  }

  // Invalidation Redis — gracieuse (n'echoue pas la sauvegarde si Redis down)
  try {
    const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
    const r = new Bun.RedisClient(redisUrl);
    await r.publish("rpb:events:config", JSON.stringify({ type: "invalidate", guildId: GUILD_ID }));
    r.close();
  } catch (redisErr) {
    console.warn("[guild-config] Redis publish failed (non-fatal):", redisErr);
  }

  return NextResponse.json(row);
}
