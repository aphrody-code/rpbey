export interface UserStats {
  userId: string;
  bladerName: string;
  challongeUsername: string | null;
  totalMatches: number;
  wins: number;
  losses: number;
  winRate: number;
  tournamentsPlayed: number;
  tournamentsWon: number;
  currentStreak: number;
  bestStreak: number;
  recentForm: ('W' | 'L')[];
  rank: number;
  elo: number;
  mostUsedBlades: { partId: string; name: string; count: number }[];
  mostUsedRatchets: { partId: string; name: string; count: number }[];
  mostUsedBits: { partId: string; name: string; count: number }[];
  rivalries: {
    opponentId: string;
    opponentName: string;
    wins: number;
    losses: number;
  }[];
  points: number;
}

export interface LeaderboardEntry {
  userId: string;
  bladerName: string;
  elo: number;
  points: number;
  wins: number;
  losses: number;
  winRate: number;
  rank: number;
  tournamentsPlayed: number;
  tournamentWins: number;
}
