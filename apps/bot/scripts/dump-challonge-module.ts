/**
 * Dump complet de https://challonge.com/<slug>/module via dumpChallongeRaw.
 *
 * Phase 4: uses BxcTransport (curl-impersonate) instead of Puppeteer.
 * Persists html + parsed JSON in data/scrapes/<slug>_module_<ts>.{html,json}.
 *
 * Usage: bun scripts/dump-challonge-module.ts T_SS1
 */

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { dumpChallongeRaw } from "@rose-griffon/challonge";

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error("Usage: bun scripts/dump-challonge-module.ts <slug>");
    process.exit(1);
  }

  console.log(`GET https://challonge.com/${slug}/module (via bxc)`);
  const { html, store, parsed } = await dumpChallongeRaw(slug, "module");

  const dumpDir = path.join(process.cwd(), "data/scrapes");
  await mkdir(dumpDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");

  const htmlPath = path.join(dumpDir, `${slug}_module_${stamp}.html`);
  await Bun.write(htmlPath, html);
  console.log(`HTML -> ${htmlPath} (${html.length} chars)`);

  // Reconstruct inventory from raw HTML by regex (same shape as the old evaluate() call).
  const reactComponents = [...html.matchAll(/data-react-class="([^"]+)"/g)]
    .map((m) => m[1] as string)
    .filter(Boolean)
    .sort()
    .filter((v, i, a) => a.indexOf(v) === i);

  const classAttr = [...html.matchAll(/class="([^"]+)"/g)].flatMap((m) =>
    (m[1] as string).split(/\s+/).filter(Boolean),
  );
  const classSet = [...new Set(classAttr)].sort();

  const dataAttrNames = [
    ...new Set([...html.matchAll(/\s(data-[a-z][a-z0-9-]*)=/g)].map((m) => m[1] as string)),
  ].sort();

  const groupBracketRe = /group|bracket|round|match|stage|pool|final/i;
  const matchGameScoreRe = /match|game|score/i;

  const inventory = {
    reactComponents,
    classGroupBracket: classSet.filter((c) => groupBracketRe.test(c)),
    classMatch: classSet.filter((c) => matchGameScoreRe.test(c)),
    dataAttrs: dataAttrNames,
  };

  console.log(`\nReact components: ${inventory.reactComponents.length}`);
  for (const c of inventory.reactComponents) console.log(`   - ${c}`);

  console.log(`\nClasses group/bracket/round/match (${inventory.classGroupBracket.length}):`);
  for (const c of inventory.classGroupBracket.slice(0, 50)) console.log(`   - ${c}`);

  console.log(`\ndata-attrs (${inventory.dataAttrs.length}):`);
  for (const a of inventory.dataAttrs.slice(0, 30)) console.log(`   - ${a}`);

  // JS stores summary from parsed store state.
  const storeKeys = Object.keys(store);
  console.log(`\nJS stores (${storeKeys.length}): ${storeKeys.join(", ")}`);

  const inventoryPath = path.join(dumpDir, `${slug}_module_${stamp}.inventory.json`);
  const inventoryData = {
    inventory,
    storeKeys,
    parsed: parsed ?? null,
  };
  await Bun.write(inventoryPath, JSON.stringify(inventoryData, null, 2));
  console.log(`Inventory -> ${inventoryPath}`);

  console.log(`\nextracted via bxc`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
