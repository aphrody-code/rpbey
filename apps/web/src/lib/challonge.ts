/**
 * RPB - Challonge Service for Dashboard
 * Complete integration with Challonge API v2.1
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

const API_BASE = 'https://api.challonge.com/v2.1';
const OAUTH_BASE = 'https://api.challonge.com';

interface OAuthToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  created_at: number;
}

interface ChallongeTournament {
  id: string;
  type: string;
  attributes: {
    name: string;
    url: string;
    state: string;
    tournamentType: string;
    participantsCount: number;
    startAt: string | null;
    completedAt: string | null;
    description: string | null;
    gameName: string | null;
  };
}

interface ChallongeParticipant {
  id: string;
  type: string;
  attributes: {
    name: string;
    seed: number;
    active: boolean;
    checkedIn: boolean;
    misc?: string;
  };
}

interface ChallongeMatch {
  id: string;
  type: string;
  attributes: {
    round: number;
    state: string;
    player1Id: string | null;
    player2Id: string | null;
    winnerId: string | null;
    loserId: string | null;
    scores: string;
    underwayAt: string | null;
  };
}

interface ApiResponse<T> {
  data: T;
  included?: unknown[];
  meta?: unknown;
}

class ChallongeService {
  private accessToken: string | null = null;
  private tokenExpiresAt: number | null = null;

  // ==================== AUTH & TOKEN MANAGEMENT ====================

  /**
   * Generates the Challonge OAuth Authorization URL
   */
  getAuthorizationUrl(state: string): string {
    const clientId = process.env.CHALLONGE_CLIENT_ID;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/challonge`;

    if (!clientId) throw new Error('CHALLONGE_CLIENT_ID required');

    const url = new URL(`${OAUTH_BASE}/oauth/authorize`);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set(
      'scope',
      'me tournaments:read tournaments:write matches:read matches:write participants:read participants:write',
    );
    url.searchParams.set('state', state);

    return url.toString();
  }

  /**
   * Exchange authorization code for access and refresh tokens
   */
  async exchangeCodeForToken(
    code: string,
  ): Promise<OAuthToken & { refresh_token: string }> {
    const clientId = process.env.CHALLONGE_CLIENT_ID;
    const clientSecret = process.env.CHALLONGE_CLIENT_SECRET;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/challonge`;

    if (!clientId || !clientSecret) {
      throw new Error('Missing Challonge credentials');
    }

    const response = await fetch(`${OAUTH_BASE}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }).toString(),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OAuth Exchange Error: ${error}`);
    }

    return response.json();
  }

  /**
   * Refresh an expired access token
   */
  async refreshToken(
    refreshToken: string,
  ): Promise<OAuthToken & { refresh_token: string }> {
    const clientId = process.env.CHALLONGE_CLIENT_ID;
    const clientSecret = process.env.CHALLONGE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('Missing Challonge credentials');
    }

    const response = await fetch(`${OAUTH_BASE}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token Refresh Error: ${error}`);
    }

    return response.json();
  }

  private async getOAuthToken(userToken?: string): Promise<string> {
    // If a user-specific token is provided, use it
    if (userToken) return userToken;

    // Otherwise, fallback to client credentials (global bot access)
    if (
      this.accessToken &&
      this.tokenExpiresAt &&
      Date.now() < this.tokenExpiresAt - 300000
    ) {
      return this.accessToken;
    }

    const clientId = process.env.CHALLONGE_CLIENT_ID;
    const clientSecret = process.env.CHALLONGE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error(
        'CHALLONGE_CLIENT_ID and CHALLONGE_CLIENT_SECRET required',
      );
    }

    const response = await fetch(`${OAUTH_BASE}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope:
          'me tournaments:read tournaments:write matches:read matches:write participants:read participants:write',
      }).toString(),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OAuth Token Error (${response.status}): ${error}`);
    }

    const token = (await response.json()) as OAuthToken;
    this.accessToken = token.access_token;
    this.tokenExpiresAt = (token.created_at + token.expires_in) * 1000;

    return this.accessToken;
  }

  private async getHeaders(
    userToken?: string,
  ): Promise<Record<string, string>> {
    const token = await this.getOAuthToken(userToken);
    return {
      'Content-Type': 'application/vnd.api+json',
      Accept: 'application/json',
      'Authorization-Type': 'v2',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'RPB-Dashboard (https://rpbey.fr)',
    };
  }

  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown,
    userToken?: string,
  ): Promise<T> {
    const headers = await this.getHeaders(userToken);

    // Ensure endpoint has .json suffix for v2.1
    const finalEndpoint = endpoint.endsWith('.json')
      ? endpoint
      : `${endpoint}.json`;

    const response = await fetch(`${API_BASE}${finalEndpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10_000),
    });

    if (response.status === 429) {
      // Simple backoff
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return this.request(method, endpoint, body, userToken);
    }

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Challonge API Error (${response.status}): ${error}`);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    return response.json() as Promise<T>;
  }

  private unwrap<T>(response: any): T {
    return response.data || response;
  }

  // ==================== TOURNAMENTS ====================

  async listTournaments(params?: {
    state?: 'pending' | 'in_progress' | 'ended';
    page?: number;
    perPage?: number;
    subdomain?: string;
    userToken?: string;
  }): Promise<ChallongeTournament[]> {
    const query = new URLSearchParams();
    if (params?.state) query.set('state', params.state);
    if (params?.page) query.set('page', params.page.toString());
    if (params?.perPage) query.set('per_page', params.perPage.toString());
    if (params?.subdomain) query.set('subdomain', params.subdomain);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    const response = await this.request<ApiResponse<ChallongeTournament[]>>(
      'GET',
      `/tournaments${queryString}`,
      undefined,
      params?.userToken,
    );
    return this.unwrap<ChallongeTournament[]>(response);
  }

  async listCommunityTournaments(
    communityId: string,
    params?: {
      state?: 'pending' | 'in_progress' | 'ended';
      page?: number;
      perPage?: number;
      userToken?: string;
    },
  ): Promise<ChallongeTournament[]> {
    const query = new URLSearchParams();
    query.set('community_id', communityId);
    if (params?.state) query.set('state', params.state);
    if (params?.page) query.set('page', params.page.toString());
    if (params?.perPage) query.set('per_page', params.perPage.toString());

    const queryString = query.toString() ? `?${query.toString()}` : '';
    const response = await this.request<ApiResponse<ChallongeTournament[]>>(
      'GET',
      `/tournaments${queryString}`,
      undefined,
      params?.userToken,
    );
    return this.unwrap<ChallongeTournament[]>(response);
  }

  /**
   * Fetches ALL tournaments for a community by paginating automatically.
   */
  async fetchAllCommunityTournaments(
    communityId: string,
    params?: {
      state?: 'pending' | 'in_progress' | 'ended';
      userToken?: string;
    },
  ): Promise<ChallongeTournament[]> {
    let page = 1;
    const perPage = 25; // Challonge max per page default
    let allTournaments: ChallongeTournament[] = [];
    let hasMore = true;

    while (hasMore) {
      const tournaments = await this.listCommunityTournaments(communityId, {
        ...params,
        page,
        perPage,
      });

      if (tournaments.length === 0) {
        break;
      }

      allTournaments = [...allTournaments, ...tournaments];

      if (tournaments.length < perPage) {
        hasMore = false;
      } else {
        page++;
      }
    }

    return allTournaments;
  }

  async getTournament(
    tournamentId: string,
    userToken?: string,
  ): Promise<ChallongeTournament> {
    const response = await this.request<ApiResponse<ChallongeTournament>>(
      'GET',
      `/tournaments/${tournamentId}`,
      undefined,
      userToken,
    );
    return this.unwrap<ChallongeTournament>(response);
  }

  async createTournament(data: {
    name: string;
    url?: string;
    tournamentType?:
      | 'single elimination'
      | 'double elimination'
      | 'round robin'
      | 'swiss';
    description?: string;
    gameName?: string;
    startAt?: string;
    signupCap?: number;
    openSignup?: boolean;
    swissOptions?: {
      ptsForGameWin?: number;
      ptsForGameTie?: number;
      ptsForMatchWin?: number;
      ptsForMatchTie?: number;
    };
    userToken?: string;
  }): Promise<ChallongeTournament> {
    const attributes: Record<string, any> = {
      name: data.name,
      url: data.url,
      tournament_type: data.tournamentType ?? 'double elimination',
      description: data.description,
      game_name: data.gameName ?? 'Beyblade X',
      starts_at: data.startAt,
      registration_options: {
        signup_cap: data.signupCap,
        open_signup: data.openSignup ?? false,
      },
    };

    if (data.tournamentType === 'swiss' && data.swissOptions) {
      attributes.swiss_options = {
        pts_for_game_win: data.swissOptions.ptsForGameWin ?? 1.0,
        pts_for_game_tie: data.swissOptions.ptsForGameTie ?? 0.0,
        pts_for_match_win: data.swissOptions.ptsForMatchWin ?? 1.0,
        pts_for_match_tie: data.swissOptions.ptsForMatchTie ?? 0.5,
      };
    }

    const response = await this.request<ApiResponse<ChallongeTournament>>(
      'POST',
      '/tournaments',
      {
        data: {
          type: 'Tournaments',
          attributes,
        },
      },
      data.userToken,
    );
    return this.unwrap<ChallongeTournament>(response);
  }

  async resetTournament(
    tournamentId: string,
    userToken?: string,
  ): Promise<ChallongeTournament> {
    const response = await this.request<ApiResponse<ChallongeTournament>>(
      'PUT',
      `/tournaments/${tournamentId}/change_state`,
      {
        data: {
          type: 'TournamentState',
          attributes: { state: 'reset' },
        },
      },
      userToken,
    );
    return this.unwrap<ChallongeTournament>(response);
  }

  async updateTournament(
    tournamentId: string,
    data: {
      name?: string;
      description?: string;
      startAt?: string;
      signupCap?: number;
      userToken?: string;
    },
  ): Promise<ChallongeTournament> {
    const attributes: Record<string, any> = {
      name: data.name,
      description: data.description,
      starts_at: data.startAt,
    };

    if (data.signupCap !== undefined) {
      attributes.registration_options = {
        signup_cap: data.signupCap,
      };
    }

    const response = await this.request<ApiResponse<ChallongeTournament>>(
      'PUT',
      `/tournaments/${tournamentId}`,
      {
        data: {
          type: 'Tournaments',
          attributes,
        },
      },
      data.userToken,
    );
    return this.unwrap<ChallongeTournament>(response);
  }

  async startTournament(
    tournamentId: string,
    userToken?: string,
  ): Promise<ChallongeTournament> {
    const response = await this.request<ApiResponse<ChallongeTournament>>(
      'PUT',
      `/tournaments/${tournamentId}/change_state`,
      {
        data: {
          type: 'TournamentState',
          attributes: { state: 'start' },
        },
      },
      userToken,
    );
    return this.unwrap<ChallongeTournament>(response);
  }

  async finalizeTournament(
    tournamentId: string,
    userToken?: string,
  ): Promise<ChallongeTournament> {
    const response = await this.request<ApiResponse<ChallongeTournament>>(
      'PUT',
      `/tournaments/${tournamentId}/change_state`,
      {
        data: {
          type: 'TournamentState',
          attributes: { state: 'finalize' },
        },
      },
      userToken,
    );
    return this.unwrap<ChallongeTournament>(response);
  }

  async getCurrentUser(
    userToken: string,
  ): Promise<{ username: string; id: string }> {
    const response = await this.request<any>(
      'GET',
      '/me',
      undefined,
      userToken,
    );

    const userData = this.unwrap<any>(response);

    return {
      username: userData.attributes.username,
      id: userData.id,
    };
  }

  async deleteTournament(
    tournamentId: string,
    userToken?: string,
  ): Promise<void> {
    await this.request(
      'DELETE',
      `/tournaments/${tournamentId}`,
      undefined,
      userToken,
    );
  }

  // ==================== PARTICIPANTS ====================

  async listParticipants(
    tournamentId: string,
    userToken?: string,
  ): Promise<ChallongeParticipant[]> {
    const response = await this.request<ApiResponse<ChallongeParticipant[]>>(
      'GET',
      `/tournaments/${tournamentId}/participants`,
      undefined,
      userToken,
    );
    return this.unwrap<ChallongeParticipant[]>(response);
  }

  async createParticipant(
    tournamentId: string,
    data: {
      name: string;
      email?: string;
      seed?: number;
      misc?: string; // Discord ID
      userToken?: string;
    },
  ): Promise<ChallongeParticipant> {
    const response = await this.request<ApiResponse<ChallongeParticipant>>(
      'POST',
      `/tournaments/${tournamentId}/participants`,
      {
        data: {
          type: 'participants',
          attributes: {
            name: data.name,
            email: data.email,
            seed: data.seed,
            misc: data.misc,
          },
        },
      },
      data.userToken,
    );
    return this.unwrap<ChallongeParticipant>(response);
  }

  async bulkCreateParticipants(
    tournamentId: string,
    participants: Array<{
      name: string;
      email?: string;
      seed?: number;
      misc?: string;
    }>,
    userToken?: string,
  ): Promise<ChallongeParticipant[]> {
    const response = await this.request<ApiResponse<ChallongeParticipant[]>>(
      'POST',
      `/tournaments/${tournamentId}/participants/bulk_add`,
      {
        data: participants.map((p) => ({
          type: 'participants',
          attributes: {
            name: p.name,
            email: p.email,
            seed: p.seed,
            misc: p.misc,
          },
        })),
      },
      userToken,
    );
    return this.unwrap<ChallongeParticipant[]>(response);
  }

  async deleteParticipant(
    tournamentId: string,
    participantId: string,
    userToken?: string,
  ): Promise<void> {
    await this.request(
      'DELETE',
      `/tournaments/${tournamentId}/participants/${participantId}`,
      undefined,
      userToken,
    );
  }

  async checkInParticipant(
    tournamentId: string,
    participantId: string,
    userToken?: string,
  ): Promise<ChallongeParticipant> {
    const response = await this.request<ApiResponse<ChallongeParticipant>>(
      'PUT',
      `/tournaments/${tournamentId}/participants/${participantId}`,
      {
        data: {
          type: 'participants',
          attributes: { checked_in: true },
        },
      },
      userToken,
    );
    return this.unwrap<ChallongeParticipant>(response);
  }

  async randomizeSeeds(
    tournamentId: string,
    userToken?: string,
  ): Promise<void> {
    await this.request(
      'POST',
      `/tournaments/${tournamentId}/participants/randomize`,
      undefined,
      userToken,
    );
  }

  // ==================== MATCHES ====================

  async listMatches(
    tournamentId: string,
    params?: { state?: 'open' | 'pending' | 'complete'; userToken?: string },
  ): Promise<ChallongeMatch[]> {
    const query = new URLSearchParams();
    if (params?.state) query.set('state', params.state);
    const queryString = query.toString() ? `?${query.toString()}` : '';

    const response = await this.request<ApiResponse<ChallongeMatch[]>>(
      'GET',
      `/tournaments/${tournamentId}/matches${queryString}`,
      undefined,
      params?.userToken,
    );
    return this.unwrap<ChallongeMatch[]>(response);
  }

  async getMatch(
    tournamentId: string,
    matchId: string,
    userToken?: string,
  ): Promise<ChallongeMatch> {
    const response = await this.request<ApiResponse<ChallongeMatch>>(
      'GET',
      `/tournaments/${tournamentId}/matches/${matchId}`,
      undefined,
      userToken,
    );
    return this.unwrap<ChallongeMatch>(response);
  }

  async reportMatchScore(
    tournamentId: string,
    matchId: string,
    data: {
      winnerId: string;
      scoresCsv: string; // e.g. "3-2"
      userToken?: string;
    },
  ): Promise<ChallongeMatch> {
    const response = await this.request<ApiResponse<ChallongeMatch>>(
      'PUT',
      `/tournaments/${tournamentId}/matches/${matchId}`,
      {
        data: {
          type: 'matches',
          attributes: {
            winner_id: data.winnerId,
            scores_csv: data.scoresCsv,
          },
        },
      },
      data.userToken,
    );
    return this.unwrap<ChallongeMatch>(response);
  }

  async markMatchUnderway(
    tournamentId: string,
    matchId: string,
    userToken?: string,
  ): Promise<ChallongeMatch> {
    const response = await this.request<ApiResponse<ChallongeMatch>>(
      'PUT',
      `/tournaments/${tournamentId}/matches/${matchId}/change_state`,
      {
        data: {
          type: 'MatchState',
          attributes: { state: 'mark_underway' },
        },
      },
      userToken,
    );
    return this.unwrap<ChallongeMatch>(response);
  }
}

// Singleton
let challongeService: ChallongeService | null = null;

export function getChallongeService(): ChallongeService {
  if (!challongeService) {
    challongeService = new ChallongeService();
  }
  return challongeService;
}

export type {
  ApiResponse,
  ChallongeMatch,
  ChallongeParticipant,
  ChallongeTournament,
};
