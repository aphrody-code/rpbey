import { PollDetailResponseSchema } from "@rpbey/api-contract";
import { jsonErr, jsonOk } from "@/server/api/handler";
import { getPoll } from "@/server/dal/polls";
import { readVoter } from "@/server/api/voter";

export async function GET(_request: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    const voter = await readVoter();
    const result = await getPoll(slug, voter);
    return jsonOk(PollDetailResponseSchema.parse(result));
  } catch (e) {
    console.error("[api/v1/polls/[slug]]", e);
    return jsonErr({ code: "internal", message: "internal error" }, 500);
  }
}
