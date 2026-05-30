import "server-only";
import { and, asc, count, db, desc, eq, ilike, ne, or, schema, sql } from "@/lib/db";
import type {
  TeamCreateInput,
  TeamDetail,
  TeamDetailResponse,
  TeamInvite,
  TeamMember,
  TeamMembersResponse,
  TeamMessage,
  TeamMessagesResponse,
  TeamRole,
  TeamSummary,
  TeamsListQuery,
  TeamsListResponse,
  TeamUpdateInput,
} from "@rpbey/api-contract";

/**
 * Data Access Layer — équipes communautaires (clans).
 * SEUL endroit autorisé à importer `@rpbey/db` pour ce domaine. UI-agnostic.
 *
 * Règles métier :
 *  - un blader n'appartient qu'à UNE équipe (unicité `team_members.userId`) ;
 *  - une équipe devient publique/listée à partir de 3 membres (`isPublic`) ;
 *  - les stats (`totalPoints/Wins/Losses/TournamentWins`) sont l'agrégat des
 *    profils des membres, recalculé à chaque changement de composition.
 *
 * Invariant timestamp (@rpbey/db) : toutes les colonnes `teams*` sont `mode:"string"`
 * (ISO). On normalise quand même via `toIso` par robustesse.
 */

/** Seuil minimal de membres pour qu'une équipe soit publique/listée. */
export const MIN_TEAM_MEMBERS = 3;

/** Erreur métier portée jusqu'à la route (code → status HTTP). */
export class TeamError extends Error {
  constructor(
    readonly code:
      | "not_found"
      | "forbidden"
      | "conflict"
      | "already_in_team"
      | "invalid"
      | "tag_taken",
    message: string,
  ) {
    super(message);
    this.name = "TeamError";
  }
}

function toIso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function nowIso(): string {
  return new Date().toISOString();
}

/** Slug URL-safe à partir d'un nom libre. */
function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

const MEMBER_USER_COLUMNS = { id: true, name: true, image: true } as const;
const MEMBER_PROFILE_COLUMNS = {
  bladerName: true,
  rankingPoints: true,
  wins: true,
  losses: true,
  tournamentWins: true,
  duelRating: true,
} as const;

const ROLE_WEIGHT: Record<string, number> = { CAPTAIN: 0, CO_CAPTAIN: 1, MEMBER: 2 };

type TeamRow = typeof schema.teams.$inferSelect;

function toSummary(row: TeamRow): TeamSummary {
  return {
    id: row.id,
    slug: row.slug,
    tag: row.tag,
    name: row.name,
    logoUrl: row.logoUrl,
    bannerUrl: row.bannerUrl,
    accentColor: row.accentColor,
    region: row.region,
    isVerified: row.isVerified,
    isRecruiting: row.isRecruiting,
    isPublic: row.isPublic,
    memberCount: row.memberCount,
    totalPoints: row.totalPoints,
    totalWins: row.totalWins,
    totalLosses: row.totalLosses,
    totalTournamentWins: row.totalTournamentWins,
    captainId: row.captainId,
    createdAt: toIso(row.createdAt),
  };
}

type MemberRow = {
  userId: string;
  role: string;
  jerseyNumber: number | null;
  position: string | null;
  joinedAt: string | null;
  user: {
    id: string;
    name: string | null;
    image: string | null;
    profiles: {
      bladerName: string | null;
      rankingPoints: number;
      wins: number;
      losses: number;
      tournamentWins: number;
      duelRating: number;
    }[];
  } | null;
};

function toMember(row: MemberRow): TeamMember {
  const p = row.user?.profiles[0] ?? null;
  return {
    userId: row.userId,
    name: row.user?.name ?? null,
    image: row.user?.image ?? null,
    bladerName: p?.bladerName ?? null,
    role: row.role as TeamRole,
    jerseyNumber: row.jerseyNumber,
    position: row.position,
    joinedAt: toIso(row.joinedAt),
    rankingPoints: p?.rankingPoints ?? 0,
    wins: p?.wins ?? 0,
    losses: p?.losses ?? 0,
    tournamentWins: p?.tournamentWins ?? 0,
    duelRating: p?.duelRating ?? 1000,
  };
}

