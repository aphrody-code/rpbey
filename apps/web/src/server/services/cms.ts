import "server-only";
import { listStaffMembers as sdkListStaffMembers } from "@rpbey/api-client";
import type { StaffMember } from "@rpbey/types";
import { isRemote, unwrap } from "@/server/data-source";
import { listActiveStaffMembers } from "@/server/dal/cms";

/**
 * Service CMS — staff / contenu éditorial. Porteur du seam DAL↔SDK.
 *
 * Seam : `getStaffMembers` bascule sur le SDK généré en mode standalone
 * (`isRemote`, `API_BASE` défini). En co-localisé (VPS) le chemin DAL est
 * EXACTEMENT `listActiveStaffMembers()` — zéro changement de requête/forme.
 */

/**
 * Staff actif (page publique `/notre-equipe`).
 *
 * - Co-localisé : `listActiveStaffMembers()` (DB) inchangé → type `StaffMember`
 *   (select model complet, mode:"string" sur les timestamps).
 * - Standalone : SDK `GET /api/v1/cms/staff` → contrat `{ members }`. Le contrat
 *   expose le sous-ensemble réellement consommé par l'UI (id/name/role/teamId/
 *   imageUrl/discordId/displayIndex/isActive) ; on le remappe vers le type DB en
 *   complétant les colonnes annexes (jamais lues par la page) avec des valeurs
 *   neutres pour rester structurellement compatible.
 */
export async function getStaffMembers(): Promise<StaffMember[]> {
  if (isRemote) {
    const { members } = unwrap(await sdkListStaffMembers());
    return members.map(
      (m): StaffMember => ({
        id: m.id,
        name: m.name,
        role: m.role,
        teamId: m.teamId,
        imageUrl: m.imageUrl ?? null,
        discordId: m.discordId ?? null,
        displayIndex: m.displayIndex ?? 0,
        isActive: m.isActive ?? true,
        createdAt: m.createdAt ?? new Date(0).toISOString(),
        updatedAt: m.updatedAt ?? new Date(0).toISOString(),
        // Colonnes Discord/annexes non exposées par le contrat — non lues par l'UI.
        accountCreatedAt: null,
        activities: null,
        globalName: null,
        joinedAt: null,
        nickname: null,
        premiumSince: null,
        roles: null,
        serverAvatar: null,
        status: null,
      }),
    );
  }

  return listActiveStaffMembers();
}
