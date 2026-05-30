import { Discord, Slash, SlashOption } from "@rpbey/discordx";
import { ApplicationCommandOptionType, EmbedBuilder, type CommandInteraction } from "discord.js";
import { injectable } from "tsyringe";

import { Colors } from "../../lib/constants.js";
import { logger } from "../../lib/logger.js";
import { compose } from "../../lib/rpbey/answer.js";
import { line, speak } from "../../lib/rpbey/persona.js";

/**
 * `/rpbey <question>` — interroge **Rpbey**, l'Empereur omniscient du Beyblade
 * (voix Ryuga). Réponse 100 % algorithmique : retrieval hybride sur le corpus
 * consolidé (wiki toutes saisons, méta, combos, tournois, produits, discussions)
 * + synthèse extractive + voix de l'Empereur. Aucun LLM.
 */
@Discord()
@injectable()
export class RpbeyCommand {
  @Slash({
    name: "rpbey",
    description: "Demande à Rpbey, l'Empereur omniscient du Beyblade (toutes saisons)",
  })
  async rpbey(
    @SlashOption({
      name: "question",
      description: "Ta question Beyblade (toupie, combo, méta, perso, règle, prix…)",
      required: true,
      type: ApplicationCommandOptionType.String,
      minLength: 2,
      maxLength: 400,
    })
    question: string,
    interaction: CommandInteraction,
  ) {
    await interaction.deferReply();
    const userId = interaction.user.id;
    try {
      const ans = await compose(question);
      if (ans.intent === "greeting") return interaction.editReply(await line("greeting", userId));
      if (ans.intent === "thanks") return interaction.editReply(await line("thanks", userId));
      if (!ans.found || !ans.bodyMd) {
        return interaction.editReply(await line("notFound", userId, question));
      }
      const embed = new EmbedBuilder()
        .setColor(Colors.Primary)
        .setAuthor({ name: "Rpbey — l'Empereur du Beyblade" })
        .setDescription(await speak(ans.bodyMd, userId))
        .setFooter({
          text: "Savoir consolidé : wiki · méta · combos · tournois · discussions · rpbey.fr",
        });
      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      logger.error("[rpbey] erreur:", err);
      return interaction.editReply(await line("error", userId));
    }
  }
}
