import { Alert, Box, Container, Typography } from "@mui/material";
import { type Metadata } from "next";
import { loadJsonSafe } from "@/lib/data-cache";
import { db } from "@/lib/db";
import { createPageMetadata } from "@/lib/seo-utils";

import { MetaClient } from "./_components/MetaClient";
import { type BbxWeeklyData, type PartStats } from "./_components/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createPageMetadata({
  title: "Meta Beyblade X | RPB",
  description:
    "Rankings des pièces Beyblade X basés sur les résultats de tournois WBO. Scores de puissance et synergies par catégorie.",
  path: "/meta",
});

async function getData(): Promise<BbxWeeklyData | null> {
  return loadJsonSafe<BbxWeeklyData>("data/bbx-weekly.json");
}

interface PartMetadata {
  stats: PartStats;
  imageUrl?: string | null;
}

async function getPartMetadataMap(): Promise<Map<string, PartMetadata>> {
  try {
    const parts = await db.query.parts.findMany({
      columns: {
        name: true,
        attack: true,
        defense: true,
        stamina: true,
        burst: true,
        dash: true,
        imageUrl: true,
      },
    });
    const map = new Map<string, PartMetadata>();
    for (const p of parts) {
      const stats: PartStats = {
        attack: Number(p.attack) || 0,
        defense: Number(p.defense) || 0,
        stamina: Number(p.stamina) || 0,
        dash: Number(p.dash) || 0,
        burst: Number(p.burst) || 0,
      };

      map.set(p.name.toLowerCase(), {
        stats,
        imageUrl: p.imageUrl,
      });
    }
    return map;
  } catch {
    return new Map();
  }
}

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

function enrichWithStats(
  data: BbxWeeklyData,
  metadataMap: Map<string, PartMetadata>,
): BbxWeeklyData {
  if (!data?.periods) return data;

  // Create a normalized map for better matching
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

        // Try direct match first, then normalized match
        const metadata = metadataMap.get(comp.name.toLowerCase()) || normalizedMap.get(normName);

        if (metadata) {
          if (
            metadata.stats.attack +
              metadata.stats.defense +
              metadata.stats.stamina +
              metadata.stats.dash +
              metadata.stats.burst >
            0
          ) {
            comp.stats = metadata.stats;
          }
          if (metadata.imageUrl) {
            comp.imageUrl = metadata.imageUrl;
          }
        }

        // Enrich synergies
        for (const synergy of comp.synergy) {
          const synergyNormName = normalizeName(synergy.name);
          const synergyMeta =
            metadataMap.get(synergy.name.toLowerCase()) || normalizedMap.get(synergyNormName);
          if (synergyMeta?.imageUrl) {
            synergy.imageUrl = synergyMeta.imageUrl;
          }
        }
      }
    }
  }
  return data;
}

export default async function MetaPage() {
  const [data, metadataMap] = await Promise.all([getData(), getPartMetadataMap()]);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background:
          "radial-gradient(ellipse at 50% 0%, rgba(var(--rpb-primary-rgb),0.08) 0%, transparent 60%)",
      }}
    >
      <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
        {!data ||
        (data.periods["2weeks"].categories.length === 0 &&
          data.periods["4weeks"].categories.length === 0) ? (
          <Box sx={{ mt: 8, textAlign: "center" }}>
            <Typography
              variant="h3"
              gutterBottom
              sx={{
                fontWeight: 900,
              }}
            >
              Meta Beyblade X
            </Typography>
            <Alert severity="info" sx={{ maxWidth: 500, mx: "auto", mt: 3 }}>
              Les données meta ne sont pas encore disponibles. Elles seront mises à jour
              automatiquement chaque vendredi.
            </Alert>
          </Box>
        ) : (
          <MetaClient data={enrichWithStats(data, metadataMap)} />
        )}
      </Container>
    </Box>
  );
}
