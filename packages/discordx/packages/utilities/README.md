# @rpbey/utilities

> Guards, decorators, and helpers for **discordy**.

```bash
bun add @rpbey/utilities
```

## What's inside

| Export | Use |
|---|---|
| `RateLimit(unit, value, opts?)` | Rate-limit a command, per user+guild |
| `PermissionGuard(permissions, opts?)` | Require Discord permissions |
| `IsGuildUser` | Deny DMs, require guild context |
| `Description(text)` | Attach human-readable description metadata |
| `Category(name)` | Group commands by category for help/doc pages |
| `TimedSet<T>` | Self-expiring Set (used by rate-limit) |

## Rate-limit example

```ts
import { RateLimit, TIME_UNIT } from "@rpbey/utilities";
import { Discord, Guard, Slash } from "@rpbey/discordx";

@Discord()
class Commands {
  @Slash({ name: "expensive" })
  @Guard(RateLimit(TIME_UNIT.seconds, 10))
  async run(i: CommandInteraction) {
    await i.reply("ok");
  }
}
```

## License

Apache-2.0
