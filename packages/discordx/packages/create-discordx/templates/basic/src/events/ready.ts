import { Discord, Once } from "@rpbey/discordx";
import { Events, type Client } from "discord.js";

@Discord()
export class ReadyEvent {
  @Once({ event: Events.ClientReady })
  ready([client]: [Client]) {
    console.log(
      `✓ Ready (${client.guilds.cache.size} guild${client.guilds.cache.size === 1 ? "" : "s"})`,
    );
  }
}