function sortMembers(a: TeamMember, b: TeamMember): number {
  const rw = (ROLE_WEIGHT[a.role] ?? 9) - (ROLE_WEIGHT[b.role] ?? 9);
  if (rw !== 0) return rw;
  return b.rankingPoints - a.rankingPoints;
}

// --- Lecture publique -------------------------------------------------------------

export async function listTeams(query: TeamsListQuery): Promise<TeamsListResponse> {
  const { page, pageSize, q, region, recruiting, sort } = query;
  const filters = [eq(schema.teams.isPublic, true)];
  if (q) {
    const like = `%${q}%`;
    filters.push(or(ilike(schema.teams.name, like), ilike(schema.teams.tag, like))!);
  }
  if (region) filters.push(eq(schema.teams.region, region));
  if (recruiting !== undefined) filters.push(eq(schema.teams.isRecruiting, recruiting));
  const where = and(...filters);

  const orderBy =
    sort === "members"
      ? [desc(schema.teams.memberCount), desc(schema.teams.totalPoints)]
      : sort === "recent"
        ? [desc(schema.teams.createdAt)]
        : sort === "wins"
          ? [desc(schema.teams.totalWins)]
          : [desc(schema.teams.totalPoints), desc(schema.teams.memberCount)];

  const [rows, totalRow] = await Promise.all([
    db
      .select()
      .from(schema.teams)
      .where(where)
      .orderBy(...orderBy)
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ value: count() }).from(schema.teams).where(where),
  ]);

  const total = totalRow[0]?.value ?? 0;
  return {
    items: rows.map(toSummary),
    pagination: {
      total,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export async function getTeamsLeaderboard(limit: number): Promise<TeamSummary[]> {
  const rows = await db
    .select()
    .from(schema.teams)
    .where(eq(schema.teams.isPublic, true))
    .orderBy(desc(schema.teams.totalPoints), desc(schema.teams.totalWins))
    .limit(limit);
  return rows.map(toSummary);
}

async function loadTeamDetail(where: ReturnType<typeof eq>): Promise<TeamDetail | null> {
  const row = await db.query.teams.findFirst({
    where,
    with: {
      members: {
        with: {
          user: {
            columns: MEMBER_USER_COLUMNS,
            with: { profiles: { columns: MEMBER_PROFILE_COLUMNS } },
          },
        },
      },
    },
  });
  if (!row) return null;
  const members = row.members.map(toMember).sort(sortMembers);
  return {
    ...toSummary(row),
    description: row.description,
    foundedAt: toIso(row.foundedAt),
    socials: {
      twitterHandle: row.twitterHandle,
      instagramHandle: row.instagramHandle,
      youtubeHandle: row.youtubeHandle,
      twitchHandle: row.twitchHandle,
      discordInvite: row.discordInvite,
      websiteUrl: row.websiteUrl,
    },
    members,
  };
}

export async function getTeamBySlug(slug: string): Promise<TeamDetailResponse> {
  const team = await loadTeamDetail(eq(schema.teams.slug, slug));
  return { team };
}

export async function getTeamMembersBySlug(slug: string): Promise<TeamMembersResponse> {
  const team = await loadTeamDetail(eq(schema.teams.slug, slug));
  return { members: team?.members ?? [] };
}

// --- Recalcul des agrégats --------------------------------------------------------

/** Recalcule memberCount, isPublic et les stats cumulées des membres d'une équipe. */
export async function recomputeTeamStats(teamId: string): Promise<void> {
  const agg = await db
    .select({
      members: count(schema.teamMembers.id),
      points: sql<number>`coalesce(sum(${schema.profiles.rankingPoints}), 0)`,
      wins: sql<number>`coalesce(sum(${schema.profiles.wins}), 0)`,
      losses: sql<number>`coalesce(sum(${schema.profiles.losses}), 0)`,
      twins: sql<number>`coalesce(sum(${schema.profiles.tournamentWins}), 0)`,
    })
    .from(schema.teamMembers)
    .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.teamMembers.userId))
    .where(eq(schema.teamMembers.teamId, teamId));

  const a = agg[0];
  const members = Number(a?.members ?? 0);
  await db
    .update(schema.teams)
    .set({
      memberCount: members,
      isPublic: members >= MIN_TEAM_MEMBERS,
      totalPoints: Number(a?.points ?? 0),
      totalWins: Number(a?.wins ?? 0),
      totalLosses: Number(a?.losses ?? 0),
      totalTournamentWins: Number(a?.twins ?? 0),
      updatedAt: nowIso(),
    })
    .where(eq(schema.teams.id, teamId));
}

