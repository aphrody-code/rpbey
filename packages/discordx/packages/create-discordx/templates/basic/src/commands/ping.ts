import { Discord, Slash } from "@rpbey/discordx";
import { MessageFlags, type CommandInteraction } from "discord.js";

@Discord()
export class Ping {
  @Slash({ name: "ping", description: "Reply with Pong" })
  async run(interaction: CommandInteraction) {
    await interaction.reply({
      content: `🏓 Pong — ${interaction.client.ws.ping}ms`,
      flags: MessageFlags.Ephemeral,
    });
  }
}
