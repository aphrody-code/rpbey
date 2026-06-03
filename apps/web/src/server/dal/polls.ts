import "server-only";
import { and, count, db, desc, eq, inArray, isNotNull, or, schema, sql } from "@/lib/db";
import { SUPERADMIN_DISCORD_IDS } from "@/lib/constants";
import type { AwardLeader } from "@/components/polls/shared";
import type {
  AdminContentResponse,
  AwardsEdition,
  AwardsEditionUpdateInput,
  DiscordMember,
  PollAdminUpdateInput,
  PollCreateInput,
  XMember,
  PollDetailResponse,
  PollsListQuery,
  PollsListResponse,
  PollSummary,
  Tier,
  TierAggregate,
  TierListCreateInput,
  TierListDetailResponse,
  TierListsListQuery,
  TierListsListResponse,
  TierListSummary,
} from "@rpbey/api-contract";

/**
 * DAL — sondages (vote type Google Forms) + tier lists communautaires.
 * SEUL endroit autorisé à importer `@rpbey/db` pour ce domaine. UI-agnostic.
 * Le « votant » est soit un compte (`userId`), soit un anonyme (`anonId`, cookie).
 */

export class PollError extends Error {
  constructor(
    readonly code: "not_found" | "closed" | "invalid",
    message: string,
  ) {
    super(message);
    this.name = "PollError";
  }
}

export interface Voter {
  userId?: string | null;
  anonId?: string | null;
}

const TIER_SCORE: Record<Tier, number> = { S: 6, A: 5, B: 4, C: 3, D: 2, F: 1 };
const TIERS_ORDER: Tier[] = ["S", "A", "B", "C", "D", "F"];

function scoreToTier(score: number): Tier {
  // 6→S, 5→A, … 1→F (arrondi, borné).
  const idx = Math.min(5, Math.max(0, Math.round(6 - score)));
  return TIERS_ORDER[idx]!;
}

function toIso(v: Date | string | null | undefined): string | null {
  if (v == null) return null;
  return v instanceof Date ? v.toISOString() : v;
}
function nowIso() {
  return new Date().toISOString();
}

type Col = Parameters<typeof eq>[0];
function voterCond(userIdCol: Col, anonIdCol: Col, voter: Voter) {
  if (voter.userId) return eq(userIdCol, voter.userId);
  if (voter.anonId) return eq(anonIdCol, voter.anonId);
  return null;
}

// --- Sondages ---------------------------------------------------------------------

function pollSummary(row: typeof schema.polls.$inferSelect, optionCount: number): PollSummary {
  return {
    id: row.id,
    slug: row.slug,
    question: row.question,
    description: row.description,
    kind: row.kind as PollSummary["kind"],
    category: row.category,
    season: row.season,
    imageUrl: row.imageUrl,
    isFeatured: row.isFeatured,
    isClosed: row.isClosed,
    totalVotes: row.totalVotes,
    optionCount,
    createdAt: toIso(row.createdAt),
  };
}

