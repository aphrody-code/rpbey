import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDiscordAvatarSource, setUserAvatar } from "@/server/dal/users";
import { storeRemoteImage, UploadValidationError } from "@/server/services/upload-store";

/**
 * Synchronise l'avatar Discord de l'utilisateur connecté : lit l'URL Discord
 * (posée au login par `mapProfileToUser`), la re-héberge sur le CDN (fetch →
 * sharp → WebP) et la pose comme avatar de profil (`users.image`).
 */
export async function POST() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const source = await getDiscordAvatarSource(session.user.id);
    const discordUrl = source?.image;

    if (!discordUrl || !/(^https?:)?\/\/cdn\.discordapp\.com\//.test(discordUrl)) {
      return NextResponse.json(
        { error: "Aucun avatar Discord trouvé. Connecte-toi via Discord d'abord." },
        { status: 404 },
      );
    }

    const url = await storeRemoteImage("avatars", session.user.id, discordUrl);
    await setUserAvatar(session.user.id, url);

    return NextResponse.json({ url });
  } catch (error) {
    if (error instanceof UploadValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Discord avatar sync error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Sync failed: ${errorMessage}` }, { status: 500 });
  }
}
