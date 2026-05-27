export interface Standing {
  rank: number;
  name: string;
  challongeUsername?: string;
  challongeProfileUrl?: string;
  wins: number;
  losses: number;
  stats?: {
    wins: number;
    losses: number;
  };
}

export interface Station {
  stationId: number | string;
  name: string;
  currentMatch?: {
    matchId: number;
    identifier: string;
    round: number;
    player1: string | null;
    player2: string | null;
    scores: string;
    state: string;
  } | null;
  status: 'idle' | 'active' | 'paused';
}

export interface LogEntry {
  timestamp: string;
  type: string;
  message: string;
}

export interface LiveData {
  standings: Standing[];
  stations: Station[];
  activityLog: LogEntry[];
  lastUpdated: string;
}

export interface InitialLiveData {
  standings: unknown[];
  stations: unknown[];
  activityLog: unknown[];
  lastUpdated: string;
}

export interface TournamentData {
  id: string;
  name: string;
  status: string;
  description: string | null;
  date: string;
  location: string | null;
  format: string;
  maxPlayers: number;
  challongeId: string | null;
  challongeUrl: string | null;
  posterUrl: string | null;
  updatedAt: string;
  category: {
    id: string;
    name: string;
    color: string | null;
    logoUrl: string | null;
  } | null;
}
