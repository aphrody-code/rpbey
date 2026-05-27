#!/usr/bin/env bun
/**
 * Swap DNS rpbey.fr (apex + www) vers le VPS via l'API OVH (signée).
 *
 * Lit les creds depuis ~/.ovh.conf (format SDK OVH). Ne logge JAMAIS les
 * secrets ni la signature — uniquement les records et les statuts HTTP.
 *
 *   bun scripts/ovh-dns-swap.ts            # dry-run : liste les records apex+www
 *   bun scripts/ovh-dns-swap.ts --apply    # applique le swap → 51.77.147.152
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";

const ZONE = "rpbey.fr";
const VPS_IP = "51.77.147.152";
const APPLY = process.argv.includes("--apply");

const ENDPOINTS: Record<string, string> = {
  "ovh-eu": "https://eu.api.ovh.com/1.0",
  "ovh-ca": "https://ca.api.ovh.com/1.0",
  "ovh-us": "https://api.us.ovhcloud.com/1.0",
};

function parseConf(): { base: string; ak: string; as: string; ck: string } {
  const raw = readFileSync(`${homedir()}/.ovh.conf`, "utf8");
  let section = "";
  const cfg: Record<string, Record<string, string>> = {};
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || t.startsWith(";")) continue;
    const sec = t.match(/^\[(.+)\]$/);
    if (sec) {
      section = sec[1];
      cfg[section] = {};
      continue;
    }
    const eq = t.indexOf("=");
    if (eq > 0 && section) cfg[section][t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  const endpoint = cfg.default?.endpoint ?? "ovh-eu";
  const base = ENDPOINTS[endpoint] ?? ENDPOINTS["ovh-eu"];
  const s = cfg[endpoint] ?? {};
  return {
    base,
    ak: s.application_key,
    as: s.application_secret,
    ck: s.consumer_key,
  };
}

const { base, ak, as: appSecret, ck } = parseConf();
if (!ak || !appSecret || !ck) {
  console.error("Creds OVH incomplets dans ~/.ovh.conf");
  process.exit(1);
}

let timeDelta = 0;
async function syncTime() {
  const r = await fetch(`${base}/auth/time`);
  const serverTime = Number(await r.text());
  timeDelta = serverTime - Math.floor(Date.now() / 1000);
}

async function ovh(method: string, path: string, body?: unknown): Promise<any> {
  const url = `${base}${path}`;
  const payload = body ? JSON.stringify(body) : "";
  const ts = String(Math.floor(Date.now() / 1000) + timeDelta);
  const sig =
    "$1$" +
    createHash("sha1")
      .update([appSecret, ck, method, url, payload, ts].join("+"))
      .digest("hex");
  const r = await fetch(url, {
    method,
    headers: {
      "X-Ovh-Application": ak,
      "X-Ovh-Consumer": ck,
      "X-Ovh-Timestamp": ts,
      "X-Ovh-Signature": sig,
      "Content-Type": "application/json",
    },
    body: payload || undefined,
  });
  const text = await r.text();
  if (!r.ok) {
    throw new Error(`OVH ${method} ${path} → ${r.status}: ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

async function recordsFor(fieldType: string, subDomain: string): Promise<number[]> {
  const q = new URLSearchParams({ fieldType, subDomain });
  return ovh("GET", `/domain/zone/${ZONE}/record?${q}`);
}

async function main() {
  await syncTime();
  console.log(`Zone ${ZONE} — cible VPS ${VPS_IP} — mode: ${APPLY ? "APPLY" : "DRY-RUN"}\n`);

  // Inventaire apex + www
  for (const [label, sub] of [["apex (@)", ""], ["www", "www"]] as const) {
    for (const ft of ["A", "AAAA", "CNAME"]) {
      const ids = await recordsFor(ft, sub);
      for (const id of ids) {
        const rec = await ovh("GET", `/domain/zone/${ZONE}/record/${id}`);
        console.log(`  [${label}] #${id} ${rec.fieldType} "${rec.subDomain}" → ${rec.target} (ttl ${rec.ttl})`);
      }
    }
  }

  if (!APPLY) {
    console.log("\nDry-run terminé. Relancer avec --apply pour swapper.");
    return;
  }

  console.log("\n=== APPLY ===");
  // apex A → VPS (update tous les A racine ; supprime AAAA racine éventuels Vercel)
  for (const id of await recordsFor("A", "")) {
    await ovh("PUT", `/domain/zone/${ZONE}/record/${id}`, { target: VPS_IP, ttl: 60 });
    console.log(`  apex A #${id} → ${VPS_IP} (ttl 60) ✓`);
  }
  for (const id of await recordsFor("AAAA", "")) {
    await ovh("DELETE", `/domain/zone/${ZONE}/record/${id}`);
    console.log(`  apex AAAA #${id} supprimé (pas d'IPv6 VPS) ✓`);
  }
  // www : CNAME Vercel → CNAME apex (suivra l'apex vers le VPS)
  for (const id of await recordsFor("CNAME", "www")) {
    await ovh("PUT", `/domain/zone/${ZONE}/record/${id}`, { target: `${ZONE}.`, ttl: 60 });
    console.log(`  www CNAME #${id} → ${ZONE}. (ttl 60) ✓`);
  }
  for (const id of await recordsFor("A", "www")) {
    await ovh("PUT", `/domain/zone/${ZONE}/record/${id}`, { target: VPS_IP, ttl: 60 });
    console.log(`  www A #${id} → ${VPS_IP} (ttl 60) ✓`);
  }
  // applique la zone
  await ovh("POST", `/domain/zone/${ZONE}/refresh`);
  console.log("  zone refresh ✓");
}

main().catch((e) => {
  console.error(String(e.message ?? e).replace(/[a-f0-9]{32,}/gi, "[REDACTED]"));
  process.exit(1);
});
