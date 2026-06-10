import { PublicUserResponseSchema } from "@rpbey/api-contract";
import { jsonErr, jsonOk } from "@/server/api/handler";
import { getPublicUser } from "@/server/dal/users";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const result = await getPublicUser(id);
    return jsonOk(PublicUserResponseSchema.parse(result));
  } catch (e) {
    console.error("[api/v1/users/[id]]", e);
    return jsonErr({ code: "internal", message: "internal error" }, 500);
  }
}
