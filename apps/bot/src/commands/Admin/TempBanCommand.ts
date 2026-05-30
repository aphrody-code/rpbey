import { Discord, Slash, SlashChoice, SlashOption } from "@rpbey/discordx";
import {
  ApplicationCommandOptionType,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  type CommandInteraction,
  type GuildMember,
  type User,
} from "discord.js";
import { inject, injectable } from "tsyringe";

import { Colors } from "../../lib/constants.js";
import { logger } from "../../lib/logger.js";
import { PrismaService } from "../../lib/prisma.js";

// Durées en millisecondes (mirroir du pattern mute)
const DURATION_MS: Record<string, number> = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7j": 7 * 24 * 60 * 60 * 1000,
  "30j": 30 * 24 * 60 * 60 * 1000,
};

function durationLabel(key: string): string {
  const labels: Record<string, string> = {
    "1h": "1 heure",
    "24h": "24 heures",
    "7j": "7 jours",
    "30j": "30 jours",
  };
  return labels[key] ?? key;
}

@Discord()
@injectable()
export class TempBanCommand {
  constructor(@inject(PrismaService) private prisma: PrismaService) {}

  @Slash({
    name: "tempban",
    description: "Bannir temporairement un membre (débannissement automatique à l'échéance)",
    defaultMemberPermissions: PermissionFlagsBits.BanMembers,
  })
  async tempban(
    @SlashOption({
      name: "cible",
      description: "Le membre à bannir temporairement",
      required: true,
      type: ApplicationCommandOptionType.User,
    })
    target: User,
    @SlashChoice({ name: "1 heure", value: "1h" })
    @SlashChoice({ name: "24 heures", value: "24h" })
    @SlashChoice({ name: "7 jours", value: "7j" })
    @SlashChoice({ name: "30 jours", value: "30j" })
    @SlashOption({
      name: "duree",
      description: "Durée du bannissement",
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    durationKey: string,
    @SlashOption({
      name: "raison",
      description: "Raison du bannissement temporaire",
      required: false,
      type: ApplicationCommandOptionType.String,
    })
    reason: string = "Aucune raison spécifiée",
    interaction: CommandInteraction,
  ) {
    const guild = interaction.guild;
    if (!guild) {
      return interaction.reply({
        content: "Commande serveur uniquement.",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (target.id === interaction.user.id) {
      return interaction.reply({
        content: "Tu ne peux pas te bannir toi-même.",
        flags: MessageFlags.Ephemeral,
      });
    }
    if (target.bot) {
      return interaction.reply({
        content: "Impossible de bannir un bot via cette commande.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const durationMs = DURATION_MS[durationKey];
    if (!durationMs) {
      return interaction.reply({
        content: "Durée invalide.",
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply();

    try {
      const member = await guild.members.fetch(target.id).catch(() => null);
      if (member && !member.bannable) {
        return interaction.editReply(
          "Impossible de bannir ce membre (rôle trop élevé ou permissions insuffisantes).",
        );
      }

      const expiresAt = new Date(Date.now() + durationMs).toISOString();
      const label = durationLabel(durationKey);

      // 1. Enregistrer en DB avant le ban (si le ban échoue on a quand même la trace)
      await this.prisma.tempBan.create({
        data: {
          guildId: guild.id,
          discordId: target.id,
          discordTag: target.tag,
          moderatorId: interaction.user.id,
          reason,
          expiresAt,
        },
      });

      // 2. Bannir via l'API Discord
      await guild.members.ban(target, {
        reason: `[TempBan ${label}] ${reason} — par ${interaction.user.tag}`,
      });

      const tsExpiry = Math.floor(new Date(expiresAt).getTime() / 1000);

      const embed = new EmbedBuilder()
        .setColor(Colors.Error)
        .setTitle("Bannissement temporaire")
        .addFields(
          { name: "Membre", value: `${target.tag} (${target.id})`, inline: true },
          { name: "Durée", value: label, inline: true },
          { name: "Expire", value: `<t:${tsExpiry}:R>`, inline: true },
          { name: "Raison", value: reason },
          { name: "Modérateur", value: `<@${interaction.user.id}>`, inline: true },
        )
        .setTimestamp();

      logger.info(
        `[tempban] ${target.tag} (${target.id}) banni pour ${label} par ${interaction.user.tag}`,
      );

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      logger.error("[tempban] Erreur:", err);
      return interaction.editReply(
        "Une erreur s'est produite lors du bannissement. Vérifiez les permissions du bot.",
      );
    }
  }
}
