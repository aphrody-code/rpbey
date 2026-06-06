import { type MetaPartPreview, type RankingBoard } from "@/components/marketing";
import { loadJsonSafe } from "@/lib/data-cache";
import { createPageMetadata } from "@/lib/seo-utils";
import { getBtsRanking, loadDiscordImageResolver, loadUserIdResolver } from "@/server/actions/bts";
import { getContent } from "@/server/actions/cms";
import {
  getActiveHomeTournament,
  getCurrentSeason,
  getFeaturedHomeVideos,
  getHomeRankingBoards,
  getPartImages,
  type HomeRankingRow,
} from "@/server/dal/cms";
import { getAllTournamentsForHome } from "@/server/dal/tournaments";
import HomeClient from "./HomeClient";

export const dynamic = "force-dynamic";
export const revalidate = 60;

export const metadata = createPageMetadata({
  title: "RPB - République Populaire du Beyblade",
  description:
    "La 1ère communauté Beyblade X en France : tournois officiels, classements nationaux, builder de combos, gacha TCG et événements en direct.",
  path: "/",
});

const CATEGORY_ORDER = ["Blade", "Ratchet", "Bit"];
const TOP_PER_CATEGORY = 3;

const MANUAL_MAPPINGS: Record<string, string> = {
  blast: "pegasusblast",
  shark: "sharkedge",
  wizardrod: "wizardrod",
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

async function getTopMetaParts(): Promise<MetaPartPreview[]> {
  try {
    const data = await loadJsonSafe<{
      periods: {
        "4weeks": {
          categories: {
            category: string;
            components: {
              name: string;
              score: number;
              position_change: number | "NEW";
              imageUrl?: string;
            }[];
          }[];
        };
      };
    }>("data/bbx-weekly.json");

    const period = data?.periods["4weeks"];
    if (!period?.categories) return [];

    // Images des pièces (DB via DAL)
    const dbParts = await getPartImages();
    const imageMap = new Map<string, string>();
    for (const p of dbParts) {
      if (p.imageUrl) {
        imageMap.set(normalizeName(p.name), p.imageUrl);
      }
    }

    const results: MetaPartPreview[] = [];

    for (const catName of CATEGORY_ORDER) {
      const category = period.categories.find((c) => c.category === catName);
      if (!category?.components) continue;

      const top = category.components.slice(0, TOP_PER_CATEGORY);
      for (const comp of top) {
        const normName = normalizeName(comp.name);
        results.push({
          name: comp.name,
          score: comp.score,
          category: catName,
          imageUrl: comp.imageUrl || imageMap.get(normName) || null,
          position_change: comp.position_change,
        });
      }
    }

    return results;
  } catch {
    return [];
  }
}

const RANKING_TOP = 12;

// Tous les classements RPB pour le carrousel de la homepage. Mêmes sources que
// les pages dédiées : BTS (getBtsRanking), WB/SATR/Stardust (tables synchronisées).
async function getRankingBoards(activeSeason: any): Promise<RankingBoard[]> {
  const [imageResolver, userIdResolver] = await Promise.all([
    loadDiscordImageResolver().catch(() => () => null as string | null),
    loadUserIdResolver().catch(() => () => null as string | null),
  ]);

  let seasonNum = 2; // Default fallback
  if (activeSeason) {
    const match =
      activeSeason.slug.match(/saison-(\d+)/i) || activeSeason.name.match(/saison\s*(\d+)/i);
    if (match) {
      seasonNum = Number(match[1]);
    } else if (activeSeason.slug.includes("mars-2026")) {
      seasonNum = 2;
    }
  }

  const seasonLabel = activeSeason ? activeSeason.name : "Saison 2";

  const normalizeDbRow = (r: HomeRankingRow) => ({
    id: r.id,
    userId: userIdResolver(r.playerName, null),
    playerName: r.playerName,
    points: r.score,
    wins: r.wins,
    losses: r.losses,
    tournamentWins: 0,
    avatarUrl: imageResolver(r.playerName, null),
  });

  const [bts, boards] = await Promise.all([
    getBtsRanking(seasonNum as any, { pageSize: RANKING_TOP })
      .then((res) =>
        res.entries.slice(0, RANKING_TOP).map((e) => ({
          id: `bts-${e.rank}-${e.playerName}`,
          userId: userIdResolver(e.playerName, null),
          playerName: e.playerName,
          points: e.points,
          wins: e.wins,
          losses: e.losses,
          tournamentWins: e.tournamentWins,
          avatarUrl: e.avatarUrl || imageResolver(e.playerName, null),
        })),
      )
      .catch(() => []),
    getHomeRankingBoards(seasonNum, RANKING_TOP).catch(() => ({
      wb: [],
      satr: [],
      stardust: [],
    })),
  ]);

  return [
    {
      key: "global",
      label: "Global",
      sublabel: `Classement officiel BTS · ${seasonLabel}`,
      color: "var(--rpb-primary)",
      href: "/rankings",
      entries: bts,
    },
    {
      key: "wb",
      label: "Wild Breakers",
      sublabel: `Circuit Wild Breakers · ${seasonLabel}`,
      color: "#a78bfa",
      href: "/tournaments/wb",
      entries: boards.wb.map(normalizeDbRow),
    },
    {
      key: "satr",
      label: "SATR",
      sublabel: `Circuit SATR · ${seasonLabel}`,
      color: "var(--rpb-secondary)",
      href: "/tournaments/satr",
      entries: boards.satr.map(normalizeDbRow),
    },
    {
      key: "stardust",
      label: "Stardust",
      sublabel: "Circuit Stardust",
      color: "#60A5FA",
      href: "/tournaments/stardust",
      entries: boards.stardust.map(normalizeDbRow),
    },
  ];
}

export default async function HomePage() {
  const activeSeason = await getCurrentSeason();
  const [activeTournament, heroContent, rankingBoards, metaParts, recentVideos, tournaments] =
    await Promise.all([
      getActiveHomeTournament(),
      getContent("home-hero-text"),
      getRankingBoards(activeSeason),
      getTopMetaParts(),
      getFeaturedHomeVideos(12).catch(() => []),
      getAllTournamentsForHome(),
    ]);

  return (
    <HomeClient
      activeTournament={activeTournament}
      heroContent={heroContent?.content}
      rankingBoards={rankingBoards}
      metaParts={metaParts}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recentVideos={recentVideos as any}
      tournaments={tournaments}
    />
  );
}
