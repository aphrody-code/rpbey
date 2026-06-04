import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { getBotApiUrl, BOT_API_KEY } from "@/lib/bot-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Redémarre le conteneur Discord bot en prod (Cloud Run) via son API HTTP.
 * Réservé aux admins (better-auth + rôle).
 */
export async function POST() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const botUrl = getBotApiUrl();
  try {
    const res = await fetch(`${botUrl}/api/admin/restart`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": BOT_API_KEY,
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        {
          success: false,
          message: `Erreur API bot (${res.status}): ${errText}`,
        },
        { status: 500 },
      );
    }

    const data = (await res.json()) as { success: boolean; message: string };
    return NextResponse.json({
      success: true,
      message: data.message || "Redémarrage du bot demandé.",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        success: false,
        message: `Impossible de contacter l'API du bot : ${msg}`,
      },
      { status: 500 },
    );
  }
}
