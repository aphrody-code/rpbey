import { type ArgsOf, Discord, On } from "@rpbey/discordx";
import { ChannelType, EmbedBuilder } from "discord.js";

import { Colors } from "../lib/constants.js";
import { logger } from "../lib/logger.js";
import { redis } from "../lib/redis.js";
import { compose } from "../lib/rpbey/answer.js";
import { cleanQuestion } from "../lib/rpbey/nlp.js";
import { line, speak } from "../lib/rpbey/persona.js";

/**
 * Réponse en langage naturel de **Rpbey** (voix Ryuga) quand on le mentionne
 * (`@bot question…`) ou en DM. 100 % algorithmique : `compose()` (retrieval hybride
 * sur le corpus consolidé) + `speak()` (voix de l'Empereur). Anti-spam best-effort
 * (1 réponse / 6 s / utilisateur, verrou Redis NX). Coexiste avec `MessageLogger`
 * (discordx déclenche tous les handlers `messageCreate`).
 */
@Discord()
export class RpbeyMention {
  @On({ event: "messageCreate" })
  async onMention([message]: ArgsOf<"messageCreate">) {
    if (message.author.bot || !message.content) return;

    const botId = message.client.user?.id;
    const isDM = message.channel.type === ChannelType.DM;
    const isMention = botId ? message.mentions.has(botId) && !message.mentions.everyone : false;
    if (!isDM && !isMention) return;

    const userId = message.author.id;

    // Anti-spam : un verrou NX EX 6 s par utilisateur (best-effort, ignore si Redis absent).
    try {
      const lock = await redis.send("SET", [`rpb:rpbey:rl:${userId}`, "1", "NX", "EX", "6"]);
      if (lock == null) return; // déjà répondu très récemment → on n'enchaîne pas
    } catch {
      /* best-effort */
    }

    try {
      const question = cleanQuestion(message.content);
      if (question.length < 3) {
        await message.reply(await line("greeting", userId));
        return;
      }

      if ("sendTyping" in message.channel) {
        await message.channel.sendTyping().catch(() => {});
      }

      const ans = await compose(question);
      if (ans.intent === "greeting") {
        await message.reply(await line("greeting", userId));
        return;
      }
      if (ans.intent === "thanks") {
        await message.reply(await line("thanks", userId));
        return;
      }
      if (!ans.found || !ans.bodyMd) {
        await message.reply(await line("notFound", userId, question));
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(Colors.Primary)
        .setAuthor({ name: "Rpbey — l'Empereur du Beyblade" })
        .setDescription(await speak(ans.bodyMd, userId));
      await message.reply({ embeds: [embed] });
    } catch (err) {
      logger.error("[rpbey:mention] erreur:", err);
    }
  }
}