// --- Helpers d'autorisation -------------------------------------------------------

async function getMembership(userId: string) {
  return db.query.teamMembers.findFirst({ where: eq(schema.teamMembers.userId, userId) });
}

async function requireManager(userId: string, teamId: string): Promise<TeamRole> {
  const m = await db.query.teamMembers.findFirst({
    where: and(eq(schema.teamMembers.userId, userId), eq(schema.teamMembers.teamId, teamId)),
  });
  if (!m) throw new TeamError("forbidden", "Vous ne faites pas partie de cette équipe.");
  if (m.role !== "CAPTAIN" && m.role !== "CO_CAPTAIN") {
    throw new TeamError("forbidden", "Action réservée au capitaine ou co-capitaine.");
  }
  return m.role as TeamRole;
}

// --- Mutations --------------------------------------------------------------------

export async function createTeam(userId: string, input: TeamCreateInput): Promise<TeamDetail> {
  const existing = await getMembership(userId);
  if (existing) throw new TeamError("already_in_team", "Vous êtes déjà dans une équipe.");

  const tag = input.tag.toUpperCase();
  const tagClash = await db.query.teams.findFirst({ where: eq(schema.teams.tag, tag) });
  if (tagClash) throw new TeamError("tag_taken", "Ce tag d'équipe est déjà pris.");

  // Slug unique (suffixe incrémental si collision).
  const base = slugify(input.name) || `team-${tag.toLowerCase()}`;
  let slug = base;
  for (let i = 2; ; i++) {
    const clash = await db.query.teams.findFirst({ where: eq(schema.teams.slug, slug) });
    if (!clash) break;
    slug = `${base}-${i}`.slice(0, 60);
  }

  const created = await db.transaction(async (tx) => {
    const [team] = await tx
      .insert(schema.teams)
      .values({
        slug,
        tag,
        name: input.name,
        description: input.description ?? null,
        region: input.region ?? null,
        accentColor: input.accentColor ?? null,
        logoUrl: input.logoUrl ?? null,
        bannerUrl: input.bannerUrl ?? null,
        captainId: userId,
        isRecruiting: input.isRecruiting ?? true,
        twitterHandle: input.twitterHandle ?? null,
        instagramHandle: input.instagramHandle ?? null,
        youtubeHandle: input.youtubeHandle ?? null,
        twitchHandle: input.twitchHandle ?? null,
        discordInvite: input.discordInvite ?? null,
        websiteUrl: input.websiteUrl ?? null,
        memberCount: 1,
        isPublic: false,
        updatedAt: nowIso(),
      })
      .returning();
    await tx.insert(schema.teamMembers).values({ teamId: team!.id, userId, role: "CAPTAIN" });
    return team!;
  });

  await recomputeTeamStats(created.id);
  const detail = await loadTeamDetail(eq(schema.teams.id, created.id));
  if (!detail) throw new TeamError("not_found", "Équipe introuvable après création.");
  return detail;
}

