import { Discord, Slash } from "@rpbey/discordx";
import { EmbedBuilder, type CommandInteraction } from "discord.js";
import { inject, injectable } from "tsyringe";

import { cached, TTL } from "../../lib/cache.js";
import { Colors, RPB } from "../../lib/constants.js";
import { PrismaService } from "../../lib/prisma.js";

interface SiteStats {
  bladers: number;
  profiles: number;
  tournaments: number;
  tournamentParticipants: number;
  duelMatches: number;
  gachaCards: number;
  beyblades: number;
}

@Discord()
@injectable()
export class StatsSiteCommand {
  constructor(@inject(PrismaService) private prisma: PrismaService) {}

  @Slash({
    name: "stats-site",
    description: "Statistiques publiques de la communauté RPB",
  })
  async statsSite(interaction: CommandInteraction) {
    await interaction.deferReply();

    try {
      const stats = await cached<SiteStats>("stats-site:global", TTL.SHORT, async () => {
        const [
          bladers,
          profiles,
          tournaments,
          tournamentParticipants,
          duelMatches,
          gachaCards,
          beyblades,
        ] = await Promise.all([
          this.prisma.user.count(),
          this.prisma.profile.count(),
          this.prisma.tournament.count(),
          this.prisma.tournamentParticipant.count(),
          this.prisma.duelMatch.count(),
          this.prisma.gachaCard.count(),
          this.prisma.beyblade.count(),
        ]);
        return {
          bladers,
          profiles,
          tournaments,
          tournamentParticipants,
          duelMatches,
          gachaCards,
          beyblades,
        };
      });

      const embed = new EmbedBuilder()
        .setColor(Colors.Primary)
        .setTitle("Statistiques RPB")
        .setURL("https://rpbey.fr")
        .setDescription("Chiffres de la communauté République Populaire du Beyblade.")
        .addFields(
          {
            name: "Bladers inscrits",
            value: stats.bladers.toLocaleString("fr-FR"),
            inline: true,
          },
          {
            name: "Profils publics",
            value: stats.profiles.toLocaleString("fr-FR"),
            inline: true,
          },
          {
            name: "Tournois",
            value: stats.tournaments.toLocaleString("fr-FR"),
            inline: true,
          },
          {
            name: "Participations",
            value: stats.tournamentParticipants.toLocaleString("fr-FR"),
            inline: true,
          },
          {
            name: "Duels enregistrés",
            value: stats.duelMatches.toLocaleString("fr-FR"),
            inline: true,
          },
          {
            name: "Cartes gacha",
            value: stats.gachaCards.toLocaleString("fr-FR"),
            inline: true,
          },
          {
            name: "Beyblades cataloguées",
            value: stats.beyblades.toLocaleString("fr-FR"),
            inline: true,
          },
        )
        .setFooter({ text: `${RPB.FullName} · mise à jour toutes les 60 s` })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(Colors.Error)
            .setTitle("Erreur")
            .setDescription(
              "Impossible de charger les statistiques. Réessayez dans quelques instants.",
            ),
        ],
      });
    }
  }
}
