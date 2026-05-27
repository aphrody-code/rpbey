/*
 * -------------------------------------------------------------------------------------------------------
 * Copyright (c) Vijay Meena <vijayymmeena@gmail.com> (https://github.com/vijayymmeena). All rights reserved.
 * Licensed under the Apache License. See License.txt in the project root for license information.
 * -------------------------------------------------------------------------------------------------------
 */
import path from "node:path";
import boxen from "boxen";
import isInstalledGlobally from "is-installed-globally";
import checkForUpdate from "update-check";

import * as color from "./color.js";

/**
 * Read package.json
 */
const packageJson = (await Bun.file(
  path.join(import.meta.dirname, "..", "package.json"),
).json()) as { version: string };

/**
 * Check for update
 */

let update = null;

try {
  update = await checkForUpdate(packageJson);
} catch {
  console.log(
    boxen("Failed to check for updates", {
      align: "center",
      borderColor: "red",
      borderStyle: "round",
      margin: 1,
      padding: 1,
    }),
  );
}

if (update) {
  const updateCmd = isInstalledGlobally
    ? "npm i -g create-discordx@latest"
    : "npm i create-discordx@latest";

  const updateVersion = packageJson.version;
  const updateLatest = update.latest;
  const updateCommand = updateCmd;
  const template = `Update available ${color.dim(updateVersion)}${color.reset(" → ")}${color.green(updateLatest)} \nRun ${color.cyan(updateCommand)} to update`;

  console.log(
    boxen(template, {
      align: "center",
      borderColor: "yellow",
      borderStyle: "round",
      margin: 1,
      padding: 1,
    }),
  );
}

export default packageJson.version;