export async function updateTeam(
  userId: string,
  teamId: string,
  input: TeamUpdateInput,
): Promise<TeamDetail> {
  await requireManager(userId, teamId);
  const patch: Partial<TeamRow> = { updatedAt: nowIso() };
  const keys: (keyof TeamUpdateInput)[] = [
    "name",
    "description",
    "region",
    "accentColor",
    "logoUrl",
    "bannerUrl",
    "isRecruiting",
    "twitterHandle",
    "instagramHandle",
    "youtubeHandle",
    "twitchHandle",
    "discordInvite",
    "websiteUrl",
  ];
  for (const k of keys) {
    if (input[k] !== undefined) (patch as Record<string, unknown>)[k] = input[k];
  }
  await db.update(schema.teams).set(patch).where(eq(schema.teams.id, teamId));
  const detail = await loadTeamDetail(eq(schema.teams.id, teamId));
  if (!detail) throw new TeamError("not_found", "Équipe introuvable.");
  return detail;
}

export async function deleteTeam(userId: string, teamId: string): Promise<void> {
  const team = await db.query.teams.findFirst({ where: eq(schema.teams.id, teamId) });
  if (!team) throw new TeamError("not_found", "Équipe introuvable.");
  if (team.captainId !== userId) {
    throw new TeamError("forbidden", "Seul le capitaine peut dissoudre l'équipe.");
  }
  await db.delete(schema.teams).where(eq(schema.teams.id, teamId)); // cascade membres/invites/messages
}

export async function inviteToTeam(
  userId: string,
  teamId: string,
  inviteeId: string,
  message: string | null,
): Promise<void> {
  await requireManager(userId, teamId);
  if (inviteeId === userId) throw new TeamError("invalid", "Vous êtes déjà dans l'équipe.");

  const invitee = await db.query.users.findFirst({
    where: eq(schema.users.id, inviteeId),
    columns: { id: true },
  });
  if (!invitee) throw new TeamError("not_found", "Joueur introuvable.");

  const alreadyMember = await getMembership(inviteeId);
  if (alreadyMember) throw new TeamError("conflict", "Ce joueur est déjà dans une équipe.");

  await db
    .insert(schema.teamInvites)
    .values({ teamId, userId: inviteeId, invitedById: userId, status: "PENDING", message })
    .onConflictDoUpdate({
      target: [schema.teamInvites.teamId, schema.teamInvites.userId],
      set: { status: "PENDING", invitedById: userId, message, respondedAt: null },
    });
}

export async function respondToInvite(
  userId: string,
  inviteId: string,
  accept: boolean,
): Promise<{ teamSlug: string | null }> {
  const invite = await db.query.teamInvites.findFirst({
    where: eq(schema.teamInvites.id, inviteId),
  });
  if (!invite) throw new TeamError("not_found", "Invitation introuvable.");
  if (invite.userId !== userId)
    throw new TeamError("forbidden", "Cette invitation ne vous est pas destinée.");
  if (invite.status !== "PENDING") throw new TeamError("conflict", "Invitation déjà traitée.");

  if (!accept) {
    await db
      .update(schema.teamInvites)
      .set({ status: "DECLINED", respondedAt: nowIso() })
      .where(eq(schema.teamInvites.id, inviteId));
    return { teamSlug: null };
  }

  const already = await getMembership(userId);
  if (already) throw new TeamError("already_in_team", "Vous êtes déjà dans une équipe.");
  const team = await db.query.teams.findFirst({ where: eq(schema.teams.id, invite.teamId) });
  if (!team) throw new TeamError("not_found", "Équipe introuvable.");

  await db.transaction(async (tx) => {
    await tx.insert(schema.teamMembers).values({ teamId: invite.teamId, userId, role: "MEMBER" });
    await tx
      .update(schema.teamInvites)
      .set({ status: "ACCEPTED", respondedAt: nowIso() })
      .where(eq(schema.teamInvites.id, inviteId));
  });
  await recomputeTeamStats(invite.teamId);
  return { teamSlug: team.slug };
}

