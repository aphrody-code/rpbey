import { Client } from "@rpbey/discordx";

// Guilds où enregistrer les slash commands : prod (GUILD_ID) + test (TEST_GUILD_ID).
const botGuilds = [process.env.GUILD_ID, process.env.TEST_GUILD_ID].filter((id): id is string =>
  Boolean(id),
);

export const bot = new Client({
  botId: "rpb-bot",
  intents: [
    "Guilds",
    "GuildMembers",
    "GuildMessages",
    "MessageContent",
    "GuildModeration",
    "GuildPresences",
    "GuildVoiceStates",
  ],
  botGuilds: botGuilds.length > 0 ? botGuilds : undefined,
  silent: false,
  simpleCommand: {
    prefix: "!",
  },
});
