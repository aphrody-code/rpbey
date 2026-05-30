/**
 * Smoke test runtime de la DAL équipes (création → lecture → invitation → chat →
 * leave), exécuté contre la vraie base locale. Nettoie tout en fin de course.
 * Lancer : `cd apps/web && bun scripts/smoke-teams.ts`
 */
import { db, schema, eq, isNull } from "@/lib/db";
import {
  createTeam,
  getTeamBySlug,
  getMyTeam,
  inviteToTeam,
  respondToInvite,
  postMessage,
  getMessages,
  leaveTeam,
  recomputeTeamStats,
} from "@/server/dal/teams";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
  console.log(`  ok: ${msg}`);
}

async function main() {
  // Deux utilisateurs sans équipe pour le test.
  const free = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .leftJoin(schema.teamMembers, eq(schema.teamMembers.userId, schema.users.id))
    .where(isNull(schema.teamMembers.id))
    .limit(2);
  if (free.length < 2) {
    console.log("Pas assez d'utilisateurs libres pour le smoke — skip.");
    return;
  }
  const [captain, recruit] = [free[0]!.id, free[1]!.id];
  let teamId: string | null = null;

  try {
    const team = await createTeam(captain, {
      name: "Smoke Test Clan",
      tag: "SMK99",
      description: "Équipe de test temporaire.",
      region: "Île-de-France",
      isRecruiting: true,
    });
    teamId = team.id;
    assert(team.tag === "SMK99", "tag normalisé en majuscules");
    assert(team.members.length === 1, "capitaine ajouté comme membre");
    assert(team.members[0]!.role === "CAPTAIN", "rôle capitaine");
    assert(team.isPublic === false, "équipe privée tant que < 3 membres");

    const fetched = await getTeamBySlug(team.slug);
    assert(fetched.team?.id === team.id, "getTeamBySlug retrouve l'équipe");

    const mine = await getMyTeam(captain);
    assert(mine?.role === "CAPTAIN", "getMyTeam retourne le rôle");

    await inviteToTeam(captain, team.id, recruit, "Rejoins-nous !");
    const inviteRow = await db.query.teamInvites.findFirst({
      where: eq(schema.teamInvites.userId, recruit),
    });
    assert(!!inviteRow, "invitation créée");

    const res = await respondToInvite(recruit, inviteRow!.id, true);
    assert(res.teamSlug === team.slug, "invitation acceptée → slug renvoyé");

    await recomputeTeamStats(team.id);
    const after = await getTeamBySlug(team.slug);
    assert(after.team?.memberCount === 2, "memberCount = 2 après acceptation");

    const msg = await postMessage(captain, team.id, {
      content: "Bienvenue dans le clan !",
      kind: "TEXT",
      refId: null,
    });
    assert(msg.content === "Bienvenue dans le clan !", "message posté");
    const msgs = await getMessages(team.id, { limit: 20 });
    assert(msgs.messages.length === 1, "message lisible dans le chat");

    await leaveTeam(recruit);
    await leaveTeam(captain); // dernier membre → dissolution
    const gone = await db.query.teams.findFirst({ where: eq(schema.teams.id, team.id) });
    assert(!gone, "équipe dissoute quand le dernier membre part");
    teamId = null;

    console.log("\nSMOKE TEAMS: OK");
  } finally {
    if (teamId) {
      await db.delete(schema.teams).where(eq(schema.teams.id, teamId));
      console.log("(cleanup) équipe de test supprimée");
    }
    await db.$client.end();
  }
}

main().catch((e) => {
  console.error("SMOKE TEAMS: FAILED");
  console.error(e);
  process.exit(1);
});
