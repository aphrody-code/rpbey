/*
 * -------------------------------------------------------------------------------------------------------
 * Copyright (c) Vijay Meena <vijayymmeena@gmail.com> (https://github.com/vijayymmeena). All rights reserved.
 * Licensed under the Apache License. See License.txt in the project root for license information.
 * -------------------------------------------------------------------------------------------------------
 */
import { dirname, importx } from "@rpbey/importer";
import { Events, IntentsBitField } from "discord.js";
import { Client } from "@rpbey/discordx";

// biome-ignore lint/complexity/noStaticOnlyClass: ignore
export class Main {
  private static client: Client;

  static async start(): Promise<void> {
    Main.client = new Client({
      // botGuilds: [(client) => client.guilds.cache.map((guild) => guild.id)],
      intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildMessageReactions,
        IntentsBitField.Flags.MessageContent,
      ],
      silent: false,
    });

    Main.Client.on(Events.ClientReady, () => {
      console.log("Bot started...");
    });

    await importx(`${dirname(import.meta.url)}/commands/**/*.{js,ts}`);

    // let's start the bot
    if (!Bun.env.BOT_TOKEN) {
      throw Error("Could not find BOT_TOKEN in your environment");
    }
    await Main.client.login(Bun.env.BOT_TOKEN);
  }
}

void Main.start();
