#!/usr/bin/env bun
import { prisma } from "../src/lib/prisma";
import { syncStardustRankingsToDb } from "../src/lib/stardust-sync-bts";

const r = await syncStardustRankingsToDb(prisma);
console.log(JSON.stringify(r, null, 2));
await prisma.$disconnect();
