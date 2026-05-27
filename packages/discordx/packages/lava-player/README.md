# @rpbey/lava-player

> Lavalink REST + WebSocket client for Node/Bun.

```bash
bun add @rpbey/lava-player
```

## Usage

```ts
import { Node } from "@rpbey/lava-player";

const node = new Node({
  host: "127.0.0.1",
  port: 2333,
  password: "youshallnotpass",
  userId: "<bot-id>",
});

await node.connect();
const result = await node.load("ytsearch:never gonna give you up");
```

## Features

- **Fetch-based REST** — no `axios`/`undici`, uses global `fetch`
- **Native WebSocket** — Bun's built-in `WebSocket`, no `ws` package
- **Cluster** — multi-node load-balancing
- Compatible with Lavalink v4

## License

Apache-2.0
