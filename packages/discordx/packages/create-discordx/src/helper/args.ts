/*
 * Minimal CLI arg parser — no external dep.
 */
export interface Args {
  projectName?: string;
  template?: string;
  features: string[];
  install?: boolean;
  git?: boolean;
  help: boolean;
  version: boolean;
}

export function ParseArgs(argv: string[]): Args {
  const out: Args = {
    features: [],
    help: false,
    version: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a) continue;

    if (a === "--help" || a === "-h") out.help = true;
    else if (a === "--version" || a === "-v") out.version = true;
    else if (a === "--install") out.install = true;
    else if (a === "--no-install") out.install = false;
    else if (a === "--git") out.git = true;
    else if (a === "--no-git") out.git = false;
    else if (a === "--template" || a === "-t") {
      out.template = argv[++i];
    } else if (a.startsWith("--template=")) {
      out.template = a.slice("--template=".length);
    } else if (a === "--with-di") out.features.push("di");
    else if (a === "--with-music") out.features.push("music");
    else if (a === "--with-lava") out.features.push("lava");
    else if (a === "--with-ytdl") out.features.push("ytdl");
    else if (a === "--with-pagination") out.features.push("pagination");
    else if (a === "--with-importer") out.features.push("importer");
    else if (!a.startsWith("-") && !out.projectName) {
      out.projectName = a;
    }
  }

  // mutual exclusion: lava ⊕ ytdl (both add @discordjs/voice; warn, don't error)
  // caller can decide
  return out;
}

export const HELP_TEXT = `
@rpbey/create-discordx — scaffold a discordy (Bun-first discordx fork) bot

USAGE
  bunx @rpbey/create-discordx [name] [flags]

FLAGS
  -t, --template <name>    Template to use (default: basic)
  --with-di                Add tsyringe + @rpbey/di bridge
  --with-music             Add @rpbey/music (worker-threads YTDL)
  --with-lava              Add @rpbey/plugin-lava-player (ready commands)
  --with-ytdl              Add @rpbey/plugin-ytdl-player (ready commands)
  --with-pagination        Add @rpbey/pagination + example /pages command
  --with-importer          Add @rpbey/importer (module auto-loader)
  --install | --no-install Run bun install after scaffold
  --git | --no-git         Init git (default: on)
  -h, --help               This help
  -v, --version            Print version

EXAMPLES
  bunx @rpbey/create-discordx my-bot
  bunx @rpbey/create-discordx my-bot --template basic --with-ytdl --with-pagination --no-git
  bunx @rpbey/create-discordx --help
`;
