/*
 * -------------------------------------------------------------------------------------------------------
 * Copyright (c) Vijay Meena <vijayymmeena@gmail.com> (https://github.com/vijayymmeena). All rights reserved.
 * Licensed under the Apache License. See License.txt in the project root for license information.
 * -------------------------------------------------------------------------------------------------------
 */
import {
  Node,
  type VoiceServerUpdate,
  type VoiceStateUpdate,
} from "@rpbey/lava-player";
import { GatewayDispatchEvents } from "discord.js";
import type { Client } from "@rpbey/discordx";

export function getNode(client: Client): Node {
  const nodeX = new Node({
    host: {
      address: Bun.env.LAVA_HOST ?? "localhost",
      connectionOptions: { sessionId: client.botId },
      port: Bun.env.LAVA_PORT ? Number(Bun.env.LAVA_PORT) : 2333,
    },

    // your Lavalink password
    password: Bun.env.LAVA_PASSWORD ?? "youshallnotpass",

    send(guildId, packet) {
      const guild = client.guilds.cache.get(guildId);
      if (guild) {
        guild.shard.send(packet);
      }
    },
    userId: client.user?.id ?? "", // the user id of your bot
  });

  client.ws.on(
    GatewayDispatchEvents.VoiceStateUpdate,
    (data: VoiceStateUpdate) => {
      void nodeX.voiceStateUpdate(data);
    },
  );

  client.ws.on(
    GatewayDispatchEvents.VoiceServerUpdate,
    (data: VoiceServerUpdate) => {
      void nodeX.voiceServerUpdate(data);
    },
  );

  return nodeX;
}
