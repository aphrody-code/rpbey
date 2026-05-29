import {
  getRankingSystem,
  listAllUserIds,
  listCompleteTournamentsForGlobal,
  upsertProfileStats,
} from "@/server/dal/rankings";

/**
 * Façade `RankingService` — la logique DB vit désormais dans `server/dal/rankings.ts`
 * (frontière DAL). Ce fichier ne fait qu'orchestrer le calcul de points sur des
 * données déjà chargées : aucun accès base direct ici.
 */
export const RankingService = {
  /**
   * Recalcule les points de classement pour TOUS les utilisateurs
   * basé sur l'historique complet des tournois TERMINÉS.
   */
  async recalculateAll() {
    const rules = await getRankingSystem();
    if (!rules) throw new Error("Système de classement non configuré.");

    const tournaments = await listCompleteTournamentsForGlobal();

    // Map UserId -> compteurs temporaires.
    const userPoints = new Map<
      string,
      { points: number; wins: number; losses: number; tournamentWins: number }
    >();

    const allUsers = await listAllUserIds();
    for (const u of allUsers) {
      userPoints.set(u.id, {
        points: 0,
        wins: 0,
        losses: 0,
        tournamentWins: 0,
      });
    }

    for (const t of tournaments) {
      const weight = t.weight || 1.0;

      // A. Points de participation & placement
      for (const p of t.tournamentParticipants) {
        if (!p.userId) continue;
        let points = 0;
        const stats = userPoints.get(p.userId) || {
          points: 0,
          wins: 0,
          losses: 0,
          tournamentWins: 0,
        };

        points += rules.participation * weight;

        if (p.finalPlacement) {
          if (p.finalPlacement === 1) {
            points += rules.firstPlace * weight;
            stats.tournamentWins += 1;
          } else if (p.finalPlacement === 2) {
            points += rules.secondPlace * weight;
          } else if (p.finalPlacement === 3) {
            points += rules.thirdPlace * weight;
          } else if (p.finalPlacement <= 8) {
            points += rules.top8 * weight;
          }
        }

        stats.points += points;
        userPoints.set(p.userId, stats);
      }

      // B. Points de victoire (matchs)
      for (const m of t.tournamentMatches) {
        if (m.winnerId) {
          const wStats = userPoints.get(m.winnerId);
          if (wStats) {
            // Challonge : rounds positifs = Winner bracket, négatifs = Loser bracket.
            const winPoints = m.round > 0 ? rules.matchWinWinner : rules.matchWinLoser;
            wStats.points += winPoints * weight;
            wStats.wins += 1;
          }
        }

        if (m.winnerId && m.player1Id && m.player2Id) {
          const loserId = m.winnerId === m.player1Id ? m.player2Id : m.player1Id;
          const lStats = userPoints.get(loserId);
          if (lStats) lStats.losses += 1;
        }
      }
    }

    // C. Sauvegarde en batch (upsert profil par la DAL).
    for (const [userId, stats] of userPoints.entries()) {
      await upsertProfileStats(userId, {
        points: Math.round(stats.points),
        wins: stats.wins,
        losses: stats.losses,
        tournamentWins: stats.tournamentWins,
      });
    }
  },
};
