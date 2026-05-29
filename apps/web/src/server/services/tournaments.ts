import "server-only";
import {
  getTournament as sdkGetTournament,
  listTournaments as sdkListTournaments,
} from "@rpbey/api-client";
import type { TournamentDetailResponse, TournamentsListResponse } from "@rpbey/api-contract";
import { isRemote, unwrap } from "@/server/data-source";
import {
  getTournamentDetail,
  listTournamentCards,
  type TournamentsFilter,
} from "@/server/dal/tournaments";

/**
 * Service tournois — orchestration DAL ↔ SDK derrière le seam `isRemote`.
 * UI-agnostic : assemble la forme contrat. En mode co-localisé (VPS) tape la DAL ;
 * en mode standalone (Vercel) lit l'API distante via le SDK généré.
 */

export async function getTournamentsList(
  filter: TournamentsFilter = {},
): Promise<TournamentsListResponse> {
  if (isRemote) {
    return unwrap(
      await sdkListTournaments({
        query: {
          status: filter.status,
          limit: filter.limit,
          offset: filter.offset,
        },
      }),
    );
  }
  return listTournamentCards(filter) as Promise<TournamentsListResponse>;
}

export async function getTournamentDetailById(idOrSlug: string): Promise<TournamentDetailResponse> {
  if (isRemote) {
    return unwrap(await sdkGetTournament({ path: { id: idOrSlug } }));
  }
  return getTournamentDetail(idOrSlug) as Promise<TournamentDetailResponse>;
}
