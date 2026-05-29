import "server-only";
import { getPublicUser as sdkGetPublicUser } from "@rpbey/api-client";
import { isRemote, unwrap } from "@/server/data-source";
import { getProfileMeta } from "@/server/dal/users";

/**
 * Service utilisateurs — orchestration DAL ↔ SDK derrière le seam `isRemote`.
 * UI-agnostic. En mode co-localisé (VPS) tape la DAL ; en standalone (Vercel) lit
 * l'API distante (`/api/v1/users/{id}`) via le SDK généré.
 */

/** Forme méta SEO d'un profil public — sous-ensemble réellement lu par `generateMetadata`. */
export interface ProfileMetaInfo {
  name: string | null;
  image: string | null;
  profile: {
    bladerName: string | null;
    rankingPoints: number;
    wins: number;
    losses: number;
    tournamentWins: number;
  } | null;
}

/**
 * Champs nécessaires à la méta SEO d'une page profil publique (`/profile/[id]`).
 *
 * Co-localisé : `getProfileMeta(id)` (DAL, iso exact). Standalone : `getPublicUser`
 * (`/api/v1/users/{id}`, surensemble de champs) remappé vers la forme méta restreinte.
 * Les deux modes renvoient `name`/`image`/`profile.{bladerName,rankingPoints,wins,losses,tournamentWins}`.
 */
export async function getProfileMetaInfo(id: string): Promise<ProfileMetaInfo | null> {
  if (isRemote) {
    const { user } = unwrap(await sdkGetPublicUser({ path: { id } }));
    if (!user) return null;
    const p = user.profile;
    return {
      name: user.name ?? null,
      image: user.image ?? null,
      profile: p
        ? {
            bladerName: p.bladerName ?? null,
            rankingPoints: p.rankingPoints,
            wins: p.wins,
            losses: p.losses,
            tournamentWins: p.tournamentWins,
          }
        : null,
    };
  }
  return getProfileMeta(id);
}
