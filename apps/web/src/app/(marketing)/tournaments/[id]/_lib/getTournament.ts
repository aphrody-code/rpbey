import { redirect } from "next/navigation";
import { loadJsonSafe } from "@/lib/data-cache";
import { getMarketingTournament } from "@/server/dal/tournaments";

/** Minimal shape shared between "max" (ScrapedTournament) and legacy BTS JSON exports. */
interface BtsExportParticipant {
  id: number;
  name: string;
  seed?: number;
  finalRank?: number | null;
  /** Present in legacy exports as flat `rank` field. */
  rank?: number;
}

interface BtsExportMetadata {
  id: number;
  type: string;
  participantsCount: number;
  url: string;
  startedAt: string | null;
  completedAt: string | null;
}

interface BtsExportData {
  metadata?: BtsExportMetadata;
  participants?: BtsExportParticipant[];
  scrapedAt?: string;
  url?: string;
}

const BTS_META: Record<string, { file: string; name: string; desc: string; date: string }> = {
  bts1: {
    file: "B_TS1.json",
    name: "Bey-Tamashii Séries #1",
    desc: "Première édition des Bey-Tamashii Séries au Dernier Bar avant la Fin du Monde.",
    date: "2026-01-11",
  },
  bts2: {
    file: "B_TS2.json",
    name: "Bey-Tamashii Séries #2",
    desc: "Deuxième édition des Bey-Tamashii Séries.",
    date: "2026-02-08",
  },
  bts3: {
    file: "B_TS3.json",
    name: "Bey-Tamashii Séries #3",
    desc: "Troisième édition des Bey-Tamashii Séries au Dernier Bar avant la Fin du Monde.",
    date: "2026-03-01",
  },
  bts4: {
    file: "B_TS4.json",
    name: "Bey-Tamashii Séries #4",
    desc: "Quatrième édition des Bey-Tamashii Séries au Dernier Bar avant la Fin du Monde.",
    date: "2026-04-26",
  },
  bts5: {
    file: "B_TS5.json",
    name: "Bey-Tamashii Séries #5",
    desc: "Cinquième édition des Bey-Tamashii Séries, première de la saison 2.",
    date: "2026-05-10",
  },
};

export type ResolvedTournament = NonNullable<Awaited<ReturnType<typeof getTournamentById>>>;

export async function getTournamentById(id: string) {
  const meta = BTS_META[id];
  if (meta) {
    const data = await loadJsonSafe<BtsExportData>(`data/exports/${meta.file}`);
    if (data) {
      const md = data.metadata;
      const participants: BtsExportParticipant[] = data.participants ?? [];
      const standings = participants
        .map((p) => ({
          rank: p.finalRank ?? p.rank ?? 0,
          name: p.name,
        }))
        .filter((p) => p.rank > 0)
        .sort((a, b) => a.rank - b.rank);

      const updatedAtStr = md
        ? (md.completedAt ?? md.startedAt ?? meta.date)
        : (data.scrapedAt ?? meta.date);

      return {
        id,
        name: meta.name,
        status: "COMPLETE" as const,
        description: meta.desc,
        date: new Date(meta.date),
        location: "Dernier Bar avant la Fin du Monde, Paris",
        format: md ? md.type : "3on3 Double Elimination",
        maxPlayers: md ? md.participantsCount : 128,
        challongeId: md ? String(md.id) : id,
        challongeUrl: (md ? md.url : data.url) ?? null,
        posterUrl: null as string | null,
        standings,
        stations: [] as unknown[],
        activityLog: [] as unknown[],
        updatedAt: new Date(updatedAtStr),
        category: null as null | {
          id: string;
          name: string;
          color: string | null;
          logoUrl: string | null;
        },
      };
    }
  }

  const dbTournament = await getMarketingTournament(id);

  // Si le record DB est un BTS dont on a déjà l'export JSON (slug bts<N>),
  // rediriger vers le slug canonique (évite doublon CUID + bracket vide).
  if (dbTournament) {
    const dbName = dbTournament.name.toLowerCase();
    for (const [slug, meta] of Object.entries(BTS_META)) {
      if (meta.name.toLowerCase() === dbName && slug !== id) {
        redirect(`/tournaments/${slug}`);
      }
    }
  }

  return dbTournament;
}
