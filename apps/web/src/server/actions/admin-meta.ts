"use server";

import { getMetaStats as getMetaStatsDal } from "@/server/dal/cms";

export async function getMetaStats() {
  return getMetaStatsDal();
}
