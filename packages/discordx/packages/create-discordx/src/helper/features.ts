/*
 * Apply feature flags to a freshly copied template.
 * Each feature mutates package.json deps and optionally seeds an example file.
 */
import { promises as fs } from "node:fs";
import { join } from "node:path";

export type Feature =
  | "di"
  | "music"
  | "lava"
  | "ytdl"
  | "pagination"
  | "importer";

const DEPS: Record<Feature, Record<string, string>> = {
  di: {
    "@rpbey/di": "^0.1.0",
    tsyringe: "^4.10.0",
  },
  music: {
    "@rpbey/music": "^0.1.0",
    "@discordjs/voice": "^0.19.2",
  },
  lava: {
    "@rpbey/plugin-lava-player": "^0.1.0",
  },
  ytdl: {
    "@rpbey/plugin-ytdl-player": "^0.1.0",
    "@discordjs/voice": "^0.19.2",
    "ffmpeg-static": "^5.3.0",
    "libsodium-wrappers": "^0.8.3",
  },
  pagination: {
    "@rpbey/pagination": "^0.1.0",
  },
  importer: {
    "@rpbey/importer": "^0.1.0",
  },
};

async function readJson(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await fs.readFile(path, "utf8"));
}

async function writeJson(path: string, obj: unknown): Promise<void> {
  await fs.writeFile(path, `${JSON.stringify(obj, null, 2)}\n`, "utf8");
}

export async function ApplyFeatures(
  projectRoot: string,
  features: Feature[],
): Promise<void> {
  if (features.length === 0) return;

  const pkgPath = join(projectRoot, "package.json");
  const pkg = (await readJson(pkgPath)) as {
    dependencies?: Record<string, string>;
  };
  pkg.dependencies ??= {};

  for (const feat of features) {
    for (const [dep, ver] of Object.entries(DEPS[feat])) {
      pkg.dependencies[dep] = ver;
    }
  }

  await writeJson(pkgPath, pkg);

  if (features.includes("di")) {
    await seedDiExample(projectRoot);
  }
  if (features.includes("lava")) {
    await seedLavaHook(projectRoot);
  } else if (features.includes("ytdl")) {
    await seedYtdlHook(projectRoot);
  }
  if (features.includes("pagination")) {
    await seedPaginationExample(projectRoot);
  }
}

async function seedDiExample(root: string): Promise<void> {
  const path = join(root, "src", "index.ts");
  const content = await fs.readFile(path, "utf8");
  if (content.includes("tsyringeDependencyRegistryEngine")) return;
  const patched = content.replace(
    'import "reflect-metadata";\nimport { Client } from "@rpbey/discordx";',
    'import "reflect-metadata";\nimport { container } from "tsyringe";\nimport { Client, DIService } from "@rpbey/discordx";\nimport { tsyringeDependencyRegistryEngine } from "@rpbey/di";\n\nDIService.engine = tsyringeDependencyRegistryEngine.setInjector(container);',
  );
  await fs.writeFile(path, patched, "utf8");
}

async function seedLavaHook(root: string): Promise<void> {
  const path = join(root, "src", "index.ts");
  const content = await fs.readFile(path, "utf8");
  const hook =
    '\nimport "@rpbey/plugin-lava-player/commands#all";\nimport "@rpbey/plugin-lava-player/events#ready";\n';
  if (content.includes("@rpbey/plugin-lava-player")) return;
  await fs.writeFile(path, content + hook, "utf8");
}

async function seedYtdlHook(root: string): Promise<void> {
  const path = join(root, "src", "index.ts");
  const content = await fs.readFile(path, "utf8");
  const hook = '\nimport "@rpbey/plugin-ytdl-player/commands#all";\n';
  if (content.includes("@rpbey/plugin-ytdl-player")) return;
  await fs.writeFile(path, content + hook, "utf8");
}

async function seedPaginationExample(root: string): Promise<void> {
  const path = join(root, "src", "commands", "pages.ts");
  try {
    await fs.stat(path);
    return; // already exists
  } catch {}
  const body = `import { Discord, Slash } from "@rpbey/discordx";
import { Pagination, PaginationType } from "@rpbey/pagination";
import { EmbedBuilder, type CommandInteraction } from "discord.js";

@Discord()
export class Pages {
  @Slash({ name: "pages", description: "Example paginated embed" })
  async run(interaction: CommandInteraction) {
    const pages = Array.from({ length: 5 }, (_, i) => ({
      embeds: [new EmbedBuilder().setTitle(\`Page \${i + 1}\`).setDescription(\`Content for page \${i + 1}\`)],
    }));
    const pagination = new Pagination(interaction, pages, {
      type: PaginationType.Button,
      time: 60_000,
    });
    await pagination.send();
  }
}
`;
  await fs.writeFile(path, body, "utf8");
}
