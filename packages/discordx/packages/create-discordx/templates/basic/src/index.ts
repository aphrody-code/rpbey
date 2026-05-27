import "reflect-metadata";
import { Client } from "@rpbey/discordx";
import { Events, IntentsBitField } from "discord.js";

import "./commands/ping.js";
import "./events/ready.js";

const client = new Client({
  intents: [IntentsBitField.Flags.Guilds, IntentsBitField.Flags.GuildMessages],
  silent: false,
});

client.once(Events.ClientReady, async () => {
  await client.initApplicationCommands();
  console.log(`✓ Logged in as ${client.user?.tag}`);
});

client.on(Events.InteractionCreate, (interaction) => {
  client.executeInteraction(interaction);
});

const token = Bun.env.DISCORD_TOKEN;
if (!token) {
  console.error("✗ DISCORD_TOKEN is required (see .env.example)");
  process.exit(1);
}

await client.login(token);
