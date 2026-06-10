import { PartResponseSchema } from "@rpbey/api-contract";
import { jsonErr, jsonOk } from "@/server/api/handler";
import { getPartById } from "@/server/dal/parts";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const part = await getPartById(id);
    return jsonOk(PartResponseSchema.parse({ part: part ?? null }));
  } catch (e) {
    console.error("[api/v1/parts/[id]]", e);
    return jsonErr({ code: "internal", message: "internal error" }, 500);
  }
}
