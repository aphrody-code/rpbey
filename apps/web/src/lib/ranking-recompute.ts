/**
 * Cœur PUR du recalcul de classement global RPB (aucun accès DB, pas de `server-only`).
 *
 * Unique source de vérité de l'agrégation cross-tournois : combine les stats de chaque
 * joueur dans chaque tournoi (placement, victoires de match, participation) + données
 * BTS enrichies (JSON) + ajustements manuels, puis renvoie les lignes `global_rankings`
 * prêtes à insérer. Couvre TOUT LE MONDE (inscrits via `userId` ET non-inscrits via
 * `playerName`).
 *
 * Les chemins admin (`recalculateRankings` action, `RankingService.recalculateAll`,
 * `/api/admin/ranking` PUT, auto-sync) appellent TOUS ce module : la DAL fournit les
 * lectures + l'écriture transactionnelle (`rebuildGlobalRankings`), la logique vit ici.
 *
 * Étape clé : la liaison nom→utilisateur. Un inscrit ayant joué sous un `playerName`
 * (sans `tournamentParticipants.userId`) se voit attribuer son `userId` par
 * correspondance normalisée (lowercase, sans accents/espaces/ponctuation) contre ses
 * identités connues. Le matching est conservateur (exact après normalisation), pour que
 * son `profiles` soit mis à jour par `rebuildGlobalRankings`.
 */

// --- Types d'entrée (alignés sur les retours DAL, sans dépendre d'eux) --------

export interface RankingConfigPure {
  participation: number;
  firstPlace: number;
  secondPlace: number;
  thirdPlace: number;
  top8: number;
  matchWinWinner: number;
  matchWinLoser: number;
}

export interface ParticipantPure {
  userId: string | null;
  playerName: string | null;
  finalPlacement: number | null;
  wins: number | null;
  losses: number | null;
  checkedIn: boolean | null;
  user?: {
    image?: string | null;
    profiles?: Array<{ bladerName?: string | null; challongeUsername?: string | null }>;
  } | null;
}

export interface MatchPure {
  winnerId: string | null;
  winnerName: string | null;
  state: string | null;
}

export interface TournamentPure {
  status: string;
  weight?: number | null;
  tournamentCategory?: { multiplier?: number | null } | null;
  tournamentParticipants: ParticipantPure[];
  tournamentMatches: MatchPure[];
}

export interface MapperEntry {
  primaryName: string;
  challongeUsername: string;
  aliases: string[];
}

export interface EnrichedRankingEntry {
  playerKey: string;
  playerName: string;
  wins: number;
  losses: number;
  tournamentWins: number;
  tournamentsCount: number;
  totalPoints: number;
  challongeUsername: string | null;
  avatarUrl: string | null;
}

export interface PointAdjustmentPure {
  userId: string;
  points: number;
}

/** Identités d'un user utilisées pour rattacher un `playerName` à un compte. */
export interface UserLinkRow {
  userId: string;
  image: string | null;
  names: Array<string | null | undefined>;
  challongeUsername: string | null;
  bladerName: string | null;
}

/** Profil minimal indexé par userId (pour résoudre la clé d'agrégation des ajustements). */
export interface AdjustmentUserProfile {
  userId: string;
  bladerName: string | null;
}

export interface RankingRow {
  playerName: string;
  points: number;
  wins: number;
  losses: number;
  tournamentWins: number;
  tournamentsCount: number;
  avatarUrl: string | null;
  userId: string | null;
  challongeUsername: string | null;
}

export interface ComputeRankingsInput {
  tournaments: TournamentPure[];
  config: RankingConfigPure;
  adjustments: PointAdjustmentPure[];
  /** Profils (bladerName) des users ajustés, pour calculer leur clé d'agrégation. */
  adjustmentProfiles: AdjustmentUserProfile[];
  mapper?: Record<string, MapperEntry>;
  enrichedData?: EnrichedRankingEntry[];
  /** Toutes les identités users → liaison nom→compte des non-inscrits. */
  userLinks?: UserLinkRow[];
  /** IDs de tournois déjà couverts par `enrichedData` (BTS), exclus du calcul DB. */
  excludeTournamentIds?: string[];
}

export interface ComputeRankingsResult {
  rankings: RankingRow[];
  /** Nb de lignes rattachées à un userId (inscrits + liés par nom). */
  linkedCount: number;
}

// --- Normalisation -----------------------------------------------------------