export async function listPolls(
  query: PollsListQuery,
  opts: { includeUnpublished?: boolean } = {},
): Promise<PollsListResponse> {
  const { page, pageSize, category, season, featured } = query;
  const filters = [];
  if (!opts.includeUnpublished) {
    filters.push(eq(schema.polls.isPublished, true));
    // Public : on ne montre QUE les sondages créés par un admin/superadmin
    // (les sondages d'origine non-admin / seed / null sont masqués).
    const adminUsers = db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(
        or(
          inArray(schema.users.role, ["admin", "superadmin"]),
          inArray(schema.users.discordId, [...SUPERADMIN_DISCORD_IDS]),
        ),
      );
    filters.push(inArray(schema.polls.createdById, adminUsers));
  }
  if (category) filters.push(eq(schema.polls.category, category));
  if (season) filters.push(eq(schema.polls.season, season as never));
  if (featured !== undefined) filters.push(eq(schema.polls.isFeatured, featured));
  const where = filters.length ? and(...filters) : undefined;

  const [rows, totalRow] = await Promise.all([
    db
      .select()
      .from(schema.polls)
      .where(where)
      .orderBy(
        desc(schema.polls.isFeatured),
        desc(schema.polls.totalVotes),
        desc(schema.polls.createdAt),
      )
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ value: count() }).from(schema.polls).where(where),
  ]);

  const counts = rows.length
    ? await db
        .select({ pollId: schema.pollOptions.pollId, n: count() })
        .from(schema.pollOptions)
        .where(
          inArray(
            schema.pollOptions.pollId,
            rows.map((r) => r.id),
          ),
        )
        .groupBy(schema.pollOptions.pollId)
    : [];
  const countMap = new Map(counts.map((c) => [c.pollId, Number(c.n)]));

  const total = totalRow[0]?.value ?? 0;
  return {
    items: rows.map((r) => pollSummary(r, countMap.get(r.id) ?? 0)),
    pagination: { total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) },
  };
}

export async function getPoll(slug: string, voter: Voter): Promise<PollDetailResponse> {
  const row = await db.query.polls.findFirst({
    where: eq(schema.polls.slug, slug),
    with: { options: true },
  });
  if (!row) return { poll: null };

  const total = row.totalVotes;
  const options = [...row.options]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((o) => ({
      id: o.id,
      label: o.label,
      imageUrl: o.imageUrl,
      voteCount: o.voteCount,
      percent: total > 0 ? Math.round((o.voteCount / total) * 100) : 0,
    }));

  let votedOptionIds: string[] = [];
  const vc = voterCond(schema.pollVotes.userId, schema.pollVotes.anonId, voter);
  if (vc) {
    const mine = await db
      .select({ optionId: schema.pollVotes.optionId })
      .from(schema.pollVotes)
      .where(and(eq(schema.pollVotes.pollId, row.id), vc));
    votedOptionIds = mine.map((m) => m.optionId);
  }

  return {
    poll: {
      ...pollSummary(row, options.length),
      options,
      votedOptionIds,
    },
  };
}

export async function votePoll(slug: string, voter: Voter, optionIds: string[]): Promise<void> {
  if (!voter.userId && !voter.anonId) throw new PollError("invalid", "Votant non identifié.");
  const poll = await db.query.polls.findFirst({
    where: eq(schema.polls.slug, slug),
    with: { options: { columns: { id: true } } },
  });
  if (!poll) throw new PollError("not_found", "Sondage introuvable.");
  if (poll.isClosed) throw new PollError("closed", "Ce sondage est clôturé.");

  const validIds = new Set(poll.options.map((o) => o.id));
  const chosen = [...new Set(optionIds)].filter((id) => validIds.has(id));
  if (chosen.length === 0) throw new PollError("invalid", "Option invalide.");
  const finalChoice =
    poll.kind === "SINGLE" || poll.kind === "RATING" ? chosen.slice(0, 1) : chosen;

  const vc = voterCond(schema.pollVotes.userId, schema.pollVotes.anonId, voter)!;
  await db.transaction(async (tx) => {
    // Remplace le vote précédent du votant pour ce sondage.
    await tx.delete(schema.pollVotes).where(and(eq(schema.pollVotes.pollId, poll.id), vc));
    await tx.insert(schema.pollVotes).values(
      finalChoice.map((optionId) => ({
        pollId: poll.id,
        optionId,
        userId: voter.userId ?? null,
        anonId: voter.anonId ?? null,
      })),
    );
  });

  await recomputePollCounts(poll.id);
}

