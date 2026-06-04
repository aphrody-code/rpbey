import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/seo/JsonLd";
import { generateBreadcrumbJsonLd, generateEventJsonLd } from "@/lib/seo-utils";
import TournamentDetail, { type TournamentData } from "./_components/TournamentDetail";
import { getTournamentById } from "./_lib/getTournament";
import { loadJsonSafe, loadText } from "@/lib/data-cache";
import type { ScrapedTournament } from "@/lib/brackets/challonge";
import { challongeToViewerData } from "@/lib/brackets/challonge";
import type { ViewerData } from "@rose-griffon/challonge-core/viewer";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

function buildMetaDescription(
  name: string,
  description: string | null,
  formattedDate: string | null,
  participantCount: number,
): string {
  if (description) return description;
  const parts = [`Tournoi ${name}`];
  if (formattedDate) parts.push(`le ${formattedDate}`);
  if (participantCount > 0)
    parts.push(`${participantCount} participant${participantCount > 1 ? "s" : ""}`);
  parts.push("organisé par la RPB");
  return `${parts.join(" - ")}.`;
}

/**
 * Convert a value to a valid ISO string, or fallback when the date is
 * invalid/missing. Avoids `RangeError: Invalid time value` from `.toISOString()`
 * on bad data (eg `data.scrapedAt = null` for BTS exports).
 */
function safeIso(value: Date | string | null | undefined, fallback?: string): string {
  if (value == null) return fallback ?? new Date().toISOString();
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return fallback ?? new Date().toISOString();
  return d.toISOString();
}

function formatLongDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatShortDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// Prisma TournamentStatus → JsonLd Event status. Keep in sync with schema.prisma.
const STATUS_TO_EVENT_STATE: Record<string, "upcoming" | "active" | "complete" | "cancelled"> = {
  UPCOMING: "upcoming",
  REGISTRATION_OPEN: "upcoming",
  REGISTRATION_CLOSED: "upcoming",
  CHECKIN: "active",
  UNDERWAY: "active",
  COMPLETE: "complete",
  CANCELLED: "cancelled",
  ARCHIVED: "complete",
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const tournament = await getTournamentById(id);

  if (!tournament) {
    return {
      title: "Tournoi non trouvé",
      description: "Ce tournoi est introuvable ou a été supprimé.",
    };
  }

  const formattedDate = tournament.date ? formatShortDate(tournament.date) : null;
  const participantCount = Array.isArray(tournament.standings) ? tournament.standings.length : 0;
  const description = buildMetaDescription(
    tournament.name,
    tournament.description ?? null,
    formattedDate,
    participantCount,
  );

  return {
    title: tournament.name,
    description,
    keywords: [
      tournament.name,
      "tournoi Beyblade X",
      "RPB",
      "compétition",
      "classement",
      tournament.location ?? "France",
    ].filter(Boolean) as string[],
    alternates: {
      canonical: `https://rpbey.fr/tournaments/${id}`,
    },
    openGraph: {
      type: "website",
      locale: "fr_FR",
      url: `https://rpbey.fr/tournaments/${id}`,
      siteName: "RPB - République Populaire du Beyblade",
      title: `${tournament.name} | RPB`,
      description,
      images: [{ url: "/banner.webp", width: 1200, height: 630, alt: tournament.name }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${tournament.name} | RPB`,
      description,
      images: ["/banner.webp"],
    },
  };
}

export default async function TournamentDetailPage({ params }: PageProps) {
  const { id } = await params;
  const tournament = await getTournamentById(id);
  if (!tournament) notFound();

  const formattedDate = tournament.date ? formatLongDate(tournament.date) : "Date non définie";

  const tournamentData: TournamentData = {
    id: tournament.id,
    name: tournament.name,
    status: tournament.status,
    description: tournament.description,
    date: safeIso(tournament.date),
    location: tournament.location,
    format: tournament.format,
    maxPlayers: tournament.maxPlayers,
    challongeId: tournament.challongeId,
    challongeUrl: tournament.challongeUrl,
    posterUrl: "posterUrl" in tournament ? (tournament.posterUrl ?? null) : null,
    updatedAt: safeIso(tournament.updatedAt),
    category:
      "category" in tournament && tournament.category
        ? {
            id: tournament.category.id,
            name: tournament.category.name,
            color: tournament.category.color ?? null,
            logoUrl: tournament.category.logoUrl ?? null,
          }
        : null,
  };

  const initialLiveData = {
    standings: (tournament.standings ?? []) as unknown[],
    stations: (tournament.stations ?? []) as unknown[],
    activityLog: (tournament.activityLog ?? []) as unknown[],
    lastUpdated: safeIso(tournament.updatedAt),
  };

  // --- Hybride Mirror Data ---
  let mirrorHtml: string | null = null;
  let mirrorData: ViewerData | null = null;

  // Si c'est un BTS, on tente de charger le miroir HTML + Max Data
  const isBtsSlug = id.toLowerCase().startsWith("bts");
  if (isBtsSlug) {
    const btsKey = id.toUpperCase();
    try {
      // Path example: data/mirror/BTS5/challonge.com/B_TS5/module
      const btsNumber = btsKey.replace("BTS", "");
      mirrorHtml = await loadText(`data/mirror/${btsKey}/challonge.com/B_TS${btsNumber}/module`);
      const fullStore = await loadJsonSafe<ScrapedTournament>(`data/exports/B_TS${btsNumber}.json`);
      if (fullStore) {
        mirrorData = challongeToViewerData(fullStore);
      }
    } catch (e) {
      console.warn(`[Mirror] Failed to load mirror for ${id}:`, e);
    }
  }

  return (
    <>
      <JsonLd
        data={generateEventJsonLd({
          name: tournament.name,
          description: tournament.description ?? undefined,
          date: safeIso(tournament.date),
          location: tournament.location ?? undefined,
          url: `/tournaments/${tournament.id}`,
          maxAttendees: tournament.maxPlayers,
          status: STATUS_TO_EVENT_STATE[tournament.status] ?? "upcoming",
        })}
      />
      <JsonLd
        data={generateBreadcrumbJsonLd([
          { name: "Accueil", item: "/" },
          { name: "Tournois", item: "/tournaments" },
          { name: tournament.name, item: `/tournaments/${tournament.id}` },
        ])}
      />
      <TournamentDetail
        tournament={tournamentData}
        formattedDate={formattedDate}
        initialLiveData={initialLiveData}
        mirrorHtml={mirrorHtml ?? undefined}
        mirrorData={mirrorData ?? undefined}
      />
    </>
  );
}
