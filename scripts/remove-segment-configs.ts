import fs from "node:fs";
import path from "node:path";

const targetDir = path.resolve(__dirname, "../apps/web/src/app");

function walkDir(dir: string, callback: (filePath: string) => void) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, callback);
    } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
      callback(fullPath);
    }
  }
}

let modifiedCount = 0;

walkDir(targetDir, (filePath) => {
  const content = fs.readFileSync(filePath, "utf-8");

  // Regex patterns to match the segment configs on their own lines (including optional trailing semicolon and newline)
  const dynamicRegex =
    /^[ \t]*export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]\s*;?[ \t]*\r?\n/gm;
  const runtimeRegex = /^[ \t]*export\s+const\s+runtime\s*=\s*['"]nodejs['"]\s*;?[ \t]*\r?\n/gm;

  let newContent = content.replace(dynamicRegex, "");
  newContent = newContent.replace(runtimeRegex, "");

  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent, "utf-8");
    console.log(`Updated: ${path.relative(process.cwd(), filePath)}`);
    modifiedCount++;
  }
});

console.log(`\nFinished! Modified ${modifiedCount} files.`);