/** Recalcule voteCount par option et totalVotes (votants distincts). */
async function recomputePollCounts(pollId: string): Promise<void> {
  const perOption = await db
    .select({ optionId: schema.pollVotes.optionId, n: count() })
    .from(schema.pollVotes)
    .where(eq(schema.pollVotes.pollId, pollId))
    .groupBy(schema.pollVotes.optionId);
  await db.transaction(async (tx) => {
    // Remise à zéro puis application des compteurs réels.
    await tx
      .update(schema.pollOptions)
      .set({ voteCount: 0 })
      .where(eq(schema.pollOptions.pollId, pollId));
    for (const r of perOption) {
      await tx
        .update(schema.pollOptions)
        .set({ voteCount: Number(r.n) })
        .where(eq(schema.pollOptions.id, r.optionId));
    }
    const distinct = await tx
      .select({
        n: sql<number>`count(distinct coalesce(${schema.pollVotes.userId}, ${schema.pollVotes.anonId}))`,
      })
      .from(schema.pollVotes)
      .where(eq(schema.pollVotes.pollId, pollId));
    await tx
      .update(schema.polls)
      .set({ totalVotes: Number(distinct[0]?.n ?? 0), updatedAt: nowIso() })
      .where(eq(schema.polls.id, pollId));
  });
}

// --- Tier lists -------------------------------------------------------------------

function tierListSummary(
  row: typeof schema.tierLists.$inferSelect,
  subjectCount: number,
): TierListSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    kind: row.kind as TierListSummary["kind"],
    season: row.season,
    imageUrl: row.imageUrl,
    isFeatured: row.isFeatured,
    totalSubmissions: row.totalSubmissions,
    subjectCount,
    createdAt: toIso(row.createdAt),
  };
}

export async function listTierLists(
  query: TierListsListQuery,
  opts: { includeUnpublished?: boolean } = {},
): Promise<TierListsListResponse> {
  const { page, pageSize, kind, season, featured } = query;
  const filters = [];
  if (!opts.includeUnpublished) filters.push(eq(schema.tierLists.isPublished, true));
  if (kind) filters.push(eq(schema.tierLists.kind, kind));
  if (season) filters.push(eq(schema.tierLists.season, season as never));
  if (featured !== undefined) filters.push(eq(schema.tierLists.isFeatured, featured));
  const where = filters.length ? and(...filters) : undefined;

  const [rows, totalRow] = await Promise.all([
    db
      .select()
      .from(schema.tierLists)
      .where(where)
      .orderBy(
        desc(schema.tierLists.isFeatured),
        desc(schema.tierLists.totalSubmissions),
        desc(schema.tierLists.createdAt),
      )
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ value: count() }).from(schema.tierLists).where(where),
  ]);

  const counts = rows.length
    ? await db
        .select({ tierListId: schema.tierListSubjects.tierListId, n: count() })
        .from(schema.tierListSubjects)
        .where(
          inArray(
            schema.tierListSubjects.tierListId,
            rows.map((r) => r.id),
          ),
        )
        .groupBy(schema.tierListSubjects.tierListId)
    : [];
  const countMap = new Map(counts.map((c) => [c.tierListId, Number(c.n)]));

  const total = totalRow[0]?.value ?? 0;
  return {
    items: rows.map((r) => tierListSummary(r, countMap.get(r.id) ?? 0)),
    pagination: { total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) },
  };
}

