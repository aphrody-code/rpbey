# @rpbey/music

> Low-level voice-channel music playback over `worker_threads` + YTDL.

```bash
bun add @rpbey/music discord.js
```

## Architecture

Audio playback runs in a `worker_threads` worker. The main thread talks to the worker via typed messages (`WorkerOperation` / `ParentProcessEvent`) — no shared memory.

```ts
import { Node, QueueEvent } from "@rpbey/music";
import { Client } from "discord.js";

const client = new Client({ /* ... */ });
const node = new Node(client);

node.on(QueueEvent.TrackEnd, ({ guildId, track }) => {
  console.log(`Finished ${track.title} in ${guildId}`);
});
```

## Why a worker?

Audio decode (opus, ffmpeg) blocks the event loop. Isolating it keeps gateway heartbeats healthy under heavy multi-guild playback.

## Higher-level option

Most apps want [`@rpbey/plugin-ytdl-player`](../plugin-ytdl-player) instead — it builds ready-to-use slash commands on top of this.

## License

Apache-2.0
