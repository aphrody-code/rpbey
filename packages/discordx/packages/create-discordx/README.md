# @rpbey/create-discordx

> CLI to scaffold a new **discordy** bot — Bun-first, TypeScript, decorators.

```bash
bunx @rpbey/create-discordx my-bot
```

> Requires the `@rpbey` scope to resolve from GitHub Packages. Add to your `.npmrc`:
>
> ```
> @rpbey:registry=https://npm.pkg.github.com
> //npm.pkg.github.com/:_authToken=${GH_TOKEN}
> ```

## What it does

Generates a ready-to-run bot directory:

```
my-bot/
├── src/
│   ├── index.ts          # client + login
│   ├── commands/
│   │   └── ping.ts       # @Slash example
│   └── events/
│       └── ready.ts      # @Once('ready')
├── .env.example
├── tsconfig.json         # experimentalDecorators + emitDecoratorMetadata
├── package.json          # @rpbey/discordx + discord.js + reflect-metadata
└── README.md
```

## Flags

```
--template <name>        Choose a template (default: basic)
--with-di                Include @rpbey/di + tsyringe
--with-music             Include @rpbey/music
--with-lava              Include @rpbey/plugin-lava-player
--with-ytdl              Include @rpbey/plugin-ytdl-player
--with-pagination        Include @rpbey/pagination + example
--with-importer          Include @rpbey/importer
--install | --no-install Run bun install (default: interactive prompt)
--git | --no-git         Init git repo (default: on)
```

## Interactive mode

Running without a name prompts for template and package manager:

```bash
bunx @rpbey/create-discordx
```

## Requirements

- Bun ≥ 1.2
- A GitHub PAT with `read:packages` scope (free for public packages) in `GH_TOKEN` env var

## License

Apache-2.0