export async function getTierList(slug: string, voter: Voter): Promise<TierListDetailResponse> {
  const row = await db.query.tierLists.findFirst({
    where: eq(schema.tierLists.slug, slug),
    with: { subjects: true },
  });
  if (!row) return { tierList: null };

  const subjects = [...row.subjects]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((s) => ({
      id: s.id,
      label: s.label,
      imageUrl: s.imageUrl,
      refType: s.refType,
      refId: s.refId,
    }));

  // Agrégat communautaire : score moyen par sujet sur toutes les soumissions.
  const scoreCase = sql<number>`avg(case ${schema.tierListPlacements.tier}
    when 'S' then 6 when 'A' then 5 when 'B' then 4 when 'C' then 3 when 'D' then 2 else 1 end)`;
  const agg = await db
    .select({
      subjectId: schema.tierListPlacements.subjectId,
      avgScore: scoreCase,
      n: count(),
    })
    .from(schema.tierListPlacements)
    .innerJoin(schema.tierListVotes, eq(schema.tierListVotes.id, schema.tierListPlacements.voteId))
    .where(eq(schema.tierListVotes.tierListId, row.id))
    .groupBy(schema.tierListPlacements.subjectId);

  const community: TierAggregate[] = agg.map((a) => {
    const avg = Number(a.avgScore);
    return {
      subjectId: a.subjectId,
      averageScore: Math.round(avg * 100) / 100,
      communityTier: scoreToTier(avg),
      placements: Number(a.n),
    };
  });

  // Placement du visiteur courant.
  const myPlacements: Record<string, Tier> = {};
  const vc = voterCond(schema.tierListVotes.userId, schema.tierListVotes.anonId, voter);
  if (vc) {
    const myVote = await db.query.tierListVotes.findFirst({
      where: and(eq(schema.tierListVotes.tierListId, row.id), vc),
      with: { placements: true },
    });
    if (myVote) {
      for (const p of myVote.placements) myPlacements[p.subjectId] = p.tier as Tier;
    }
  }

  return {
    tierList: {
      ...tierListSummary(row, subjects.length),
      subjects,
      community,
      myPlacements,
    },
  };
}

export async function submitTierList(
  slug: string,
  voter: Voter,
  placements: { subjectId: string; tier: Tier }[],
): Promise<void> {
  if (!voter.userId && !voter.anonId) throw new PollError("invalid", "Votant non identifié.");
  const tl = await db.query.tierLists.findFirst({
    where: eq(schema.tierLists.slug, slug),
    with: { subjects: { columns: { id: true } } },
  });
  if (!tl) throw new PollError("not_found", "Tier list introuvable.");

  const validIds = new Set(tl.subjects.map((s) => s.id));
  const clean = placements.filter((p) => validIds.has(p.subjectId) && p.tier in TIER_SCORE);
  if (clean.length === 0) throw new PollError("invalid", "Aucun placement valide.");

  const vc = voterCond(schema.tierListVotes.userId, schema.tierListVotes.anonId, voter)!;
  await db.transaction(async (tx) => {
    await tx
      .delete(schema.tierListVotes)
      .where(and(eq(schema.tierListVotes.tierListId, tl.id), vc));
    const [vote] = await tx
      .insert(schema.tierListVotes)
      .values({
        tierListId: tl.id,
        userId: voter.userId ?? null,
        anonId: voter.anonId ?? null,
        updatedAt: nowIso(),
      })
      .returning();
    await tx
      .insert(schema.tierListPlacements)
      .values(clean.map((p) => ({ voteId: vote!.id, subjectId: p.subjectId, tier: p.tier })));
  });

  const subs = await db
    .select({
      n: sql<number>`count(distinct coalesce(${schema.tierListVotes.userId}, ${schema.tierListVotes.anonId}))`,
    })
    .from(schema.tierListVotes)
    .where(eq(schema.tierListVotes.tierListId, tl.id));
  await db
    .update(schema.tierLists)
    .set({ totalSubmissions: Number(subs[0]?.n ?? 0), updatedAt: nowIso() })
    .where(eq(schema.tierLists.id, tl.id));
}

// --- Administration (staff) -------------------------------------------------------

function slugify(input: string): string {
  return (
    input
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50) || "item"
  );
}

async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  let slug = base;
  for (let i = 2; await exists(slug); i++) slug = `${base}-${i}`.slice(0, 60);
  return slug;
}

