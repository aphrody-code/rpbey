# @rpbey/lava-queue

> Queue system on top of `@rpbey/lava-player`.

```bash
bun add @rpbey/lava-queue @rpbey/lava-player
```

## Usage

```ts
import { QueueManager } from "@rpbey/lava-queue";
import { Node } from "@rpbey/lava-player";

const node = new Node({ /* ... */ });
const manager = new QueueManager(node);

const queue = manager.queue(guildId);
queue.add(track);
await queue.playNext();
```

## Features

- Per-guild queue with shuffle, loop (track/queue), seek
- Volume control, pause/resume
- Track history

## Higher-level option

[`@rpbey/plugin-lava-player`](../plugin-lava-player) exposes these as ready-made slash commands.

## License

Apache-2.0
