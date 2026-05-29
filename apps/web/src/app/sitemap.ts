import fs from "node:fs";
import path from "node:path";
import { type MetadataRoute } from "next";
import { db, schema, asc, desc, eq } from "@/lib/db";

export const dynamic = "force-dynamic";

// MIGRATED from: export const revalidate = 3600;
// → Dynamic by default with Cache Components.
const STATIC_ROUTES: Record<
  string,
  { file: string; priority: number; freq: "daily" | "weekly" | "monthly" }
> = {
  "": { file: "src/app/(marketing)/page.tsx", priority: 1, freq: "daily" },
  "/rankings": {
    file: "src/app/(marketing)/rankings/page.tsx",
    priority: 0.9,
    freq: "daily",
  },
  "/tournaments": {
    file: "src/app/(marketing)/tournaments/page.tsx",
    priority: 0.9,
    freq: "daily",
  },
  "/meta": {
    file: "src/app/(marketing)/meta/page.tsx",
    priority: 0.8,
    freq: "weekly",
  },
  "/tv": {
    file: "src/app/(marketing)/tv/page.tsx",
    priority: 0.7,
    freq: "daily",
  },
  "/anime": {
    file: "src/app/(marketing)/anime/page.tsx",
    priority: 0.7,
    freq: "weekly",
  },
  "/builder": {
    file: "src/app/(marketing)/builder/page.tsx",
    priority: 0.7,
    freq: "weekly",
  },
  "/comparateur": {
    file: "src/app/(marketing)/comparateur/page.tsx",
    priority: 0.8,
    freq: "daily",
  },
  "/notre-equipe": {
    file: "src/app/(marketing)/notre-equipe/page.tsx",
    priority: 0.5,
    freq: "monthly",
  },
  "/reglement": {
    file: "src/app/(marketing)/reglement/page.tsx",
    priority: 0.4,
    freq: "monthly",
  },
  "/privacy": {
    file: "src/app/(marketing)/privacy/page.tsx",
    priority: 0.3,
    freq: "monthly",
  },
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://rpbey.fr";
  const cwd = process.cwd();

  // Static routes with actual file modification times
  const routes = Object.entries(STATIC_ROUTES).map(([route, config]) => {
    let lastModified = new Date();
    try {
      const fullPath = path.join(cwd, config.file);
      const stats = fs.statSync(fullPath);
      lastModified = stats.mtime;
    } catch {
      console.warn(`Could not get stats for ${config.file}, using current date.`);
    }

    return {
      url: `${baseUrl}${route}`,
      lastModified,
      changeFrequency: config.freq,
      priority: config.priority,
    };
  });

  // Dynamic Tournaments
  let tournamentRoutes: MetadataRoute.Sitemap = [];
  try {
    const tournaments = await db.query.tournaments.findMany({
      columns: { id: true, updatedAt: true },
      orderBy: desc(schema.tournaments.updatedAt),
      limit: 1000,
    });

    tournamentRoutes = tournaments.map((tournament) => ({
      url: `${baseUrl}/tournaments/${tournament.id}`,
      lastModified: tournament.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));
  } catch (error) {
    console.warn("Failed to fetch tournaments for sitemap:", error);
  }

  // Dynamic Profiles (Publicly visible)
  let profileRoutes: MetadataRoute.Sitemap = [];
  try {
    const profiles = await db.query.profiles.findMany({
      columns: { userId: true, updatedAt: true },
      orderBy: desc(schema.profiles.updatedAt),
      limit: 1000,
    });

    profileRoutes = profiles.map((profile) => ({
      url: `${baseUrl}/profile/${profile.userId}`,
      lastModified: profile.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    }));
  } catch (error) {
    console.warn("Failed to fetch profiles for sitemap:", error);
  }

  // Dynamic Anime Series & Episodes
  const animeRoutes: MetadataRoute.Sitemap = [];
  try {
    const series = await db.query.animeSeries.findMany({
      where: eq(schema.animeSeries.isPublished, true),
      columns: { slug: true, updatedAt: true },
      with: {
        animeEpisodes: {
          columns: { number: true, updatedAt: true },
          orderBy: asc(schema.animeEpisodes.number),
        },
      },
    });

    for (const s of series) {
      animeRoutes.push({
        url: `${baseUrl}/anime/${s.slug}`,
        lastModified: s.updatedAt,
        changeFrequency: "weekly",
        priority: 0.6,
      });
      for (const ep of s.animeEpisodes) {
        animeRoutes.push({
          url: `${baseUrl}/anime/${s.slug}/${ep.number}`,
          lastModified: ep.updatedAt,
          changeFrequency: "monthly",
          priority: 0.5,
        });
      }
    }
  } catch (error) {
    console.warn("Failed to fetch anime for sitemap:", error);
  }

  // Dynamic — pages produits du comparateur Beyblade X (SEO long-tail)
  let comparatorRoutes: MetadataRoute.Sitemap = [];
  try {
    const { loadCatalog, computeGroups, groupSlug } = await import("@/lib/bx-catalog");
    const catalog = await loadCatalog();
    if (catalog) {
      const lastModified = catalog.generatedAt ? new Date(catalog.generatedAt) : new Date();
      comparatorRoutes = computeGroups(catalog).map((g) => ({
        url: `${baseUrl}/comparateur/${groupSlug(g)}`,
        lastModified,
        changeFrequency: "daily" as const,
        priority: 0.6,
      }));
    }
  } catch (error) {
    console.warn("Failed to build comparator sitemap:", error);
  }

  return [...routes, ...tournamentRoutes, ...profileRoutes, ...animeRoutes, ...comparatorRoutes];
}
