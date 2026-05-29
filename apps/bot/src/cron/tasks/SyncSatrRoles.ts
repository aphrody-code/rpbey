import { bot } from "../../lib/bot.js";
import { logger } from "../../lib/logger.js";
import prisma from "../../lib/prisma.js";
import { syncRolesByThreshold } from "../../lib/role-sync.js";

// ID du rôle "Top 10 SATR" sur le Discord
const SATR_TOP_10_ROLE_ID = "1472023878858440847";

export async function syncSatrRolesTask() {
  logger.info("[Cron] Synchronisation des rôles SATR...");

  const guildId = process.env.GUILD_ID;
  if (!guildId) return;

  try {
    const guild = await bot.guilds.fetch(guildId);
    if (!guild) return;

    // 1. Récupérer le Top 10 actuel de la Saison 2
    // ⚠️ Filtrer par season sinon rank=1 collisionne entre S1 et S2.
    const top10 = await prisma.satrRanking.findMany({
      where: { season: 2 },
      orderBy: { rank: "asc" },
      take: 10,
    });

    // Build a Set of normalised player names for O(1) membership test
    const top10Names = new Set(
      top10.map((r: { playerName: string }) => r.playerName.toLowerCase()),
    );

    logger.info(`[Cron] Mise à jour du rôle Top 10 pour ${top10Names.size} joueurs.`);

    await syncRolesByThreshold<{ id: string }>(guild, {
      taskName: "SyncSatrRoles",
      roles: [{ id: SATR_TOP_10_ROLE_ID }],
      shouldHaveRole: (member) => {
        const username = member.user.username.toLowerCase();
        const display = member.displayName.toLowerCase();
        const nick = member.nickname?.toLowerCase() ?? "";
        return (
          top10Names.has(username) ||
          top10Names.has(display) ||
          (nick !== "" && top10Names.has(nick))
        );
      },
    });

    logger.info("[Cron] Synchronisation des rôles SATR terminée.");
  } catch (error) {
    logger.error("[Cron] Erreur syncSatrRolesTask:", error);
  }
}
