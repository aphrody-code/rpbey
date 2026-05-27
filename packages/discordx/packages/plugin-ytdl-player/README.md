# @rpbey/plugin-ytdl-player

> Ready-to-use YTDL music plugin for **discordy**. No Lavalink required.

```bash
bun add @rpbey/plugin-ytdl-player @rpbey/discordx
```

## What you get

14 slash commands, auto-registered when imported: `play`, `queue`, `skip`, `seek`, `pause-resume`, `shuffle`, `stop`, `current`, `gui`, `set-volume`, `music`, `playlist`, `spotify`, plus a `ready` event hook.

## Wiring

```ts
import "@rpbey/plugin-ytdl-player/commands#all";
```

## Sub-paths

- `./commands#all | #current | #gui | #music | #pause-resume | #play | #playlist | #queue | #seek | #set-volume | #shuffle | #skip | #spotify | #stop`
- `./core`, `./utils`, `./events#ready`, `./lavalyrics`

## Requirements

- Native deps: `@discordjs/voice`, `ffmpeg-static`, `libsodium-wrappers`
- Resolvers: `youtube-sr`, `spotify-url-info`
- `@rpbey/discordx` in the consumer

## When to use Lavalink instead

If you need multi-guild concurrent playback, consider [`@rpbey/plugin-lava-player`](../plugin-lava-player) — offloads audio to a dedicated Lavalink server.

## License

Apache-2.0