export async function leaveTeam(userId: string): Promise<void> {
  const m = await getMembership(userId);
  if (!m) throw new TeamError("not_found", "Vous n'êtes dans aucune équipe.");
  const teamId = m.teamId;

  await db.delete(schema.teamMembers).where(eq(schema.teamMembers.userId, userId));

  // Si le capitaine part, transférer ou dissoudre.
  if (m.role === "CAPTAIN") {
    const successor = await db.query.teamMembers.findFirst({
      where: eq(schema.teamMembers.teamId, teamId),
      orderBy: [asc(schema.teamMembers.joinedAt)],
    });
    if (!successor) {
      await db.delete(schema.teams).where(eq(schema.teams.id, teamId));
      return;
    }
    await db
      .update(schema.teamMembers)
      .set({ role: "CAPTAIN" })
      .where(eq(schema.teamMembers.id, successor.id));
    await db
      .update(schema.teams)
      .set({ captainId: successor.userId })
      .where(eq(schema.teams.id, teamId));
  }
  await recomputeTeamStats(teamId);
}

export async function kickMember(
  managerId: string,
  teamId: string,
  targetUserId: string,
): Promise<void> {
  const role = await requireManager(managerId, teamId);
  if (targetUserId === managerId)
    throw new TeamError("invalid", "Utilisez « quitter » pour partir.");
  const target = await db.query.teamMembers.findFirst({
    where: and(eq(schema.teamMembers.teamId, teamId), eq(schema.teamMembers.userId, targetUserId)),
  });
  if (!target) throw new TeamError("not_found", "Membre introuvable.");
  if (target.role === "CAPTAIN")
    throw new TeamError("forbidden", "Impossible d'exclure le capitaine.");
  if (target.role === "CO_CAPTAIN" && role !== "CAPTAIN") {
    throw new TeamError("forbidden", "Seul le capitaine peut exclure un co-capitaine.");
  }
  await db.delete(schema.teamMembers).where(eq(schema.teamMembers.id, target.id));
  await recomputeTeamStats(teamId);
}

export async function updateMember(
  captainId: string,
  teamId: string,
  targetUserId: string,
  changes: { role?: TeamRole; jerseyNumber?: number | null; position?: string | null },
): Promise<void> {
  const team = await db.query.teams.findFirst({ where: eq(schema.teams.id, teamId) });
  if (!team) throw new TeamError("not_found", "Équipe introuvable.");

  // Le changement de rôle est réservé au capitaine ; jersey/position au staff.
  if (changes.role !== undefined) {
    if (team.captainId !== captainId) {
      throw new TeamError("forbidden", "Seul le capitaine peut changer les rôles.");
    }
    if (changes.role === "CAPTAIN") {
      // Transfert de capitanat : l'ancien capitaine devient co-capitaine.
      await db.transaction(async (tx) => {
        await tx
          .update(schema.teamMembers)
          .set({ role: "CO_CAPTAIN" })
          .where(
            and(eq(schema.teamMembers.teamId, teamId), eq(schema.teamMembers.userId, captainId)),
          );
        await tx
          .update(schema.teamMembers)
          .set({ role: "CAPTAIN" })
          .where(
            and(eq(schema.teamMembers.teamId, teamId), eq(schema.teamMembers.userId, targetUserId)),
          );
        await tx
          .update(schema.teams)
          .set({ captainId: targetUserId })
          .where(eq(schema.teams.id, teamId));
      });
    } else {
      await db
        .update(schema.teamMembers)
        .set({ role: changes.role })
        .where(
          and(eq(schema.teamMembers.teamId, teamId), eq(schema.teamMembers.userId, targetUserId)),
        );
    }
  } else {
    await requireManager(captainId, teamId);
  }

  const fieldPatch: Record<string, unknown> = {};
  if (changes.jerseyNumber !== undefined) fieldPatch.jerseyNumber = changes.jerseyNumber;
  if (changes.position !== undefined) fieldPatch.position = changes.position;
  if (Object.keys(fieldPatch).length > 0) {
    await db
      .update(schema.teamMembers)
      .set(fieldPatch)
      .where(
        and(eq(schema.teamMembers.teamId, teamId), eq(schema.teamMembers.userId, targetUserId)),
      );
  }
}

