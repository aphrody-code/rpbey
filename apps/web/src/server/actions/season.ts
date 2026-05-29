"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth-utils";
import {
  archiveSeason,
  createSeason as createSeasonDal,
  getCurrentSeason as getCurrentSeasonDal,
  getSeasonStandings as getSeasonStandingsDal,
  listSeasons,
} from "@/server/dal/cms";

// Zod Schemas
const CreateSeasonSchema = z.object({
  name: z.string().min(3),
  slug: z
    .string()
    .min(3)
    .regex(/^[a-z0-9-]+$/),
});

const ArchiveSeasonSchema = z.object({
  nextSeasonName: z.string().min(3),
  nextSeasonSlug: z
    .string()
    .min(3)
    .regex(/^[a-z0-9-]+$/),
});

// Cached Data Fetching
export async function getCurrentSeason() {
  return getCurrentSeasonDal();
}

export async function getSeasons() {
  return listSeasons();
}

export async function getSeasonStandings(slug: string) {
  return getSeasonStandingsDal(slug);
}

// Mutations
export async function createSeason(name: string, slug: string) {
  if (!(await requireAdmin())) throw new Error("Forbidden");
  const result = CreateSeasonSchema.safeParse({ name, slug });
  if (!result.success) {
    throw new Error(`Invalid input: ${result.error.message}`);
  }

  const season = await createSeasonDal(name, slug);
  revalidatePath("/admin/rankings");
  return season;
}

export async function archiveCurrentSeason(nextSeasonName: string, nextSeasonSlug: string) {
  if (!(await requireAdmin())) throw new Error("Forbidden");
  const result = ArchiveSeasonSchema.safeParse({
    nextSeasonName,
    nextSeasonSlug,
  });
  if (!result.success) {
    throw new Error(`Invalid input: ${result.error.message}`);
  }

  const currentSeason = await getCurrentSeasonDal();
  if (!currentSeason) {
    throw new Error("Aucune saison active à archiver.");
  }

  await archiveSeason({
    currentSeasonId: currentSeason.id,
    currentSeasonStartDate: currentSeason.startDate,
    nextSeasonName,
    nextSeasonSlug,
  });

  revalidatePath("/admin/rankings");
  return { success: true };
}
