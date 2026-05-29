import path from "node:path";

/**
 * Resolve a path relative to the project root.
 * Handles both cases:
 * - Running from project root → cwd is the monorepo root
 * - Running from bot subdir → cwd is the bot subdirectory
 */
export function resolveRootPath(...segments: string[]): string {
  const cwd = process.cwd();
  const root = cwd.endsWith("/bot") || cwd.endsWith("\\bot") ? path.resolve(cwd, "..") : cwd;
  return path.resolve(root, ...segments);
}

export function resolveDataPath(...segments: string[]): string {
  return resolveRootPath("data", ...segments);
}
