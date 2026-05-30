/**
 * Smoke runtime DAL sondages/tier lists (vote + agrégat tier), votant anonyme de
 * test, nettoyage en fin. Lancer :
 *   cd apps/web && bun --preload ./scripts/_preload-server-only.ts scripts/smoke-polls.ts
 */
import { db, schema } from "@rpbey/db";
import { eq, sql } from "drizzle-orm";
import {
  getPoll,
  getTierList,
  listPolls,
  listTierLists,
  submitTierList,
  votePoll,
} from "@/server/dal/polls";

const ANON = "smoke-anon-polls";
function assert(c: unknown, m: string) {
  if (!c) throw new Error(`ASSERT FAILED: ${m}`);
  console.log(`  ok: ${m}`);
}

async function main() {
  try {
    const polls = await listPolls({ page: 1, pageSize: 50 });
    assert(polls.items.length >= 6, `listPolls renvoie des sondages (${polls.items.length})`);
    const awards = polls.items.filter((p) => p.category === "Beyblade Awards France 2025");
    assert(awards.length === 20, `20 catégories Awards présentes (${awards.length})`);

    const target = awards[0]!;
    const before = await getPoll(target.slug, { anonId: ANON });
    assert(before.poll?.options.length! >= 2, "poll détail a des options");
    const opt = before.poll!.options[0]!.id;

    await votePoll(target.slug, { anonId: ANON }, [opt]);
    const after = await getPoll(target.slug, { anonId: ANON });
    assert(after.poll!.votedOptionIds.includes(opt), "vote enregistré (votedOptionIds)");
    assert(after.poll!.totalVotes >= 1, "totalVotes incrémenté");
    assert(
      after.poll!.options.find((o) => o.id === opt)!.voteCount >= 1,
      "voteCount option incrémenté",
    );

    const tls = await listTierLists({ page: 1, pageSize: 50 });
    assert(tls.items.length >= 9, `listTierLists renvoie les tier lists (${tls.items.length})`);
    const tl = await getTierList(tls.items[0]!.slug, { anonId: ANON });
    assert(tl.tierList!.subjects.length >= 3, "tier list a des sujets");
    const subs = tl.tierList!.subjects.slice(0, 3);

    await submitTierList(tl.tierList!.slug, { anonId: ANON }, [
      { subjectId: subs[0]!.id, tier: "S" },
      { subjectId: subs[1]!.id, tier: "B" },
      { subjectId: subs[2]!.id, tier: "F" },
    ]);
    const tlAfter = await getTierList(tl.tierList!.slug, { anonId: ANON });
    assert(tlAfter.tierList!.myPlacements[subs[0]!.id] === "S", "placement S enregistré");
    assert(tlAfter.tierList!.community.length >= 3, "agrégat communautaire calculé");
    assert(tlAfter.tierList!.totalSubmissions >= 1, "totalSubmissions incrémenté");

    console.log("\nSMOKE POLLS: OK");
  } finally {
    // Nettoyage du votant de test puis recompte global depuis les tables nettoyées.
    await db.delete(schema.pollVotes).where(eq(schema.pollVotes.anonId, ANON));
    await db.delete(schema.tierListVotes).where(eq(schema.tierListVotes.anonId, ANON));
    await db.execute(
      sql`update poll_options set "voteCount" = (select count(*) from poll_votes where poll_votes."optionId" = poll_options.id)`,
    );
    await db.execute(
      sql`update polls set "totalVotes" = (select count(distinct coalesce(poll_votes."userId", poll_votes."anonId")) from poll_votes where poll_votes."pollId" = polls.id)`,
    );
    await db.execute(
      sql`update tier_lists set "totalSubmissions" = (select count(distinct coalesce(tier_list_votes."userId", tier_list_votes."anonId")) from tier_list_votes where tier_list_votes."tierListId" = tier_lists.id)`,
    );
    console.log("(cleanup) votant de test supprimé, compteurs recalculés");
    await db.$client.end();
  }
}

main().catch((e) => {
  console.error("SMOKE POLLS: FAILED");
  console.error(e);
  process.exit(1);
});
