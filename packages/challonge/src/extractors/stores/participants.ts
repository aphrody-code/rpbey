/**
 * Participants store extractor — pure, bundlable.
 *
 * Single source of truth for turning a parsed `_initialStoreState` map into
 * `NormalizedParticipant[]`. Moved verbatim out of `scraper.ts` (P3 registry
 * split): the `NormalizedParticipant` interface, `normalizeParticipantRaw`, and
 * `storeToParticipants` are byte-for-byte identical, only relocated so the
 * extractor stays free of any bxc / transport / FFI import and can be reused
 * from the route registry. `scraper.ts` now re-imports them from here.
 *
 * Input is a `Record<string, unknown>` (the parsed store); output is
 * `NormalizedParticipant[]`. Universally bundlable (Next.js).
 *
 * @module extractors/stores/participants
 */

/**
 * Normalized participant shape produced from a `/participants` page store.
 * Mirrored (as an optional superset) by `SnapshotParticipantExtra` in
 * `mappers/snapshot.ts`.
 */
export interface NormalizedParticipant {
  id: number;
  display_name: string;
  seed: number;
  username: string | null;
  challongeUsername: string | null;
  challongeProfileUrl: string | null;
  final_rank: number | null;
  checked_in: boolean;
  portrait_url: string | null;
}

/** Normalize one raw participant record (handles the `{ participant: {...} }` wrapper). */
export function normalizeParticipantRaw(p: Record<string, unknown>): NormalizedParticipant {
  const data = (p["participant"] as Record<string, unknown>) ?? p;
  const username =
    (data["username"] as string | null) ?? (data["challonge_username"] as string | null) ?? null;
  return {
    id: (data["id"] as number) ?? 0,
    display_name:
      (data["display_name"] as string) ??
      (data["name"] as string) ??
      (data["username"] as string) ??
      "",
    seed: (data["seed"] as number) ?? 0,
    username,
    challongeUsername: username,
    challongeProfileUrl: username ? `https://challonge.com/users/${username}` : null,
    final_rank: (data["final_rank"] as number | null) ?? null,
    checked_in: Boolean(data["checked_in"]),
    portrait_url:
      (data["portrait_url"] as string | null) ??
      (data["attached_participatable_portrait_url"] as string | null) ??
      (data["attached_participant_portrait_url"] as string | null) ??
      null,
  };
}

/** Extract participants from a /participants page store. */
export function storeToParticipants(store: Record<string, unknown>): NormalizedParticipant[] {
  const ts = store["TournamentStore"] as Record<string, unknown> | null;
  const ps = store["ParticipantsStore"] as Record<string, unknown> | null;

  const candidates: unknown[] =
    (ts?.["participants"] as unknown[] | null) ??
    ((ts?.["tournament"] as Record<string, unknown> | null)?.["participants"] as
      | unknown[]
      | null) ??
    (ps?.["participants"] as unknown[] | null) ??
    (Array.isArray(ps) ? ps : null) ??
    [];

  return (candidates as Record<string, unknown>[]).map(normalizeParticipantRaw);
}
