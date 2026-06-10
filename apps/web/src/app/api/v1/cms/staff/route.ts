import { StaffListResponseSchema } from "@rpbey/api-contract";
import { getRoute } from "@/server/api/handler";
import { listActiveStaffMembers } from "@/server/dal/cms";

// Lecture publique du staff actif (page `/notre-equipe`).
export const GET = getRoute({
  response: StaffListResponseSchema,
  async handle() {
    return { members: await listActiveStaffMembers() };
  },
});
