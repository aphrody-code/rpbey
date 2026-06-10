import { TeamMembersResponseSchema } from "@rpbey/api-contract";
import { jsonErr, jsonOk } from "@/server/api/handler";
import { getTeamMembersBySlug } from "@/server/dal/teams";

export async function GET(_request: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    const result = await getTeamMembersBySlug(slug);
    return jsonOk(TeamMembersResponseSchema.parse(result));
  } catch (e) {
    console.error("[api/v1/teams/[slug]/members]", e);
    return jsonErr({ code: "internal", message: "internal error" }, 500);
  }
}