// --- Chat / partage ---------------------------------------------------------------

export async function isTeamMember(userId: string, teamId: string): Promise<boolean> {
  const m = await db.query.teamMembers.findFirst({
    where: and(eq(schema.teamMembers.userId, userId), eq(schema.teamMembers.teamId, teamId)),
    columns: { id: true },
  });
  return !!m;
}

export async function postMessage(
  userId: string,
  teamId: string,
  input: { content: string; kind: string; refId: string | null },
): Promise<TeamMessage> {
  if (!(await isTeamMember(userId, teamId))) {
    throw new TeamError("forbidden", "Réservé aux membres de l'équipe.");
  }
  const [row] = await db
    .insert(schema.teamMessages)
    .values({ teamId, userId, content: input.content, kind: input.kind, refId: input.refId })
    .returning();
  const author = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
    columns: { name: true, image: true },
    with: { profiles: { columns: { bladerName: true } } },
  });
  return {
    id: row!.id,
    teamId,
    userId,
    authorName: author?.name ?? null,
    authorImage: author?.image ?? null,
    authorBladerName: author?.profiles[0]?.bladerName ?? null,
    content: row!.content,
    kind: row!.kind as TeamMessage["kind"],
    refId: row!.refId,
    createdAt: toIso(row!.createdAt)!,
    editedAt: toIso(row!.editedAt),
  };
}

export async function getMessages(
  teamId: string,
  params: { limit: number; before?: string },
): Promise<TeamMessagesResponse> {
  const conds = [
    eq(schema.teamMessages.teamId, teamId),
    sql`${schema.teamMessages.deletedAt} is null`,
  ];
  if (params.before) conds.push(sql`${schema.teamMessages.createdAt} < ${params.before}`);
  const rows = await db.query.teamMessages.findMany({
    where: and(...conds),
    orderBy: [desc(schema.teamMessages.createdAt)],
    limit: params.limit + 1,
    with: {
      user: {
        columns: { name: true, image: true },
        with: { profiles: { columns: { bladerName: true } } },
      },
    },
  });

  const hasMore = rows.length > params.limit;
  const page = hasMore ? rows.slice(0, params.limit) : rows;
  const nextCursor = hasMore ? toIso(page[page.length - 1]?.createdAt) : null;

  const messages: TeamMessage[] = page
    .map((r) => ({
      id: r.id,
      teamId: r.teamId,
      userId: r.userId,
      authorName: r.user?.name ?? null,
      authorImage: r.user?.image ?? null,
      authorBladerName: r.user?.profiles[0]?.bladerName ?? null,
      content: r.content,
      kind: r.kind as TeamMessage["kind"],
      refId: r.refId,
      createdAt: toIso(r.createdAt)!,
      editedAt: toIso(r.editedAt),
    }))
    .reverse(); // chronologique ascendant pour l'affichage

  return { messages, nextCursor };
}

// --- Vues « moi » -----------------------------------------------------------------

/** Équipe + rôle de l'utilisateur connecté (dashboard), ou null. */
export async function getMyTeam(
  userId: string,
): Promise<{ team: TeamDetail; role: TeamRole } | null> {
  const m = await getMembership(userId);
  if (!m) return null;
  const team = await loadTeamDetail(eq(schema.teams.id, m.teamId));
  if (!team) return null;
  return { team, role: m.role as TeamRole };
}

