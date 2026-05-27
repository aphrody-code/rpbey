<div align="center">
  <h1>discordy</h1>
  <p><b>Bun-first fork of <a href="https://github.com/discordx-ts/discordx">discordx</a> — TypeScript-decorator framework for discord.js.</b></p>
  <p>
    <img src="https://img.shields.io/badge/runtime-bun%20%E2%89%A5%201.2-orange" alt="Bun" />
    <img src="https://img.shields.io/badge/discord.js-14.26+-5865F2" alt="discord.js" />
    <img src="https://img.shields.io/badge/license-Apache--2.0-blue" alt="License" />
  </p>
</div>

---

## Why this fork?

[`discordx`](https://github.com/discordx-ts/discordx) is an excellent decorator-based wrapper around `discord.js`. **`discordy` takes the same surface and rebuilds it for Bun-first monorepos.**

Differences from upstream:

- **Bun-native replacements** — `Bun.Glob` (no `glob` package), `Bun.color` (no `chalk`), `Bun.spawnSync` (no execa), global `fetch` (no `axios`/`undici` for http).
- **No legacy runtime deps** — lodash / backoff / chalk / rimraf / ws / node-fetch all dropped.
- **`engines.bun >= 1.2`** — no Node.js fallback for the `importer` package (use your own module discovery with `Bun.Glob` if needed).
- **discord.js 14.26+** — all `ephemeral: true` deprecations migrated to `flags: MessageFlags.Ephemeral`.
- **Scope `@rpbey/*`** — published under the rpbey npm scope, consumed via workspace-link in the [vps monorepo](https://github.com/rpbey/vps).

Tracks upstream `discordx-ts/discordx` for core feature parity; rebrand + Bun work is the only intentional divergence.

## Packages

| Package | Version | Role |
|---|---|---|
| [`@rpbey/discordx`](./packages/discordx) | 0.1.0 | Core framework — decorators, client, interaction router |
| [`@rpbey/di`](./packages/di) | 0.1.0 | DI service (tsyringe / typedi adapters) |
| [`@rpbey/internal`](./packages/internal) | 0.1.0 | Shared internal types & `MetadataStorage` (consumed by core) |
| [`@rpbey/importer`](./packages/importer) | 0.1.0 | Module auto-loader — `Bun.Glob` + `import()` (Bun only) |
| [`@rpbey/utilities`](./packages/utilities) | 0.1.0 | Guards (rate-limit, permission), category/description decorators |
| [`@rpbey/pagination`](./packages/pagination) | 0.1.0 | Button + select-menu pagination for embeds |
| [`@rpbey/music`](./packages/music) | 0.1.0 | Low-level YTDL player over `worker_threads` |
| [`@rpbey/lava-player`](./packages/lava-player) | 0.1.0 | Lavalink REST+WS client (fetch-based) |
| [`@rpbey/lava-queue`](./packages/lava-queue) | 0.1.0 | Queue manager for `lava-player` |
| [`@rpbey/plugin-lava-player`](./packages/plugin-lava-player) | 0.1.0 | Ready-to-use Lavalink music plugin (13 slash commands) |
| [`@rpbey/plugin-ytdl-player`](./packages/plugin-ytdl-player) | 0.1.0 | Ready-to-use YTDL music plugin (14 slash commands, Spotify resolver) |
| [`create-discordx`](./packages/create-discordx) | 0.1.0 | CLI to scaffold a Bun-first `discordy` bot |

## Package graph

```
internal ─┐
di ───────┼──► discordx ──► utilities ─┐
          │                            ├──► plugin-lava-player
importer ─┘                            │    (lava-player + lava-queue + pagination)
                                       │
music ─────────► pagination ───────────┴──► plugin-ytdl-player
                                            (music + importer + pagination)
```

## Quickstart

```bash
bun create discordx my-bot
cd my-bot
bun install
bun run dev
```

Or, inside an existing Bun project:

```bash
bun add discord.js reflect-metadata @rpbey/discordx @rpbey/di
```

```ts
// src/index.ts
import "reflect-metadata";
import { Client } from "@rpbey/discordx";
import { IntentsBitField } from "discord.js";

const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
  ],
  silent: false,
});

client.once("ready", async () => {
  await client.initApplicationCommands();
  console.log(`Logged in as ${client.user?.tag}`);
});

await import("./commands/ping.js");
await client.login(process.env.DISCORD_TOKEN!);
```

```ts
// src/commands/ping.ts
import { Discord, Slash } from "@rpbey/discordx";
import type { CommandInteraction } from "discord.js";
import { MessageFlags } from "discord.js";

@Discord()
export class Ping {
  @Slash({ description: "Ping", name: "ping" })
  async ping(interaction: CommandInteraction) {
    await interaction.reply({ content: "🏓 Pong", flags: MessageFlags.Ephemeral });
  }
}
```

Requires `tsconfig.json`:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

## Decorator cheat-sheet

Core decorators exported from `@rpbey/discordx`:

| Decorator | Use |
|---|---|
| `@Discord()` | Mark a class as a container of handlers |
| `@Slash(options)` | Slash command |
| `@SlashGroup(options)` | Command group / subcommand parent |
| `@SlashOption(options)` | Command option (with `autocomplete:` callback) |
| `@SlashChoice(...)` | Static choice list for options |
| `@ContextMenu(options)` | User / Message context menu |
| `@ButtonComponent(id)` | Button handler (supports regex id) |
| `@ModalComponent(id)` | Modal submit handler |
| `@SelectMenuComponent(id)` | Select menu handler (any component type) |
| `@On(event)` / `@Once(event)` | Gateway event listener |
| `@Reaction(options)` | Reaction role helper |
| `@Guard(...guards)` | Middleware chain on class or method |
| `@SimpleCommand(...)` | Prefix-command (legacy) |

## Compatibility

- **Bun** ≥ 1.2.0 (`@rpbey/importer` is Bun-only; everything else runs on Node 20+ too, untested)
- **discord.js** ≥ 14.26.0 (`MessageFlags.Ephemeral` required)
- **TypeScript** ≥ 5.5 with `experimentalDecorators: true` (legacy stage-2 decorators — **not** TC39 stage 3)
- **`reflect-metadata`** required in consumer when using `@rpbey/di` with tsyringe

## Development

```bash
bun install
bun run build          # turbo build (tsup + tsc)
bun test               # bun:test across packages
```

The plugin packages (`plugin-lava-player`, `plugin-ytdl-player`) use `bunx tsc` instead of `tsup` to preserve a directory-tree `dist/` matching their granular `exports` map.

## License

Apache-2.0 — original work © Vijay Meena (upstream discordx), fork maintained by rpbey.

See [LICENSE.txt](./LICENSE.txt).

## Links

- Upstream: [discordx-ts/discordx](https://github.com/discordx-ts/discordx)
- This fork: [rpbey/discordy](https://github.com/rpbey/discordy)
- discord.js: [discord.js.org](https://discord.js.org)
