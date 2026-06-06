#!/usr/bin/env bun
import { createHash } from "node:crypto";

const ZONE = "rpbey.fr";

const ENDPOINTS: Record<string, string> = {
  "ovh-eu": "https://eu.api.ovh.com/1.0",
};

const base = ENDPOINTS["ovh-eu"];
const ak = process.env.OVH_APPLICATION_KEY || "";
const appSecret = process.env.OVH_APPLICATION_SECRET || "";
const ck = process.env.OVH_CONSUMER_KEY || "";

if (!ak || !appSecret || !ck) {
  console.error(
    "Missing OVH credentials in environment (OVH_APPLICATION_KEY, OVH_APPLICATION_SECRET, OVH_CONSUMER_KEY)",
  );
  process.exit(1);
}

let timeDelta = 0;
async function syncTime() {
  const r = await fetch(`${base}/auth/time`);
  const serverTime = Number(await r.text());
  timeDelta = serverTime - Math.floor(Date.now() / 1000);
}

async function ovh(method: string, path: string, body?: unknown) {
  const url = `${base}${path}`;
  const payload = body ? JSON.stringify(body) : "";
  const ts = String(Math.floor(Date.now() / 1000) + timeDelta);
  const sig =
    "$1$" +
    createHash("sha1").update([appSecret, ck, method, url, payload, ts].join("+")).digest("hex");
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

async function run() {
  await syncTime();
  console.log(`Starting DNS migration for zone ${ZONE}...`);

  // 1. Fetch current records
  const ids: number[] = await ovh("GET", `/domain/zone/${ZONE}/record`);
  const records = [];
  for (const id of ids) {
    const r = await ovh("GET", `/domain/zone/${ZONE}/record/${id}`);
    records.push({ id, ...r });
  }

  // 2. Identify records to delete (A records for play, api, ws, bot, cdn pointing to 51.77.147.152)
  const targetsToDelete = ["play", "api", "ws", "bot", "cdn"];
  const toDelete = records.filter(
    (r) =>
      r.fieldType === "A" && targetsToDelete.includes(r.subDomain) && r.target === "51.77.147.152",
  );

  console.log(`Found ${toDelete.length} legacy VPS A records to delete:`);
  for (const r of toDelete) {
    console.log(` - [A] ${r.subDomain}.rpbey.fr -> ${r.target} (id: ${r.id})`);
  }

  // 3. Perform deletions
  for (const r of toDelete) {
    console.log(`Deleting legacy VPS A record for ${r.subDomain}...`);
    await ovh("DELETE", `/domain/zone/${ZONE}/record/${r.id}`);
    console.log(`Deleted successfully.`);
  }

  // 4. Check if play CNAME already exists, if not create it
  const playCname = records.find((r) => r.fieldType === "CNAME" && r.subDomain === "play");
  if (playCname) {
    if (playCname.target !== "cname.vercel-dns.com.") {
      console.log(
        `Updating existing play CNAME record to point to cname.vercel-dns.com. (current: ${playCname.target})...`,
      );
      await ovh("PUT", `/domain/zone/${ZONE}/record/${playCname.id}`, {
        target: "cname.vercel-dns.com.",
        ttl: 60,
      });
      console.log(`Updated successfully.`);
    } else {
      console.log(`play CNAME record already correctly configured.`);
    }
  } else {
    console.log(`Creating play CNAME record pointing to cname.vercel-dns.com. ...`);
    await ovh("POST", `/domain/zone/${ZONE}/record`, {
      fieldType: "CNAME",
      subDomain: "play",
      target: "cname.vercel-dns.com.",
      ttl: 60,
    });
    console.log(`Created successfully.`);
  }

  // 5. Refresh the zone
  console.log(`Refreshing zone ${ZONE}...`);
  await ovh("POST", `/domain/zone/${ZONE}/refresh`);
  console.log(`Zone refreshed successfully!`);
}

run().catch(console.error);