/** Contenu complet pour l'admin (sondages + tier lists, sans filtre featured). */
export async function listAdminContent(): Promise<AdminContentResponse> {
  const [pollsList, tlList] = await Promise.all([
    listPolls({ page: 1, pageSize: 200 }, { includeUnpublished: true }),
    listTierLists({ page: 1, pageSize: 200 }, { includeUnpublished: true }),
  ]);
  return { polls: pollsList.items, tierLists: tlList.items };
}

export async function createPoll(input: PollCreateInput, userId: string): Promise<string> {
  const slug = await uniqueSlug(
    slugify(input.question),
    async (s) =>
      !!(await db.query.polls.findFirst({
        where: eq(schema.polls.slug, s),
        columns: { id: true },
      })),
  );
  const [poll] = await db
    .insert(schema.polls)
    .values({
      slug,
      question: input.question,
      description: input.description ?? null,
      kind: input.kind,
      category: input.category ?? null,
      season: (input.season ?? null) as never,
      imageUrl: input.imageUrl ?? null,
      isFeatured: input.isFeatured ?? false,
      createdById: userId,
      updatedAt: nowIso(),
    })
    .returning();
  await db.insert(schema.pollOptions).values(
    input.options.map((o, i) => ({
      pollId: poll!.id,
      label: o.label,
      imageUrl: o.imageUrl ?? null,
      displayOrder: i,
    })),
  );
  return slug;
}

export async function updatePollAdmin(slug: string, patch: PollAdminUpdateInput): Promise<void> {
  const set: Record<string, unknown> = { updatedAt: nowIso() };
  for (const k of ["question", "description", "category", "isFeatured", "isClosed"] as const) {
    if (patch[k] !== undefined) set[k] = patch[k];
  }
  await db.update(schema.polls).set(set).where(eq(schema.polls.slug, slug));
}

export async function deletePoll(slug: string): Promise<void> {
  await db.delete(schema.polls).where(eq(schema.polls.slug, slug));
}

export async function createTierList(input: TierListCreateInput, userId: string): Promise<string> {
  const slug = await uniqueSlug(
    slugify(input.title),
    async (s) =>
      !!(await db.query.tierLists.findFirst({
        where: eq(schema.tierLists.slug, s),
        columns: { id: true },
      })),
  );
  const [tl] = await db
    .insert(schema.tierLists)
    .values({
      slug,
      title: input.title,
      description: input.description ?? null,
      kind: input.kind,
      season: (input.season ?? null) as never,
      imageUrl: input.imageUrl ?? null,
      isFeatured: input.isFeatured ?? false,
      createdById: userId,
      updatedAt: nowIso(),
    })
    .returning();
  await db.insert(schema.tierListSubjects).values(
    input.subjects.map((s, i) => ({
      tierListId: tl!.id,
      label: s.label,
      imageUrl: s.imageUrl ?? null,
      displayOrder: i,
    })),
  );
  return slug;
}

export async function deleteTierList(slug: string): Promise<void> {
  await db.delete(schema.tierLists).where(eq(schema.tierLists.slug, slug));
}

// --- Beyblade Awards : éditions ----------------------------------------------------

function editionToContract(
  row: typeof schema.awardsEditions.$inferSelect,
  categoryCount: number,
): AwardsEdition {
  return {
    year: row.year,
    slug: row.slug,
    title: row.title,
    description: row.description,
    videoUrl: row.videoUrl,
    videoId: row.videoId,
    pollCategory: row.pollCategory,
    isPublished: row.isPublished,
    isVotingOpen: row.isVotingOpen,
    categoryCount,
    createdAt: toIso(row.createdAt),
  };
}

async function countByCategory(categories: string[]): Promise<Map<string, number>> {
  if (!categories.length) return new Map();
  const rows = await db
    .select({ category: schema.polls.category, n: count() })
    .from(schema.polls)
    .where(inArray(schema.polls.category, categories))
    .groupBy(schema.polls.category);
  return new Map(rows.map((r) => [r.category ?? "", Number(r.n)]));
}

