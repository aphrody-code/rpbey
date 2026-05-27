#!/usr/bin/env bun
// Copy `@rpbey/brackets-viewer` UMD bundle + CSS into public/vendor/brackets/.
// Runs as `prebuild` so Next can serve them as static assets at /vendor/brackets/*.
// Idempotent: skips when destination is already up to date (mtime + size match).

import { readdir } from "node:fs/promises";
import { resolve } from "node:path";

const PKG_DIR = resolve(
	import.meta.dir,
	"../../../node_modules/@rpbey/brackets-viewer/dist",
);
const DEST_DIR = resolve(import.meta.dir, "../public/vendor/brackets");

const ASSETS = [
	"brackets-viewer.min.js",
	"brackets-viewer.min.css",
	"stage-form-creator.min.js",
];

async function main(): Promise<void> {
	const pkgFile = Bun.file(`${PKG_DIR}/brackets-viewer.min.js`);
	if (!(await pkgFile.exists())) {
		console.error(
			`[copy-brackets-assets] missing source ${PKG_DIR}. Run \`bun install\`.`,
		);
		process.exit(1);
	}

	await Bun.write(`${DEST_DIR}/.gitkeep`, "");

	let copied = 0;
	let skipped = 0;
	for (const name of ASSETS) {
		const srcPath = `${PKG_DIR}/${name}`;
		const dstPath = `${DEST_DIR}/${name}`;
		const src = Bun.file(srcPath);
		const dst = Bun.file(dstPath);

		if (!(await src.exists())) {
			console.warn(`[copy-brackets-assets] skip ${name} (source absent)`);
			continue;
		}

		const dstExists = await dst.exists();
		if (
			dstExists &&
			src.size === dst.size &&
			src.size > 0 &&
			src.lastModified <= dst.lastModified
		) {
			skipped++;
			continue;
		}

		await Bun.write(dstPath, await src.bytes());
		copied++;
	}

	const list = (await readdir(DEST_DIR)).filter((f) => !f.startsWith("."));
	console.log(
		`[copy-brackets-assets] copied=${copied} skipped=${skipped} total=${list.length} → ${DEST_DIR}`,
	);
}

main().catch((err) => {
	console.error("[copy-brackets-assets]", err);
	process.exit(1);
});
