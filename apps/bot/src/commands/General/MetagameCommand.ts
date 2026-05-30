import { Discord, Slash, SlashGroup, SlashOption } from "@rpbey/discordx";
import { ApplicationCommandOptionType, EmbedBuilder, type CommandInteraction } from "discord.js";
import { injectable } from "tsyringe";

import { Colors } from "../../lib/constants.js";
import { logger } from "../../lib/logger.js";

const RAG_SCRIPT = "/home/ubuntu/aphrody/packages/x/src/bin/run-rag.ts";
const RAG_CWD = "/home/ubuntu/aphrody/packages/x";
const RAG_TIMEOUT_MS = 30_000;

// Parse the human-readable stdout of run-rag.ts
// Output format:
//   \n🔍 Querying RAG System for: "..."\n
//   \n=================== RAG ANSWER ===================\n
//   <answer lines>
//   \n==================================================\n
//   \n📚 Cited Sources (N total):\n
//   - [@username] (Likes: N): "text..."
function parseRagOutput(stdout: string): { answer: string; sources: string[] } {
  const answerMatch = stdout.match(/={10,}\s*RAG ANSWER\s*={10,}\n([\s\S]*?)\n={10,}/);
  const answer = answerMatch?.[1]?.trim() ?? "";

  const sources: string[] = [];
  const sourceSection = stdout.split("📚 Cited Sources")[1] ?? "";
  for (const line of sourceSection.split("\n")) {
    const m = line.match(/^-\s*\[@([^\]]+)\].*?"(.{1,80})"/);
    if (m) sources.push(`@${m[1]}: "${m[2]}"`);
  }
  return { answer, sources };
}

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

    // Graceful fallback if the RAG environment is missing
    const scriptFile = Bun.file(RAG_SCRIPT);
    if (!(await scriptFile.exists())) {
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
      const proc = Bun.spawn(["bun", "run", RAG_SCRIPT, "--query", question], {
        cwd: RAG_CWD,
        stdout: "pipe",
        stderr: "pipe",
      });

      // Race between process completion and timeout
      const exitCode = await Promise.race([
        proc.exited,
        new Promise<number>((_, reject) =>
          setTimeout(() => {
            proc.kill();
            reject(new Error("timeout"));
          }, RAG_TIMEOUT_MS),
        ),
      ]);

      if (exitCode !== 0) {
        const stderr = await new Response(proc.stderr).text().catch(() => "");
        logger.warn("[metagame] RAG exit code:", exitCode, stderr.slice(0, 200));
        return interaction.editReply({ embeds: [buildFallbackEmbed(question)] });
      }

      const stdout = await new Response(proc.stdout).text().catch(() => "");
      const { answer, sources } = parseRagOutput(stdout);

      if (!answer) {
        return interaction.editReply({ embeds: [buildFallbackEmbed(question)] });
      }

      // Trim answer to Discord embed description limit (4096 chars)
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
        const sourceLines = sources.slice(0, 3).join("\n");
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
