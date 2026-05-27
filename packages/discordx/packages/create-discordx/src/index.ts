#!/usr/bin/env bun

/*
 * create-discordx — scaffold a discordy (Bun-first) bot.
 * Licensed under Apache-2.0.
 */
import path from "node:path";
import ora from "ora";
import prompts from "prompts";

import * as color from "./helper/color.js";
import { ParseArgs, HELP_TEXT } from "./helper/args.js";
import { ApplyFeatures, type Feature } from "./helper/features.js";
import { IsFolderEmpty, MakeDir } from "./helper/dir.js";
import { TryGitInit } from "./helper/git.js";
import { ValidateNpmName } from "./helper/npm.js";
import {
  GetPackageManager,
  InstallPackage,
  PackageManager,
} from "./helper/package-manager.js";
import {
  CopyTemplate,
  ListTemplates,
  SubstituteTokens,
  TemplateExists,
} from "./helper/template.js";
import { default as version } from "./helper/updater.js";

const args = ParseArgs(process.argv.slice(2));

if (args.help) {
  console.log(HELP_TEXT);
  process.exit(0);
}
if (args.version) {
  console.log(String(version));
  process.exit(0);
}

console.log(`
  ${color.bold(color.cyan("discordy"))} ${color.dim(`v${String(version)}`)}
  ${color.dim("Bun-first fork of discordx — https://github.com/rpbey/discordy")}
`);

// ── Project name ──────────────────────────────────────────────────────────
let projectName = args.projectName;

if (!projectName) {
  const res = await prompts(
    {
      initial: "my-bot",
      message: "Project name",
      name: "path",
      type: "text",
      validate: (name: string) => {
        const v = ValidateNpmName(path.basename(path.resolve(name)));
        return v.valid || `Invalid: ${v.problems?.[0] ?? "unknown"}`;
      },
    },
    { onCancel: () => process.exit(0) },
  );
  projectName = typeof res.path === "string" ? res.path.trim() : "my-bot";
}

const resolvedProjectPath = path.resolve(projectName);
const finalName = path.basename(resolvedProjectPath);

const nameValidation = ValidateNpmName(finalName);
if (!nameValidation.valid) {
  console.log(
    color.red(
      `✗ Invalid project name: ${nameValidation.problems?.[0] ?? "unknown"}`,
    ),
  );
  process.exit(1);
}

// ── Template ──────────────────────────────────────────────────────────────
const available = await ListTemplates();
if (available.length === 0) {
  console.log(color.red("✗ No bundled templates found"));
  process.exit(1);
}

let template = args.template;
if (template && !(await TemplateExists(template))) {
  console.log(color.red(`✗ Unknown template: ${template}`));
  console.log(
    color.dim(`  Available: ${available.map((t) => t.value).join(", ")}`),
  );
  process.exit(1);
}

if (!template) {
  if (available.length === 1) {
    template = available[0]!.value;
  } else {
    const res = await prompts(
      {
        choices: available,
        message: "Template",
        name: "template",
        type: "select",
      },
      { onCancel: () => process.exit(0) },
    );
    template = res.template as string;
  }
}

// ── Features ──────────────────────────────────────────────────────────────
const features = args.features as Feature[];

// ── Directory ─────────────────────────────────────────────────────────────
try {
  await MakeDir(resolvedProjectPath);
} catch (err) {
  console.log(color.red("✗ Failed to create directory"));
  console.error(err);
  process.exit(1);
}

if (!IsFolderEmpty(resolvedProjectPath, finalName)) {
  process.exit(1);
}

// ── Copy + token substitution ─────────────────────────────────────────────
const spinner = ora({ text: color.bold("Scaffolding…") }).start();
try {
  await CopyTemplate(resolvedProjectPath, template!);
  await SubstituteTokens(resolvedProjectPath, { PROJECT_NAME: finalName });
  if (features.length > 0) {
    await ApplyFeatures(resolvedProjectPath, features);
  }
  spinner.succeed(color.bold(`Scaffolded ${color.greenBright(finalName)}`));
} catch (err) {
  spinner.fail(color.bold("Failed to scaffold"));
  console.error(err);
  process.exit(1);
}

// ── Git ───────────────────────────────────────────────────────────────────
if (args.git !== false) {
  TryGitInit(resolvedProjectPath);
}

// ── Install ───────────────────────────────────────────────────────────────
let pkgManager: PackageManager = PackageManager.none;
if (args.install !== false) {
  if (args.install === true) {
    pkgManager = PackageManager.bun;
  } else {
    const detected = await GetPackageManager();
    if (detected !== null) pkgManager = detected;
  }
}

if (pkgManager !== PackageManager.none) {
  await InstallPackage(resolvedProjectPath, pkgManager);
}

// ── Done ──────────────────────────────────────────────────────────────────
console.log();
console.log(
  color.greenBright("✓"),
  color.bold("Created"),
  color.gray("→"),
  color.greenBright(finalName),
);
if (features.length > 0) {
  console.log(color.dim(`  features: ${features.join(", ")}`));
}
console.log();
console.log(color.blueBright("➜"), color.bold("Next"));
console.log(`  cd ${projectName}`);
if (pkgManager === PackageManager.none) {
  console.log("  bun install");
}
console.log("  cp .env.example .env    # set DISCORD_TOKEN");
console.log(
  `  ${pkgManager === PackageManager.none ? "bun" : PackageManager[pkgManager]} run dev`,
);
console.log();
console.log(color.dim("  Docs: https://github.com/rpbey/discordy"));
