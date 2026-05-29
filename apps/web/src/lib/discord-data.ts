import { BOT_API_KEY, getBotApiUrl } from "@/lib/bot-config";
import { type DiscordStats, type TeamGroup } from "@/lib/discord-types";

/**
 * Façade Discord — la lecture DB (équipe staff) vit désormais dans la DAL
 * (`server/dal/tournaments.ts`), seul importeur `@rpbey/db` du domaine. Ce module
 * reste le point d'entrée historique : `getDiscordTeam` est ré-exporté d'ici, et
 * `getDiscordStats` (purement HTTP, sans DB) reste local.
 */

export { type DiscordStats, type TeamGroup };
export { getDiscordTeam } from "@/server/dal/tournaments";

export async function getDiscordStats(): Promise<DiscordStats> {
  const fallbackName = "République Populaire du Beyblade";

  try {
    // Fetch from bot API + Discord invite API in parallel
    const [botRes, inviteRes] = await Promise.all([
      fetch(`${getBotApiUrl()}/api/status`, {
        headers: { "x-api-key": BOT_API_KEY },
        next: { revalidate: 60 },
      }).catch(() => null),
      fetch("https://discord.com/api/v9/invites/rpb?with_counts=true", {
        next: { revalidate: 60 },
      }).catch(() => null),
    ]);

    const botData = botRes?.ok ? await botRes.json() : null;
    const inviteData = inviteRes?.ok ? await inviteRes.json() : null;

    return {
      serverName: inviteData?.guild?.name || fallbackName,
      memberCount: botData?.memberCount || inviteData?.approximate_member_count || 0,
      onlineCount: inviteData?.approximate_presence_count || botData?.onlineCount || 0,
    };
  } catch (error) {
    console.error("Failed to fetch Discord stats:", error);
  }

  return { onlineCount: 0, memberCount: 0, serverName: fallbackName };
}