/** Éditions publiées (page publique des Awards). */
export async function listPublishedEditions(): Promise<AwardsEdition[]> {
  const rows = await db
    .select()
    .from(schema.awardsEditions)
    .where(eq(schema.awardsEditions.isPublished, true))
    .orderBy(desc(schema.awardsEditions.year));
  const counts = await countByCategory(rows.map((r) => r.pollCategory));
  return rows.map((r) => editionToContract(r, counts.get(r.pollCategory) ?? 0));
}

/**
 * Palmarès EN TÊTE des Beyblade Awards : pour chaque sondage-award publié de la
 * `category`, l'option (nominé) la plus votée + son pourcentage. Sert la
 * prévisualisation des gagnants sur la page publique des sondages.
 */
export async function getAwardsLeaders(category: string): Promise<AwardLeader[]> {
  const pollsRows = await db
    .select({
      id: schema.polls.id,
      slug: schema.polls.slug,
      title: schema.polls.question,
      totalVotes: schema.polls.totalVotes,
    })
    .from(schema.polls)
    .where(and(eq(schema.polls.category, category), eq(schema.polls.isPublished, true)))
    .orderBy(desc(schema.polls.totalVotes), desc(schema.polls.createdAt));
  if (pollsRows.length === 0) return [];

  const opts = await db
    .select({
      pollId: schema.pollOptions.pollId,
      label: schema.pollOptions.label,
      imageUrl: schema.pollOptions.imageUrl,
      voteCount: schema.pollOptions.voteCount,
    })
    .from(schema.pollOptions)
    .where(
      inArray(
        schema.pollOptions.pollId,
        pollsRows.map((p) => p.id),
      ),
    );

  // Option la plus votée par sondage.
  const top = new Map<string, { label: string; imageUrl: string | null; voteCount: number }>();
  for (const o of opts) {
    const cur = top.get(o.pollId);
    if (!cur || o.voteCount > cur.voteCount) {
      top.set(o.pollId, { label: o.label, imageUrl: o.imageUrl, voteCount: o.voteCount });
    }
  }

  return pollsRows.map((p) => {
    const t = top.get(p.id);
    return {
      pollSlug: p.slug,
      pollTitle: p.title,
      totalVotes: p.totalVotes,
      leader: t
        ? {
            label: t.label,
            imageUrl: t.imageUrl,
            voteCount: t.voteCount,
            percent: p.totalVotes > 0 ? Math.round((t.voteCount / p.totalVotes) * 100) : 0,
          }
        : null,
    };
  });
}

/** Toutes les éditions (admin). */
export async function listAllEditions(): Promise<AwardsEdition[]> {
  const rows = await db
    .select()
    .from(schema.awardsEditions)
    .orderBy(desc(schema.awardsEditions.year));
  const counts = await countByCategory(rows.map((r) => r.pollCategory));
  return rows.map((r) => editionToContract(r, counts.get(r.pollCategory) ?? 0));
}

const YT_ID = /(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{6,})/;

export async function updateEdition(year: number, patch: AwardsEditionUpdateInput): Promise<void> {
  const set: Record<string, unknown> = { updatedAt: nowIso() };
  if (patch.title !== undefined) set.title = patch.title;
  if (patch.description !== undefined) set.description = patch.description;
  if (patch.isPublished !== undefined) set.isPublished = patch.isPublished;
  if (patch.isVotingOpen !== undefined) set.isVotingOpen = patch.isVotingOpen;
  if (patch.videoUrl !== undefined) {
    set.videoUrl = patch.videoUrl;
    set.videoId = patch.videoUrl ? (patch.videoUrl.match(YT_ID)?.[1] ?? null) : null;
  }
  await db.update(schema.awardsEditions).set(set).where(eq(schema.awardsEditions.year, year));
}

// --- Annuaire des membres (admin) -------------------------------------------------

