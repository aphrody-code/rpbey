import { bot } from "../../lib/bot.js";
import { logger } from "../../lib/logger.js";
import prisma from "../../lib/prisma.js";
import { syncRolesByThreshold } from "../../lib/role-sync.js";

interface PointRole {
  points: number;
  id: string;
}

const POINT_ROLES: PointRole[] = [
  { points: 40000, id: "1332498533504520224" },
  { points: 30000, id: "1332498472817131530" },
  { points: 20000, id: "1332498407457161236" },
  { points: 15000, id: "1332498580665143306" },
  { points: 10000, id: "1332498339744321536" },
  { points: 1000, id: "1332498240712736851" },
];

export async function syncRankingRolesTask() {
  logger.info("[Cron] Starting ranking roles synchronization...");

  const guildId = process.env.GUILD_ID;
  if (!guildId) return;

  try {
    const guild = await bot.guilds.fetch(guildId);
    if (!guild) return;

    // Pre-load all profiles with their discordId — keyed by discordId for O(1) lookup
    const profiles = await prisma.profile.findMany({
      where: { rankingPoints: { gte: 1000 } },
      include: { user: { select: { discordId: true } } },
    });

    const pointsByDiscordId = new Map<string, number>();
    for (const profile of profiles) {
      if (profile.user.discordId) {
        pointsByDiscordId.set(profile.user.discordId, profile.rankingPoints);
      }
    }

    logger.info(`[Cron] Syncing roles for ${pointsByDiscordId.size} bladers...`);

    await syncRolesByThreshold<{ points: number }>(guild, {
      taskName: "SyncRankingRoles",
      roles: POINT_ROLES,
      shouldHaveRole: (member, roleDef) => {
        const pts = pointsByDiscordId.get(member.user.id) ?? 0;
        return pts >= roleDef.points;
      },
    });

    logger.info("[Cron] Ranking roles synchronization complete.");
  } catch (error) {
    logger.error("[Cron] Global error in syncRankingRolesTask:", error);
  }
}
