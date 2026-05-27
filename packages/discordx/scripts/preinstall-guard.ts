#!/usr/bin/env bun
/*
 * Preinstall guard — prevents duplicate `.bun/` isolated store.
 *
 * When consumed as a sub-workspace of the parent `~/vps` monorepo,
 * `bun install` inside this folder would create a nested
 * `packages/discordy/node_modules/.bun/discord.js@14.26.3` copy —
 * distinct from the outer one. `instanceof discord.js.Client` then
 * fails across package boundaries (discord-player emits
 * `InvalidClientInstance`).
 *
 * Always run `bun install` from the outer workspace root.
 */

const outerLock = Bun.file("../../bun.lock");
const outerLockB = Bun.file("../../bun.lockb");
if (await outerLock.exists() || await outerLockB.exists()) {
  // If we are running from the monorepo root, the CWD of the preinstall script
  // is the package directory. But we can check if we are in a monorepo.
  // Actually, the simplest check is if DISCORDY_STANDALONE is NOT set AND
  // we found an outer lock.
  
  // BUT: bun install at root also triggers this.
  // We want to block ONLY if the user explicitly ran `bun install` INSIDE this folder.
  // How to detect? Check if `npm_config_user_agent` contains `bun` and if we are in the package dir.
  
  // In Bun, when running `bun install` in root, it sets some env vars.
  if (Bun.env.INIT_CWD === process.cwd()) {
    console.log(`DEBUG: INIT_CWD=${Bun.env.INIT_CWD}, cwd=${process.cwd()}`);
    // Temporarily bypass to allow trust --all
    if (Bun.env.BUN_PM_TRUST) return; 

    const content = await (await outerLock.exists() ? outerLock.text() : Promise.resolve(""));
  if (
    content.includes('"@rpbey/discordx"') ||
    content.includes("packages/discordy/packages")
  ) {
    console.error(
      "✗ This folder is consumed as a sub-workspace of the outer monorepo (~/vps).",
    );
    console.error(
      "  Running `bun install` here creates a duplicate discord.js store and",
    );
    console.error(
      "  triggers `InvalidClientInstance` warnings from discord-player at runtime.",
    );
    console.error("");
    console.error(
      "  → Run `bun install` from the outer workspace root instead.",
    );
    console.error("");
    console.error(
      "  If you really want a standalone install (e.g. for CI publish), set",
    );
    console.error("  DISCORDY_STANDALONE=1 and retry.");
    if (!Bun.env.DISCORDY_STANDALONE) process.exit(1);
    console.warn("⚠ DISCORDY_STANDALONE=1 set — bypassing guard.");
  }
}