/** Membres Discord connus (table users), filtrables par recherche. */
export async function listDiscordMembers(q: string, limit = 200): Promise<DiscordMember[]> {
  const rows = await db.query.users.findMany({
    where: isNotNull(schema.users.discordId),
    columns: {
      id: true,
      name: true,
      username: true,
      nickname: true,
      globalName: true,
      image: true,
      discordTag: true,
      roles: true,
    },
    limit: 1000,
  });
  const needle = q.trim().toLowerCase();
  const filtered = needle
    ? rows.filter((r) =>
        [r.name, r.username, r.nickname, r.globalName].some((n) =>
          n?.toLowerCase().includes(needle),
        ),
      )
    : rows;
  return filtered.slice(0, limit).map((r) => ({
    id: r.id,
    name: r.name,
    username: r.username,
    nickname: r.nickname,
    globalName: r.globalName,
    image: r.image,
    discordTag: r.discordTag,
    roles: Array.isArray(r.roles) ? r.roles.map(String) : null,
  }));
}

/** Communauté X « Beyblade France » crawlée (cf. run-community-crawl.ts). */
const X_COMMUNITY_ID = "1809671339109658814";

/**
 * Communauté X (crawl aphrody) — lecture du store `~/.aphrody/x-store.sqlite`.
 * Priorité aux MEMBRES de la communauté `community_members` (crawl dédié) ; à défaut,
 * repli sur l'index global. Avatars dynamiques (unavatar) dérivés du username côté UI.
 * Best-effort : store absent → [].
 */
export async function listXMembers(q: string, limit = 60): Promise<XMember[]> {
  try {
    const { Database } = await import("bun:sqlite");
    const os = await import("node:os");
    const path = `${process.env.HOME ?? os.homedir()}/.aphrody/x-store.sqlite`;
    const dbx = new Database(path, { readonly: true });
    const needle = `%${q.trim()}%`;

    // La table community_members existe-t-elle (crawl effectué) ?
    const hasCommunity = dbx
      .query("SELECT count(*) n FROM sqlite_master WHERE type='table' AND name='community_members'")
      .get() as { n: number };

    let rows: Array<Record<string, unknown>> = [];
    if (hasCommunity?.n) {
      const base =
        "SELECT cm.user_id id, cm.username, cm.name, cm.tweets_seen, u.followers_count " +
        "FROM community_members cm LEFT JOIN users u ON u.id = cm.user_id " +
        "WHERE cm.community_id = ?";
      rows = q.trim()
        ? (dbx
            .query(
              `${base} AND (cm.username LIKE ? OR cm.name LIKE ?) ORDER BY cm.tweets_seen DESC LIMIT ?`,
            )
            .all(X_COMMUNITY_ID, needle, needle, limit) as Array<Record<string, unknown>>)
        : (dbx
            .query(`${base} ORDER BY cm.tweets_seen DESC LIMIT ?`)
            .all(X_COMMUNITY_ID, limit) as Array<Record<string, unknown>>);
    }

    // Repli : index global X si la communauté n'a pas encore été crawlée.
    if (rows.length === 0) {
      rows = (
        q.trim()
          ? dbx
              .query(
                "SELECT id, username, name, followers_count FROM users WHERE username != '' AND (username LIKE ? OR name LIKE ?) ORDER BY followers_count DESC LIMIT ?",
              )
              .all(needle, needle, limit)
          : dbx
              .query(
                "SELECT id, username, name, followers_count FROM users WHERE username != '' ORDER BY followers_count DESC LIMIT ?",
              )
              .all(limit)
      ) as Array<Record<string, unknown>>;
    }

    dbx.close();
    return rows.map((r) => ({
      id: String(r.id),
      username: String(r.username),
      name: (r.name as string) || null,
      followers: r.followers_count != null ? Number(r.followers_count) : null,
    }));
  } catch (e) {
    console.error("[listXMembers] x-store indisponible:", e);
    return [];
  }
}
