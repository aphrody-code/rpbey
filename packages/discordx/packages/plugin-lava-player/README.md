# @rpbey/plugin-lava-player

> Ready-to-use Lavalink music plugin for **discordy**. Drop-in slash commands + GUI.

```bash
bun add @rpbey/plugin-lava-player @rpbey/discordx
```

## What you get

13 slash commands, auto-registered when imported: `play`, `queue`, `skip`, `seek`, `pause-resume`, `shuffle`, `stop`, `current`, `gui`, `set-volume`, `music`, plus a `ready` event hook.

## Wiring

```ts
import "@rpbey/plugin-lava-player/commands#all";
// or cherry-pick:
import "@rpbey/plugin-lava-player/commands#play";
import "@rpbey/plugin-lava-player/commands#skip";
import "@rpbey/plugin-lava-player/events#ready";
```

## Sub-paths

- `./commands#all | #current | #gui | #music | #pause-resume | #play | #queue | #seek | #set-volume | #shuffle | #skip | #stop`
- `./core` — raw `QueueManager` access
- `./events#ready`
- `./lavalyrics` — Lavalink `lavalyrics` plugin integration

## Requirements

- Lavalink v4 server
- `@rpbey/discordx` in the consumer

## License

Apache-2.0
