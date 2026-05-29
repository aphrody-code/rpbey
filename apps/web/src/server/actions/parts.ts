"use server";

import {
  getPartsByExternalIds as dalGetPartsByExternalIds,
  listPublicParts,
  type PartsFilter,
} from "@/server/dal/parts";

/** Catalogue public filtré + paginé (builder). Délègue à la DAL. */
export async function getPublicParts(params: PartsFilter) {
  return listPublicParts(params);
}

/** Résout des externalIds → lignes Part (décodeur de share-link du builder). */
export async function getPartsByExternalIds(externalIds: string[]) {
  return dalGetPartsByExternalIds(externalIds);
}
