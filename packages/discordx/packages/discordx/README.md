# @rpbey/discordx

> Core of **discordy** — TypeScript-decorator framework for `discord.js` 14.26+.

```bash
bun add discord.js reflect-metadata @rpbey/discordx
```

## What it does

Wraps `discord.js` in a decorator-driven API: `@Discord`, `@Slash`, `@SlashGroup`, `@SlashOption`, `@SlashChoice`, `@ButtonComponent`, `@ModalComponent`, `@SelectMenuComponent`, `@ContextMenu`, `@On`, `@Once`, `@Reaction`, `@Guard`, `@SimpleCommand`.

Extends `discord.js`'s `Client` with `initApplicationCommands()`, `clearApplicationCommands()`, and an interaction router that dispatches to the right method based on metadata collected at import-time.

## Minimal bot

```ts
import "reflect-metadata";
import { Client, Discord, Slash } from "@rpbey/discordx";
import { IntentsBitField, MessageFlags } from "discord.js";
import type { CommandInteraction } from "discord.js";

@Discord()
class Ping {
  @Slash({ name: "ping", description: "Ping" })
  async run(i: CommandInteraction) {
    await i.reply({ content: "🏓", flags: MessageFlags.Ephemeral });
  }
}

const client = new Client({
  intents: [IntentsBitField.Flags.Guilds],
  silent: false,
});

client.once("ready", () => client.initApplicationCommands());
await client.login(process.env.DISCORD_TOKEN!);
```

## Requirements

- `tsconfig`: `experimentalDecorators: true`, `emitDecoratorMetadata: true`
- `reflect-metadata` imported **before** any decorator-containing module
- `discord.js` ≥ 14.26 (uses `flags: MessageFlags.Ephemeral`)

## License

Apache-2.0