/** Invitations en attente reçues par l'utilisateur connecté. */
export async function getMyInvites(userId: string): Promise<TeamInvite[]> {
  const rows = await db.query.teamInvites.findMany({
    where: and(eq(schema.teamInvites.userId, userId), eq(schema.teamInvites.status, "PENDING")),
    orderBy: [desc(schema.teamInvites.createdAt)],
    with: {
      team: true,
      invitedBy: { columns: { name: true } },
    },
  });
  return rows
    .filter((r) => r.team)
    .map((r) => ({
      id: r.id,
      status: r.status as TeamInvite["status"],
      message: r.message,
      createdAt: toIso(r.createdAt)!,
      team: toSummary(r.team!),
      invitedByName: r.invitedBy?.name ?? null,
    }));
}

/** Recherche de joueurs sans équipe, pour le sélecteur d'invitation. */
export async function searchInvitableUsers(
  q: string,
  limit = 10,
): Promise<{ id: string; name: string | null; image: string | null; bladerName: string | null }[]> {
  if (!q.trim()) return [];
  const like = `%${q.trim()}%`;
  const rows = await db.query.users.findMany({
    where: and(
      or(ilike(schema.users.name, like), ilike(schema.users.username, like))!,
      ne(schema.users.banned, true),
      sql`${schema.users.id} not in (select "userId" from ${schema.teamMembers})`,
    ),
    columns: { id: true, name: true, image: true },
    with: { profiles: { columns: { bladerName: true } } },
    limit,
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    image: r.image,
    bladerName: r.profiles[0]?.bladerName ?? null,
  }));
}

// ─── Admin : gestion des équipes (sans contrainte isPublic) ──────────────────

export interface AdminTeamRow {
  id: string;
  slug: string;
  tag: string;
  name: string;
  logoUrl: string | null;
  captainId: string;
  region: string | null;
  isPublic: boolean;
  isVerified: boolean;
  isRecruiting: boolean;
  memberCount: number;
  totalPoints: number;
  totalWins: number;
  totalLosses: number;
  createdAt: string;
}

/** Liste toutes les équipes (admin — sans filtre isPublic). */
export async function listAdminTeams(opts: {
  page?: number;
  pageSize?: number;
  search?: string;
}): Promise<{ teams: AdminTeamRow[]; total: number }> {
  const { page = 1, pageSize = 25, search = "" } = opts;
  const offset = (page - 1) * pageSize;
  const where = search
    ? or(ilike(schema.teams.name, `%${search}%`), ilike(schema.teams.tag, `%${search}%`))
    : undefined;

  const [rows, totalRows] = await Promise.all([
    db.query.teams.findMany({
      where,
      orderBy: [desc(schema.teams.totalPoints), desc(schema.teams.createdAt)],
      limit: pageSize,
      offset,
    }),
    db.select({ value: count() }).from(schema.teams).where(where),
  ]);

  return {
    teams: rows.map((t) => ({
      id: t.id,
      slug: t.slug,
      tag: t.tag,
      name: t.name,
      logoUrl: t.logoUrl,
      captainId: t.captainId,
      region: t.region,
      isPublic: t.isPublic,
      isVerified: t.isVerified,
      isRecruiting: t.isRecruiting,
      memberCount: t.memberCount,
      totalPoints: t.totalPoints,
      totalWins: t.totalWins,
      totalLosses: t.totalLosses,
      createdAt: t.createdAt,
    })),
    total: totalRows[0]?.value ?? 0,
  };
}

/** Verrifie / déverifie une équipe. */
export async function setTeamVerified(id: string, isVerified: boolean): Promise<void> {
  await db.update(schema.teams).set({ isVerified }).where(eq(schema.teams.id, id));
}

/** Supprime une équipe (admin, sans contrôle du capitaine). */
export async function adminDeleteTeam(id: string): Promise<void> {
  await db.delete(schema.teams).where(eq(schema.teams.id, id));
}
