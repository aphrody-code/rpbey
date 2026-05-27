# {{PROJECT_NAME}}

Built with [discordy](https://github.com/rpbey/discordy) — Bun-first TypeScript-decorator framework for `discord.js`.

## Setup

```bash
cp .env.example .env
# edit .env, set DISCORD_TOKEN
bun install
bun run dev
```

## Structure

```
src/
├── index.ts            # Client bootstrap + login
├── commands/
│   └── ping.ts         # @Slash /ping
└── events/
    └── ready.ts        # @Once('ready')
```

## Next steps

- Add more `@Slash` commands under `src/commands/`
- Register them by importing the file from `src/index.ts`
- Or use [`@rpbey/importer`](https://github.com/rpbey/discordy/tree/main/packages/importer) to auto-load everything

## Docs

- [discordy](https://github.com/rpbey/discordy)
- [discord.js](https://discord.js.org)
