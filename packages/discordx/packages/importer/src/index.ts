/*
 * -------------------------------------------------------------------------------------------------------
 * Copyright (c) Vijay Meena <vijayymmeena@gmail.com> (https://github.com/vijayymmeena). All rights reserved.
 * Licensed under the Apache License. See License.txt in the project root for license information.
 * -------------------------------------------------------------------------------------------------------
 */
import path from "node:path";

export function isESM(): boolean {
  return !!import.meta.url;
}

export function dirname(url: string): string {
  // When called with import.meta.url, prefer import.meta.dir (Bun-native)
  if (url.startsWith("file://")) {
    return import.meta.dir;
  }
  return path.dirname(url);
}

async function scan(pattern: string): Promise<string[]> {
  const g = new Bun.Glob(pattern);
  const out: string[] = [];
  for await (const p of g.scan({ cwd: ".", absolute: true })) out.push(p);
  return out;
}

export async function resolve(...paths: string[]): Promise<string[]> {
  const imports: string[] = [];

  await Promise.all(
    paths.map(async (ps) => {
      const files = await scan(ps.split(path.sep).join("/"));

      files.forEach((file) => {
        if (!imports.includes(file)) {
          imports.push(`file://${file}`);
        }
      });
    }),
  );

  return imports;
}

export async function importx(...paths: string[]): Promise<void> {
  const files = await resolve(...paths);
  await Promise.all(files.map((file) => import(file)));
}
