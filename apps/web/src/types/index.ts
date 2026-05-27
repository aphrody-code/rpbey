// User types
export interface User {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  discordId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Tournament types
// NOTE: These types mirror the Prisma schema - use Prisma types directly when possible
export interface Tournament {
  id: string;
  name: string;
  description: string | null;
  date: Date;
  location: string | null;
  format: string;
  maxPlayers: number;
  challongeId: string | null;
  challongeUrl: string | null;
  challongeState: string | null;
  registrationStart: Date | null;
  registrationEnd: Date | null;
  announcementMessageId: string | null;
  channelId: string | null;
  status: TournamentStatus;
  createdAt: Date;
  updatedAt: Date;
}

// Matches Prisma enum TournamentStatus
export type TournamentStatus =
  | 'UPCOMING'
  | 'REGISTRATION_OPEN'
  | 'REGISTRATION_CLOSED'
  | 'CHECKIN'
  | 'UNDERWAY'
  | 'COMPLETE'
  | 'CANCELLED';

// Participant types
export interface Participant {
  id: string;
  tournamentId: string;
  userId: string;
  seed: number | null;
  status: ParticipantStatus;
  createdAt: Date;
}

export type ParticipantStatus =
  | 'REGISTERED'
  | 'CHECKED_IN'
  | 'ELIMINATED'
  | 'WINNER';

// Match types
export interface Match {
  id: string;
  tournamentId: string;
  round: number;
  player1Id: string | null;
  player2Id: string | null;
  winnerId: string | null;
  score: string | null; // Format: "2-1", "3-0", etc.
  state: MatchState;
  challongeMatchId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Matches the 'state' field in TournamentMatch model
export type MatchState = 'pending' | 'open' | 'complete';

// API Response types
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

export interface BotRole {
  id: string;
  name: string;
  color: string;
  position?: number;
  managed?: boolean;
}

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue }
  | JsonValue[];

export interface BotMember {
  id: string;
  username: string;
  displayName: string;
  avatar: string | null;
  nickname?: string;
  joinedAt?: string;
  premiumSince?: string | null;
  roles: { id: string; name: string; color: string }[];
  status?: string;
  activities?: JsonValue[];
  serverAvatar?: string | null;
  globalName?: string | null;
  createdAt?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