/** lowercase + sans accents + sans espaces/ponctuation. "" si rien d'exploitable. */
export function normalizeName(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

interface PlayerStat {
  wins: number;
  losses: number;
  tournamentWins: number;
  tournamentsCount: number;
  playerName: string;
  userId: string | null;
  challongeUsername: string | null;
  avatarUrl: string | null;
}

/**
 * Agrège toutes les stats et renvoie les lignes `global_rankings`.
 * Fonction PURE : tout l'I/O (lectures, écriture) est fait par l'appelant via la DAL.
 */
export function computeRankings(input: ComputeRankingsInput): ComputeRankingsResult {
  const {
    tournaments,
    config,
    adjustments,
    adjustmentProfiles,
    mapper = {},
    enrichedData = [],
    userLinks = [],
    excludeTournamentIds = [],
  } = input;

  const playerPoints = new Map<string, number>();
  const playerStats = new Map<string, PlayerStat>();

  // Index inverse alias → clé normalisée (mapper BTS).
  const aliasToKey = new Map<string, string>();
  for (const [key, data] of Object.entries(mapper)) {
    for (const alias of data.aliases) aliasToKey.set(alias, key);
  }

  // Index nom normalisé → userId, pour rattacher un playerName non-inscrit à un compte.
  // Conservateur : une collision (deux users → même nom normalisé) désactive le match
  // pour ce nom (ambigu).
  const nameToUser = new Map<string, string | null>();
  const userById = new Map<string, UserLinkRow>();
  for (const u of userLinks) {
    userById.set(u.userId, u);
    const idents = [...u.names, u.challongeUsername, u.bladerName];
    for (const ident of idents) {
      const key = normalizeName(ident);
      if (!key) continue;
      if (nameToUser.has(key)) {
        if (nameToUser.get(key) !== u.userId) nameToUser.set(key, null); // ambigu → off
      } else {
        nameToUser.set(key, u.userId);
      }
    }
  }
  /** Renvoie un userId si `playerName` matche EXACTEMENT (après normalisation) un user unique. */
  function resolveUserByName(playerName: string | null | undefined): string | null {
    const key = normalizeName(playerName);
    if (!key) return null;
    return nameToUser.get(key) ?? null;
  }

  const excluded = new Set(excludeTournamentIds);

  // 1. Données BTS enrichies (JSON) — tournois historiques pré-agrégés.
  for (const d of enrichedData) {
    const playerKey = d.playerKey;
    const mapData = mapper[playerKey];
    playerStats.set(playerKey, {
      wins: d.wins,
      losses: d.losses,
      tournamentWins: d.tournamentWins,
      tournamentsCount: d.tournamentsCount,
      playerName: mapData?.primaryName || d.playerName,
      userId: resolveUserByName(mapData?.primaryName || d.playerName),
      challongeUsername: d.challongeUsername !== "new" ? d.challongeUsername : null,
      avatarUrl: d.avatarUrl,
    });
    playerPoints.set(playerKey, d.totalPoints);
  }

  // 2. Tournois DB (COMPLETE / ARCHIVED / UNDERWAY) — agrégation par NOM ou userId.
  for (const tournament of tournaments) {
    const multiplier = tournament.tournamentCategory?.multiplier ?? tournament.weight ?? 1.0;
    for (const participant of tournament.tournamentParticipants) {
      const participantProfile = participant.user?.profiles?.[0] ?? null;
      const isFinished = tournament.status === "COMPLETE" || tournament.status === "ARCHIVED";
      if (!participant.checkedIn && !isFinished) continue;

      const baseKey = normalizeName(
        participant.playerName || participantProfile?.bladerName || "unknown",
      );
      const playerKey = aliasToKey.get(participant.playerName || "") || baseKey;
      const mapData = mapper[playerKey];

      // userId résolu : explicite sur la participation, sinon liaison par nom.
      const resolvedUserId =
        participant.userId ??
        resolveUserByName(participant.playerName) ??
        resolveUserByName(participantProfile?.bladerName);

      let points = 0;
      const stats = playerStats.get(playerKey) || {
        wins: 0,
        losses: 0,
        tournamentWins: 0,
        tournamentsCount: 0,
        playerName:
          mapData?.primaryName ||
          participant.playerName ||
          participantProfile?.bladerName ||
          "Unknown",
        userId: resolvedUserId,
        challongeUsername:
          mapData?.challongeUsername || participantProfile?.challongeUsername || null,
        avatarUrl: participant.user?.image || null,
      };

      if (isFinished) {
        stats.tournamentsCount += 1;
        stats.wins += participant.wins || 0;
        stats.losses += participant.losses || 0;
        if (participant.finalPlacement === 1) stats.tournamentWins += 1;
      }

      points += config.participation;
      if (participant.finalPlacement === 1) points += config.firstPlace;
      else if (participant.finalPlacement === 2) points += config.secondPlace;
      else if (participant.finalPlacement === 3) points += config.thirdPlace;
      else if (participant.finalPlacement && participant.finalPlacement <= 8) points += config.top8;

      // RPB : toutes les victoires comptent identique (pas de distinction WB/LB).
      const matchWins = tournament.tournamentMatches.filter(
        (m) =>
          (m.winnerId === participant.userId || m.winnerName === participant.playerName) &&
          m.state === "complete",
      );
      points += matchWins.length * config.matchWinWinner;

      // Enrichit le userId/avatar si on en a un meilleur (résolu ou explicite).
      if (!stats.userId && resolvedUserId) stats.userId = resolvedUserId;
      if (!stats.avatarUrl) {
        const linked = stats.userId ? userById.get(stats.userId) : null;
        stats.avatarUrl = participant.user?.image || linked?.image || null;
      }
      playerStats.set(playerKey, stats);

      const currentPoints = playerPoints.get(playerKey) || 0;
      playerPoints.set(playerKey, currentPoints + Math.round(points * multiplier));
    }
  }
  void excluded; // exclusion appliquée en amont par l'appelant (DAL excludeIds)

  // 3. Ajustements manuels (clé = bladerName normalisé du user, sinon nouvelle ligne user).
  const profileByUser = new Map(adjustmentProfiles.map((p) => [p.userId, p]));
  for (const adj of adjustments) {
    const prof = profileByUser.get(adj.userId);
    const bladerName = prof?.bladerName || "";
    const baseKey = normalizeName(bladerName || "unknown");
    const playerKey = aliasToKey.get(bladerName) || baseKey;
    const currentPoints = playerPoints.get(playerKey) || 0;
    playerPoints.set(playerKey, currentPoints + adj.points);
    // Assure une ligne pour l'ajustement même si le joueur n'a aucune participation.
    if (!playerStats.has(playerKey)) {
      const linked = userById.get(adj.userId);
      playerStats.set(playerKey, {
        wins: 0,
        losses: 0,
        tournamentWins: 0,
        tournamentsCount: 0,
        playerName: bladerName || linked?.bladerName || "Unknown",
        userId: adj.userId,
        challongeUsername: linked?.challongeUsername || null,
        avatarUrl: linked?.image || null,
      });
    } else {
      const s = playerStats.get(playerKey)!;
      if (!s.userId) s.userId = adj.userId;
    }
  }

  // 4. Lignes brutes par playerKey.
  const rawRows: RankingRow[] = [];
  for (const [playerKey, points] of playerPoints.entries()) {
    const stats = playerStats.get(playerKey);
    if (!stats) continue;
    rawRows.push({
      playerName: stats.playerName,
      points,
      wins: stats.wins,
      losses: stats.losses,
      tournamentWins: stats.tournamentWins,
      tournamentsCount: stats.tournamentsCount,
      avatarUrl: stats.avatarUrl,
      userId: stats.userId,
      challongeUsername: stats.challongeUsername,
    });
  }

  // 5. CONSOLIDATION par userId : un même joueur jouant sous plusieurs `playerName`
  // (ex. "Berserk" + "Berserk91") est rattaché au MÊME compte par la liaison nom→user
  // → on FUSIONNE ces lignes (somme points/W/L/tournois). Sans ça, la contrainte UNIQUE
  // `global_rankings.userId` ferait silencieusement tomber les doublons (perte de stats).
  // Les lignes sans userId restent telles quelles (dédupe par playerName via la DB).
  const merged: RankingRow[] = [];
  const byUser = new Map<string, { row: RankingRow; bestTournois: number }>();
  for (const row of rawRows) {
    if (!row.userId) {
      merged.push(row);
      continue;
    }
    const slot = byUser.get(row.userId);
    if (!slot) {
      const copy = { ...row };
      byUser.set(row.userId, { row: copy, bestTournois: row.tournamentsCount });
      merged.push(copy);
      continue;
    }
    const { row: existing } = slot;
    // Garde le `playerName` de la ligne la plus « volumineuse » (plus de tournois) avant
    // d'agréger les compteurs — sinon le nom de la 2e ligne lue gagnerait arbitrairement.
    if (row.tournamentsCount > slot.bestTournois) {
      existing.playerName = row.playerName;
      slot.bestTournois = row.tournamentsCount;
    }
    existing.points += row.points;
    existing.wins += row.wins;
    existing.losses += row.losses;
    existing.tournamentWins += row.tournamentWins;
    existing.tournamentsCount += row.tournamentsCount;
    existing.avatarUrl = existing.avatarUrl || row.avatarUrl;
    existing.challongeUsername = existing.challongeUsername || row.challongeUsername;
  }

  const linkedCount = merged.filter((r) => r.userId).length;
  return { rankings: merged, linkedCount };
}
