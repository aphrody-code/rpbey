import { ApplicationCommandOptionType, MessageFlags, PermissionFlagsBits, type CommandInteraction } from "discord.js";
import { Discord, Slash, SlashChoice, SlashGroup, SlashOption } from '@rpbey/discordx';
import { inject, injectable } from 'tsyringe';
import { syncRankingRolesTask } from '../../cron/tasks/SyncRankingRoles.js';
import { publishBtsRanking } from '../../lib/classement-publisher.js';
import { logger } from '../../lib/logger.js';
import { PrismaService } from '../../lib/prisma.js';

@Discord()
@SlashGroup({
  name: 'admin',
  description: "Commandes d'administration du bot",
  defaultMemberPermissions: PermissionFlagsBits.Administrator,
})
@SlashGroup('admin')
@injectable()
export class AdminGroup {
  constructor(@inject(PrismaService) private prisma: PrismaService) {}

  @Slash({
    name: 'synchroniser-roles',
    description: 'Synchronise les rôles de paliers de points',
  })
  async syncRoles(interaction: CommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      await syncRankingRolesTask();
      return interaction.editReply(
        '✅ Synchronisation des rôles de points terminée.',
      );
    } catch (error) {
      logger.error(error);
      return interaction.editReply(
        `❌ Erreur lors de la synchronisation des rôles : \`${error instanceof Error ? error.message : 'Erreur inconnue'}\``,
      );
    }
  }

  @Slash({
    name: 'publier-classement',
    description: 'Publie le canvas BTS top 10 dans #classement avec ping @Tournois',
  })
  async publishClassement(
    @SlashChoice({ name: 'Saison 2 (BTS 2 -> 5)', value: 2 })
    @SlashChoice({ name: 'Saison 1 (BTS 1)', value: 1 })
    @SlashOption({
      name: 'saison',
      description: 'Saison BTS a publier (default 2)',
      type: ApplicationCommandOptionType.Integer,
      required: false,
    })
    season: 1 | 2 | undefined,
    @SlashOption({
      name: 'silencieux',
      description: 'Sans ping @Tournois',
      type: ApplicationCommandOptionType.Boolean,
      required: false,
    })
    silent: boolean | undefined,
    interaction: CommandInteraction,
  ) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const r = await publishBtsRanking({
        season: season ?? 2,
        silent: silent ?? false,
        purgePrevious: true,
      });
      if (!r.ok) {
        return interaction.editReply(
          `Echec publication classement: \`${r.error ?? 'unknown'}\``,
        );
      }
      return interaction.editReply(
        `Classement BTS S${season ?? 2} publie dans <#${r.channelId}> (${r.rendered}/${r.total} bladers) — message ${r.messageId}`,
      );
    } catch (error) {
      logger.error(error);
      return interaction.editReply(
        `Erreur publication classement: \`${error instanceof Error ? error.message : 'inconnue'}\``,
      );
    }
  }

  @Slash({
    name: 'classement-raz',
    description: 'RAZ complet des points de classement',
  })
  async resetRanking(interaction: CommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const result = await this.prisma.profile.updateMany({
        data: { rankingPoints: 0 },
      });
      return interaction.editReply(
        `✅ Classement réinitialisé — **${result.count}** profils remis à 0.`,
      );
    } catch (error) {
      logger.error(error);
      return interaction.editReply(
        `❌ Erreur lors de la réinitialisation : \`${error instanceof Error ? error.message : 'Erreur inconnue'}\``,
      );
    }
  }
}
