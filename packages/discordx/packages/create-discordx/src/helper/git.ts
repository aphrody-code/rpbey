/*
 * -------------------------------------------------------------------------------------------------------
 * Copyright (c) Vijay Meena <vijayymmeena@gmail.com> (https://github.com/vijayymmeena). All rights reserved.
 * Licensed under the Apache License. See License.txt in the project root for license information.
 * -------------------------------------------------------------------------------------------------------
 */
import { rmSync } from "node:fs";
import path from "node:path";

function runSilent(cmd: string[], cwd: string): boolean {
  const p = Bun.spawnSync({
    cmd,
    cwd,
    stdout: "ignore",
    stderr: "ignore",
  });
  return p.success;
}

function IsInGitRepository(root: string): boolean {
  return runSilent(["git", "rev-parse", "--is-inside-work-tree"], root);
}

function IsInMercurialRepository(root: string): boolean {
  return runSilent(["hg", "--cwd", ".", "root"], root);
}

export function TryGitInit(root: string): boolean {
  let didInit = false;
  try {
    if (!runSilent(["git", "--version"], root)) return false;
    if (IsInGitRepository(root) || IsInMercurialRepository(root)) {
      return false;
    }

    if (!runSilent(["git", "init"], root)) return false;
    didInit = true;

    if (!runSilent(["git", "checkout", "-b", "main"], root)) return false;
    if (!runSilent(["git", "add", "-A"], root)) return false;
    if (
      !runSilent(
        ["git", "commit", "-m", "Initial commit from discordx"],
        root,
      )
    ) {
      return false;
    }

    return true;
  } catch {
    if (didInit) {
      try {
        rmSync(path.join(root, ".git"), { recursive: true, force: true });
      } catch {
        // empty statement
      }
    }

    return false;
  }
}
