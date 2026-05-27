# @rpbey/importer

> Bun-native module auto-loader — scans globs, imports all matches.

> ⚠️ **Bun-only.** Uses `Bun.Glob` and `import.meta.dir`. Does not run on Node.

```bash
bun add @rpbey/importer
```

## Usage

```ts
import { importx, dirname } from "@rpbey/importer";

await importx(
  `${dirname(import.meta.url)}/{events,commands,components}/**/*.{ts,js}`,
);
```

Every matched file is dynamically `import()`-ed; side-effects (like `@Discord` class declarations) register themselves in `MetadataStorage`.

## Helpers

- `importx(pattern)` — scan + import all matches
- `dirname(urlOrPath)` — cross-ESM/CJS dir resolution
- `isESM()` — `true` under ESM, `false` under CJS

## Alternative

If you ship a standalone binary with `bun build --compile`, generate a static manifest at build time instead of scanning at runtime.

## License

Apache-2.0
