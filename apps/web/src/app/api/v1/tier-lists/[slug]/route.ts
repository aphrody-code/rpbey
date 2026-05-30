import { TierListDetailResponseSchema } from "@rpbey/api-contract";
import { jsonErr, jsonOk } from "@/server/api/handler";
import { getTierList } from "@/server/dal/polls";
import { readVoter } from "@/server/api/voter";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    const voter = await readVoter();
    const result = await getTierList(slug, voter);
    return jsonOk(TierListDetailResponseSchema.parse(result));
  } catch (e) {
    console.error("[api/v1/tier-lists/[slug]]", e);
    return jsonErr({ code: "internal", message: "internal error" }, 500);
  }
}
