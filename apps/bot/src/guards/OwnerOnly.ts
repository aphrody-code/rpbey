import { type GuardFunction } from "@rpbey/discordx";
import { MessageFlags, type CommandInteraction } from "discord.js";
import { container } from "tsyringe";

import { ConfigService } from "../lib/config-service.js";

export const OwnerOnly: GuardFunction<CommandInteraction> = async (interaction, _client, next) => {
  // Priorité : ConfigService (DB ownerIds) → fallback env OWNER_IDS
  let owners: string[] = [];
  try {
    const svc = container.resolve(ConfigService);
    owners = await svc.getOwnerIds(interaction.guildId ?? "");
  } catch {
    owners = process.env.OWNER_IDS?.split(",").filter(Boolean) ?? [];
  }

  if (owners.includes(interaction.user.id)) {
    await next();
  } else {
    await interaction.reply({
      content: "❌ Cette commande est réservée aux propriétaires du bot.",
      flags: MessageFlags.Ephemeral,
    });
  }
};
