/*
 * -------------------------------------------------------------------------------------------------------
 * Copyright (c) Vijay Meena <vijayymmeena@gmail.com> (https://github.com/vijayymmeena). All rights reserved.
 * Licensed under the Apache License. See License.txt in the project root for license information.
 * -------------------------------------------------------------------------------------------------------
 */
import ora from "ora";
import prompts from "prompts";

import * as color from "./color.js";

export enum PackageManager {
  npm,
  yarn,
  pnpm,
  bun,
  none,
}

function hasCommand(bin: string): boolean {
  const p = Bun.spawnSync({
    cmd: [bin, "--version"],
    stdout: "ignore",
    stderr: "ignore",
  });
  return p.success;
}

async function runInstall(bin: string, cwd: string): Promise<void> {
  const proc = Bun.spawn({
    cmd: [bin, "install"],
    cwd,
    stdout: "ignore",
    stderr: "ignore",
  });
  const code = await proc.exited;
  if (code !== 0) {
    throw new Error(`${bin} install exited with code ${code}`);
  }
}

export async function GetPackageManager(): Promise<PackageManager | null> {
  const selected = await prompts(
    {
      choices: [
        {
          title: "npm",
          value: PackageManager.npm.toString(),
        },
        {
          title: "yarn",
          value: PackageManager.yarn.toString(),
        },
        {
          title: "pnpm",
          value: PackageManager.pnpm.toString(),
        },
        {
          title: "bun",
          value: PackageManager.bun.toString(),
        },
        {
          title: "none - do not install packages",
          value: PackageManager.none.toString(),
        },
      ],
      message: "Pick package manager",
      name: "package-manager",
      type: "select",
    },
    {
      onCancel: () => {
        process.exit();
      },
    },
  );

  const manager = Number(selected["package-manager"]) as PackageManager;

  const bin =
    manager === PackageManager.npm
      ? "npm"
      : manager === PackageManager.yarn
        ? "yarn"
        : manager === PackageManager.pnpm
          ? "pnpm"
          : manager === PackageManager.bun
            ? "bun"
            : null;

  if (bin && !hasCommand(bin)) {
    console.log(
      color.red("×"),
      `Could not found ${color.greenBright(
        PackageManager[manager],
      )} package manager, Please install it from:`,
      PackageManager.pnpm === manager
        ? "https://pnpm.io"
        : PackageManager.yarn === manager
          ? "https://yarnpkg.com"
          : PackageManager.bun === manager
            ? "https://bun.sh"
            : "https://nodejs.org/en/download",
    );
    return GetPackageManager();
  }

  return manager;
}

export async function InstallPackage(
  root: string,
  manager: PackageManager,
): Promise<void> {
  if (PackageManager.none === manager) {
    console.log(
      color.blueBright("?"),
      color.bold("skipped package installation..."),
    );
    return;
  }

  const spinner = ora({
    text: color.bold("Installing packages..."),
  }).start();

  const bin =
    manager === PackageManager.npm
      ? "npm"
      : manager === PackageManager.yarn
        ? "yarn"
        : manager === PackageManager.pnpm
          ? "pnpm"
          : "bun";

  try {
    await runInstall(bin, root);
    spinner.succeed(color.bold("Installed packages"));
  } catch (err) {
    spinner.fail(color.bold("Failed to install packages :("));
    console.log(err);
  }
}
