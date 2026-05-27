import fs from "node:fs";

const packages = [
  "create-discordx",
  "di",
  "discordx",
  "importer",
  "internal",
  "lava-player",
  "lava-queue",
  "music",
  "pagination",
  "plugin-lava-player",
  "plugin-ytdl-player",
  "utilities",
];

for (const pkg in packages) {
  const dirPath = `docs/${packages[pkg]}`;
  fs.mkdirSync(dirPath, { recursive: true });

  const filePath = `${dirPath}/README.md`;
  const content = fs.readFileSync(`../packages/${packages[pkg]}/README.md`);
  await Bun.write(filePath, `---\ntitle: Readme\nsidebar_position: 0\n---\n\n# &nbsp;\n\n${content}`,);
}

console.log("doc prepared");
