import { Discord, Slash, SlashGroup, SlashOption } from "@rpbey/discordx";
import { ApplicationCommandOptionType, EmbedBuilder, type CommandInteraction } from "discord.js";
import { injectable } from "tsyringe";

import { existsSync } from "node:fs";
import { Store, BeybladeXRag } from "@aphrody/x";

import { Colors } from "../../lib/constants.js";
import { logger } from "../../lib/logger.js";

const RAG_TIMEOUT_MS = 30_000;

@Discord()
@SlashGroup({ name: "metagame", description: "Analyse métagame via les discussions X.com RPB" })
@SlashGroup("metagame")
@injectable()
export class MetagameCommand {
  @Slash({
    name: "ask",
    description: "Pose une question sur le métagame Beyblade X (analyse RAG des discussions X.com)",
  })
  @SlashGroup("metagame")
  async ask(
    @SlashOption({
      name: "question",
      description: "Ta question sur le métagame (ex: quel est le meilleur blade en attaque ?)",
      required: true,
      type: ApplicationCommandOptionType.String,
      minLength: 5,
      maxLength: 300,
    })
    question: string,
    interaction: CommandInteraction,
  ) {
    await interaction.deferReply();

    // Check if the SQLite store exists
    const storePath = Store.defaultPath();
    if (!existsSync(storePath)) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(Colors.Warning)
            .setTitle("Analyse métagame indisponible")
            .setDescription(
              "Le moteur RAG métagame n'est pas disponible sur ce serveur.\n\n" +
                "Consultez les discussions sur [X.com](https://x.com/rpb_ey) ou " +
                "[rpbey.fr/meta](https://rpbey.fr/meta) pour les dernières analyses.",
            ),
        ],
      });
    }

    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
      if (!apiKey) {
        throw new Error("Missing GEMINI_API_KEY / GOOGLE_API_KEY");
      }

      // Run RAG query directly in-process
      const store = new Store();
      const rag = new BeybladeXRag({
        apiKey,
        model: "gemini-2.5-flash",
      });

      // Use a race to enforce the 30s timeout on the API query
      const result = await Promise.race([
        rag.query(question, store),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), RAG_TIMEOUT_MS),
        ),
      ]);

      store.close();

      const answer = result.answer;
      const sources = result.sources;

      if (!answer) {
        return interaction.editReply({ embeds: [buildFallbackEmbed(question)] });
      }

      const trimmedAnswer = answer.length > 3800 ? answer.slice(0, 3800) + "…" : answer;

      const embed = new EmbedBuilder()
        .setColor(Colors.Beyblade)
        .setTitle("Analyse métagame")
        .setDescription(trimmedAnswer)
        .setFooter({
          text: "Basé sur les discussions X.com de la communauté RPB · Analyse IA Gemini",
        })
        .setTimestamp();

      if (sources.length > 0) {
        const sourceLines = sources
          .slice(0, 3)
          .map(
            (s) =>
              `@${s.author_username} (Likes: ${s.like_count}): "${s.text.replace(/\n/g, " ").slice(0, 80)}..."`,
          )
          .join("\n");

        embed.addFields({
          name: `Sources (${sources.length})`,
          value: sourceLines.length > 1024 ? sourceLines.slice(0, 1021) + "…" : sourceLines,
        });
      }

      return interaction.editReply({ embeds: [embed] });
    } catch (err: unknown) {
      const isTimeout = err instanceof Error && err.message === "timeout";
      logger.error("[metagame] RAG error:", err);

      if (isTimeout) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(Colors.Warning)
              .setTitle("Analyse métagame indisponible")
              .setDescription(
                "L'analyse prend trop de temps (>30 s). Réessayez dans quelques minutes.",
              ),
          ],
        });
      }
      return interaction.editReply({ embeds: [buildFallbackEmbed(question)] });
    }
  }
}

function buildFallbackEmbed(question: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(Colors.Warning)
    .setTitle("Analyse métagame indisponible")
    .setDescription(
      `Impossible d'analyser « ${question} » pour le moment.\n\n` +
        "Consultez la tier-list sur [rpbey.fr/meta](https://rpbey.fr/meta) " +
        "ou posez la question sur le serveur Discord.",
    );
}
