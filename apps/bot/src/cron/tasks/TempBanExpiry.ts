import { bot } from "../../lib/bot.js";
import { logger } from "../../lib/logger.js";
import prisma from "../../lib/prisma.js";

/**
 * Vérifie toutes les 5 minutes les bans temporaires arrivés à expiration
 * et débannit les membres correspondants via l'API Discord.
 *
 * Pattern : on sélectionne les entrées où `expiresAt <= now` et `unbannedAt IS NULL`.
 * Après débannissement on marque `unbannedAt` pour idempotence.
 */
export async function tempBanExpiryTask(): Promise<void> {
  const now = new Date().toISOString();

  let expired: {
    id: string;
    guildId: string;
    discordId: string;
    discordTag: string;
    reason: string;
    expiresAt: string;
  }[] = [];

  try {
    expired = await prisma.tempBan.findMany({
      where: {
        expiresAt: { lte: now },
        unbannedAt: null,
      },
      take: 50, // cap par cycle pour éviter un flood Discord
    });
  } catch (err) {
    logger.error("[TempBanExpiry] DB query failed:", err);
    return;
  }

  if (expired.length === 0) return;

  logger.info(`[TempBanExpiry] ${expired.length} ban(s) à lever.`);

  for (const ban of expired) {
    const guild = bot.guilds.cache.get(ban.guildId);
    if (!guild) {
      // Guild indisponible (shard / déconnexion) — on ne marque pas unbannedAt
      // pour réessayer au prochain cycle.
      logger.warn(`[TempBanExpiry] Guild ${ban.guildId} introuvable en cache, skip.`);
      continue;
    }

    try {
      // Vérifier que le membre est toujours banni avant de tenter le débannissement
      const banEntry = await guild.bans.fetch(ban.discordId).catch(() => null);
      if (banEntry) {
        await guild.members.unban(
          ban.discordId,
          `[TempBan expiré] ${ban.reason} — levé automatiquement`,
        );
        logger.info(
          `[TempBanExpiry] ${ban.discordTag} (${ban.discordId}) débanni de ${guild.name}.`,
        );
      } else {
        logger.info(
          `[TempBanExpiry] ${ban.discordTag} n'était plus banni sur ${guild.name}, marquage unbannedAt.`,
        );
      }

      // Marquer l'entrée comme traitée (idempotence)
      await prisma.tempBan.update({
        where: { id: ban.id },
        data: { unbannedAt: new Date().toISOString() },
      });
    } catch (err) {
      logger.error(
        `[TempBanExpiry] Echec débannissement ${ban.discordTag} (${ban.discordId}):`,
        err,
      );
      // On ne marque pas unbannedAt : sera retenté au prochain cycle.
    }
  }
}
