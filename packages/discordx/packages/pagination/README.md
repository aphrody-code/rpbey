# @rpbey/pagination

> Button + select-menu pagination for Discord embeds.

```bash
bun add @rpbey/pagination
```

## Usage

```ts
import { Pagination, PaginationType } from "@rpbey/pagination";
import { EmbedBuilder } from "discord.js";

const pages = [
  { embeds: [new EmbedBuilder().setTitle("Page 1")] },
  { embeds: [new EmbedBuilder().setTitle("Page 2")] },
  { embeds: [new EmbedBuilder().setTitle("Page 3")] },
];

const pagination = new Pagination(interaction, pages, {
  type: PaginationType.Button,
  enableExit: true,
  time: 60_000,
});

await pagination.send();
```

## Options

- `type` — `Button` (prev/next/forward/backward/exit) or `SelectMenu`
- `time` — collector timeout in ms
- `enableExit`, `onTimeout`, `onPaginate` callbacks
- Custom labels via `previous`, `next`, `forward`, `backward`, `exit`

## License

Apache-2.0
