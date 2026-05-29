import { ChannelType, EmbedBuilder } from "discord.js";

import { bot } from "../../lib/bot.js";
import { getTemplate } from "../../lib/cms.js";
import { Colors, RPB } from "../../lib/constants.js";
import { logger } from "../../lib/logger.js";
import prisma from "../../lib/prisma.js";

/**
 * Discord channel where tournament reminders are posted.
 * Priority: env var TOURNAMENT_REMINDER_CHANNEL_ID → constants.Channels.Tournaments.
 */
function getReminderChannelId(): string {
  return process.env.TOURNAMENT_REMINDER_CHANNEL_ID ?? RPB.Channels.Tournaments;
}

export async function tournamentReminderTask() {
  logger.info("[Cron] Running tournament reminder check...");

  try {
    const tomorrow = new Date();
    tomorrow.setHours(tomorrow.getHours() + 24);

    const [upcomingTournaments, template] = await Promise.all([
      prisma.tournament.findMany({
        where: {
          date: {
            gte: new Date(),
            lte: tomorrow,
          },
          status: {
            in: ["REGISTRATION_OPEN", "REGISTRATION_CLOSED", "UPCOMING"],
          },
        },
        include: {
          participants: {
            include: {
              user: true,
            },
          },
        },
      }),
      getTemplate(
        "bot-reminder-template",
        `Le tournoi commence dans **{hours} heure(s)** !\n\n` +
          `📅 **Date:** {date}\n` +
          `📍 **Lieu:** {location}\n` +
          `👥 **Participants:** {participants}`,
      ),
    ]);

    const guildId = process.env.GUILD_ID;
    const channelId = getReminderChannelId();

    // Resolve announce channel once — reused for all reminders this tick
    let channel: import("discord.js").TextChannel | null = null;
    if (guildId && channelId) {
      try {
        const guild = bot.guilds.cache.get(guildId);
        if (guild) {
          const ch = guild.channels.cache.get(channelId);
          if (ch && ch.type === ChannelType.GuildText) {
            channel = ch as import("discord.js").TextChannel;
          }
        }
      } catch (err) {
        logger.warn("[Cron] Could not resolve reminder channel:", err);
      }
    }

    if (!channel) {
      logger.warn(
        `[Cron] Tournament reminder channel not found (id=${channelId}). Skipping sends.`,
      );
    }

    for (const tournament of upcomingTournaments) {
      const tournamentDate = new Date(tournament.date);
      const hoursUntil = Math.round((tournamentDate.getTime() - Date.now()) / (1000 * 60 * 60));

      if (hoursUntil === 24 || hoursUntil === 6 || hoursUntil === 1) {
        const description = template
          .replace("{hours}", String(hoursUntil))
          .replace("{name}", tournament.name)
          .replace("{date}", tournamentDate.toLocaleString("fr-FR"))
          .replace("{location}", tournament.location ?? "En ligne")
          .replace("{participants}", String(tournament.participants.length));

        const embed = new EmbedBuilder()
          .setTitle(`⏰ Rappel Tournoi - ${tournament.name}`)
          .setDescription(description)
          .setColor(hoursUntil <= 1 ? Colors.Error : Colors.Warning)
          .setFooter({ text: `${RPB.FullName} | N'oublie pas ton check-in !` })
          .setTimestamp();

        if (channel) {
          try {
            await channel.send({ embeds: [embed] });
            logger.info(
              `[Cron] Sent reminder for ${tournament.name} (${hoursUntil}h) → #${channel.name}`,
            );
          } catch (err) {
            logger.error(`[Cron] Failed to send reminder for ${tournament.name}:`, err);
          }
        } else {
          logger.info(
            `[Cron] Reminder ready for ${tournament.name} (${hoursUntil}h) — no channel configured`,
          );
        }
      }
    }
  } catch (error) {
    logger.error("[Cron] Tournament reminder error:", error);
  }
}
