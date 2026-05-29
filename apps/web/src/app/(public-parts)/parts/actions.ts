"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-utils";
import { type Part, type PartType } from "@/lib/types";
import * as partsDal from "@/server/dal/parts";

export async function getPartsStats() {
  return partsDal.getPartsStats();
}

export async function getParts(
  search?: string,
  page = 1,
  filters?: {
    type?: PartType;
    system?: string;
    beyType?: string;
    missingImage?: boolean;
  },
) {
  return partsDal.listAdminParts(search, page, filters);
}

export async function upsertPart(data: Partial<Part>) {
  if (!(await requireAdmin())) throw new Error("Forbidden");
  if (!data.name || !data.type) throw new Error("Name and Type are required");

  await partsDal.upsertPart(data);

  revalidatePath("/parts");
  return { success: true };
}

export async function deletePart(id: string) {
  if (!(await requireAdmin())) throw new Error("Forbidden");
  await partsDal.deletePart(id);
  revalidatePath("/parts");
}

export async function bulkImportParts(
  partsData: Partial<Part>[],
): Promise<{ created: number; updated: number; errors: string[] }> {
  if (!(await requireAdmin())) throw new Error("Forbidden");

  const result = await partsDal.bulkImportParts(partsData);

  revalidatePath("/parts");
  return result;
}

export async function duplicatePart(id: string) {
  if (!(await requireAdmin())) throw new Error("Forbidden");
  await partsDal.duplicatePart(id);
  revalidatePath("/parts");
  return { success: true };
}

// Beyblades management
export async function getBeyblades(search?: string) {
  return partsDal.listBeyblades(search);
}

export async function upsertBeyblade(data: {
  id?: string;
  code: string;
  name: string;
  nameEn?: string;
  nameFr?: string;
  bladeId: string;
  ratchetId: string;
  bitId: string;
  beyType?: string;
  imageUrl?: string;
}) {
  if (!(await requireAdmin())) throw new Error("Forbidden");

  await partsDal.upsertBeyblade(data);

  revalidatePath("/parts");
  return { success: true };
}

export async function deleteBeyblade(id: string) {
  if (!(await requireAdmin())) throw new Error("Forbidden");
  await partsDal.deleteBeyblade(id);
  revalidatePath("/parts");
}

// Products management
export async function getProducts(search?: string) {
  return partsDal.listProducts(search);
}
