import { TeamDetailResponseSchema } from "@rpbey/api-contract";
import { jsonErr, jsonOk } from "@/server/api/handler";
import { getTeamBySlug } from "@/server/dal/teams";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    const result = await getTeamBySlug(slug);
    return jsonOk(TeamDetailResponseSchema.parse(result));
  } catch (e) {
    console.error("[api/v1/teams/[slug]]", e);
    return jsonErr({ code: "internal", message: "internal error" }, 500);
  }
}
