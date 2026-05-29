import { db, schema, eq } from "@/lib/db";

export const RankingService = {
  /**
   * Recalcule les points de classement pour TOUS les utilisateurs
   * basé sur l'historique complet des tournois.
   */
  async recalculateAll() {
    // 1. Récupérer les règles
    const rules = await db.query.rankingSystem.findFirst();
    if (!rules) throw new Error("Système de classement non configuré.");

    // 2. Récupérer tous les tournois TERMINÉS
    const tournaments = await db.query.tournaments.findMany({
      where: eq(schema.tournaments.status, "COMPLETE"),
      with: {
        tournamentParticipants: true,
        tournamentMatches: true, // Pour compter les victoires
      },
    });

    // 3. Map pour stocker les points temporaires : UserId -> Points
    const userPoints = new Map<
      string,
      { points: number; wins: number; losses: number; tournamentWins: number }
    >();

    // Initialisation des compteurs
    const allUsers = await db.select({ id: schema.users.id }).from(schema.users);
    for (const u of allUsers) {
      userPoints.set(u.id, {
        points: 0,
        wins: 0,
        losses: 0,
        tournamentWins: 0,
      });
    }

    // 4. Boucle de calcul
    for (const t of tournaments) {
      const weight = t.weight || 1.0;

      // A. Points de Participation & Placement
      for (const p of t.tournamentParticipants) {
        if (!p.userId) continue;
        let points = 0;
        const stats = userPoints.get(p.userId) || {
          points: 0,
          wins: 0,
          losses: 0,
          tournamentWins: 0,
        };

        // Participation
        points += rules.participation * weight;

        // Placement
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

      // B. Points de Victoire (Matchs)
      for (const m of t.tournamentMatches) {
        if (m.winnerId) {
          const wStats = userPoints.get(m.winnerId);
          if (wStats) {
            // Distinction Winner Bracket vs Loser Bracket
            // Challonge: Rounds positifs = Winner, Négatifs = Loser
            const winPoints = m.round > 0 ? rules.matchWinWinner : rules.matchWinLoser;

            wStats.points += winPoints * weight;
            wStats.wins += 1;
          }
        }

        // Calcul des défaites (si player1 est winner, player2 perd, et inversement)
        if (m.winnerId && m.player1Id && m.player2Id) {
          const loserId = m.winnerId === m.player1Id ? m.player2Id : m.player1Id;
          const lStats = userPoints.get(loserId);
          if (lStats) {
            lStats.losses += 1;
          }
        }
      }
    }

    // 5. Sauvegarde en Batch
    for (const [userId, stats] of userPoints.entries()) {
      await db
        .insert(schema.profiles)
        .values({
          userId,
          rankingPoints: Math.round(stats.points),
          wins: stats.wins,
          losses: stats.losses,
          tournamentWins: stats.tournamentWins,
        })
        .onConflictDoUpdate({
          target: schema.profiles.userId,
          set: {
            rankingPoints: Math.round(stats.points),
            wins: stats.wins,
            losses: stats.losses,
            tournamentWins: stats.tournamentWins,
          },
        });
    }
  },
};
