# @rpbey/di

> Dependency-injection bridge for **discordy**. Adapters for `tsyringe` and `typedi`.

```bash
bun add @rpbey/di tsyringe reflect-metadata
```

## Usage

```ts
import "reflect-metadata";
import { container } from "tsyringe";
import { tsyringeDependencyRegistryEngine } from "@rpbey/di";
import { DIService } from "@rpbey/discordx";

DIService.engine = tsyringeDependencyRegistryEngine.setInjector(container);
```

Once registered, every class decorated with `@Discord` is resolved through the container:

```ts
import { injectable } from "tsyringe";
import { Discord, Slash } from "@rpbey/discordx";

@Discord()
@injectable()
class Commands {
  constructor(private readonly db: DatabaseService) {}

  @Slash({ name: "stats" })
  async stats(i: CommandInteraction) {
    const count = await this.db.userCount();
    await i.reply(`Users: ${count}`);
  }
}
```

## Exports

- `tsyringeDependencyRegistryEngine`
- `typeDiDependencyRegistryEngine`
- `DependencyRegistryEngine` (base class)

## License

Apache-2.0
