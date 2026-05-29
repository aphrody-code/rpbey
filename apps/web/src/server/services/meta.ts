import "server-only";
import { getMeta } from "@rpbey/api-client";
import type { BbxWeeklyData, PartStats } from "@rpbey/api-contract";
import { loadJsonSafe } from "@/lib/data-cache";
import { getPartsForMeta } from "@/server/dal/parts";
import { isRemote, unwrap } from "@/server/data-source";

/**
 * Service méta — charge `data/bbx-weekly.json` et l'enrichit avec les stats/images
 * des pièces (DB via DAL). UI-agnostic : aucune dépendance React/MUI.
 * Consommé par la page `/meta` (RSC) et `/api/v1/meta`.
 */

interface PartMetadata {
  stats: PartStats;
  imageUrl?: string | null;
}

// Correspondances manuelles nom-affiché → nom-normalisé (scraper WBO ↔ DB).
const MANUAL_MAPPINGS: Record<string, string> = {
  // Blades
  blast: "pegasusblast",
  shark: "sharkedge",
  dransword: "dransword",
  hellsscythe: "hellsscythe",
  knightshield: "knightshield",
  wizardarrow: "wizardarrow",
  knightlance: "knightlance",
  leonclaw: "leonclaw",
  vipertail: "vipertail",
  rhinohorn: "rhinohorn",
  drandagger: "drandagger",
  hellschain: "hellschain",
  phoenixwing: "phoenixwing",
  wyverngale: "wyverngale",
  unicornsting: "unicornsting",
  sphinxcowl: "sphinxcowl",
  dranbuster: "dranbuster",
  hellshammer: "hellshammer",
  wizardrod: "wizardrod",
  tyrannobeat: "tyrannobeat",
  shinobishadow: "shinobishadow",
  weisstiger: "weisstiger",
  cobaltdragoon: "cobaltdragoon",
  blackshell: "blackshell",
  leoncrest: "leoncrest",
  phoenixrudder: "phoenixrudder",
  whalewave: "whalewave",
  bearscratch: "bearscratch",
  silverwolf: "silverwolf",
  samuraisaber: "samuraisaber",
  knightmail: "knightmail",
  pteraswing: "pteraswing",
  leonfang: "leonfangredver",
  valkyrievolt: "valkyrievolt",
  cerberusflame: "cerberusflame",
  dranbrave: "dranbrave",
  wizardarc: "wizardarc",
  hellsreaper: "hellsreaper",
  phoenixflare: "phoenixflare",
  // Lock Chips
  plasticchip: "plasticlockchip",
  metalchip: "metallockchipemperor",
  leonchip: "lockchipleon",
  valkyriechip: "metallockchipvalkyrie",
  cerberuschip: "lockchipcerberus",
  dranchip: "lockchipdran",
  solchip: "lockchipsol",
  wolfchip: "lockchipwolf",
  phoenixchip: "lockchipphoenix",
  sharkchip: "lockchipshark",
  whalechip: "lockchipwhale",
  hellschip: "lockchiphells",
  foxchip: "lockchipfox",
  perseuschip: "lockchipperseus",
  wizardchip: "lockchipwizard",
  knightchip: "lockchipknight",
  bahamutchip: "lockchipbahamut",
  ragnachip: "lockchipragna",
  rhinochip: "lockchiprhino",
  // Assist Blades
  heavy: "hheavy",
  wheel: "wwheel",
  bumper: "bbumper",
  charge: "ccharge",
  assault: "aassault",
  dual: "ddual",
  erase: "eerase",
  slash: "sslash",
  round: "rround",
  turn: "tturn",
  jaggy: "jjaggy",
  zillion: "zzillion",
  free: "ffree",
  // Bits
  level: "l",
  ball: "b",
  taper: "t",
  needle: "n",
  flat: "f",
  rush: "r",
  point: "p",
  orb: "o",
  spike: "s",
  jolt: "j",
  kick: "k",
  quattro: "q",
};

function normalizeName(name: string): string {
  const norm = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  return MANUAL_MAPPINGS[norm] || norm;
}

async function getPartMetadataMap(): Promise<Map<string, PartMetadata>> {
  try {
    const parts = await getPartsForMeta();
    const map = new Map<string, PartMetadata>();
    for (const p of parts) {
      map.set(p.name.toLowerCase(), {
        stats: {
          attack: Number(p.attack) || 0,
          defense: Number(p.defense) || 0,
          stamina: Number(p.stamina) || 0,
          dash: Number(p.dash) || 0,
          burst: Number(p.burst) || 0,
        },
        imageUrl: p.imageUrl,
      });
    }
    return map;
  } catch {
    return new Map();
  }
}

function enrichWithStats(
  data: BbxWeeklyData,
  metadataMap: Map<string, PartMetadata>,
): BbxWeeklyData {
  if (!data?.periods) return data;

  const normalizedMap = new Map<string, PartMetadata>();
  for (const [name, meta] of metadataMap.entries()) {
    normalizedMap.set(normalizeName(name), meta);
  }

  for (const periodKey of ["2weeks", "4weeks"] as const) {
    const period = data.periods[periodKey];
    if (!period?.categories) continue;

    for (const category of period.categories) {
      if (!category?.components) continue;

      for (const comp of category.components) {
        const normName = normalizeName(comp.name);
        const metadata = metadataMap.get(comp.name.toLowerCase()) || normalizedMap.get(normName);

        if (metadata) {
          const total =
            metadata.stats.attack +
            metadata.stats.defense +
            metadata.stats.stamina +
            metadata.stats.dash +
            metadata.stats.burst;
          if (total > 0) comp.stats = metadata.stats;
          if (metadata.imageUrl) comp.imageUrl = metadata.imageUrl;
        }

        for (const synergy of comp.synergy) {
          const synergyMeta =
            metadataMap.get(synergy.name.toLowerCase()) ||
            normalizedMap.get(normalizeName(synergy.name));
          if (synergyMeta?.imageUrl) synergy.imageUrl = synergyMeta.imageUrl;
        }
      }
    }
  }
  return data;
}

/** Méta hebdo enrichie (stats + images), ou `null` si pas encore scrapée. */
export async function getEnrichedMeta(): Promise<BbxWeeklyData | null> {
  // Standalone (Vercel) : la méta est déjà enrichie côté API distante.
  // L'enveloppe `{ ok, data }` du SDK porte ici un payload `{ data: BbxWeeklyData | null }`
  // (le contrat MetaResponse nomme son champ `data`) → on déballe les deux niveaux.
  if (isRemote) return unwrap(await getMeta()).data;

  const [data, metadataMap] = await Promise.all([
    loadJsonSafe<BbxWeeklyData>("data/bbx-weekly.json"),
    getPartMetadataMap(),
  ]);
  if (!data) return null;
  return enrichWithStats(data, metadataMap);
}
